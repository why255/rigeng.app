"""⑦数据仪表盘服务 — 核心业务逻辑。

功能（MVP）：
- 11 个前端对齐的指标/趋势/分布/情绪/预警/推荐 API
- KPI 优先从真实数据库（Plan/PlanTask/ReviewRecord）计算，
  数据不足时降级为合理演示数据
- 双向诊断：根据计划完成率给出正向激励或温暖关怀

数据来源表：plan, plan_task, review_record, emotion_score, document,
            file_object, event_log, metric_daily, 等
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from ...shared.config import settings
from ...shared.errors import E_DATE_RANGE_INVALID, E_METRIC_NOT_FOUND, E_DATA_NOT_READY
from ...shared.models.analytics import CarePushLog, EventLog
from ...shared.models.emotion_score import EmotionScore
from ...shared.models.plan import Plan, PlanTask
from ...shared.models.review import ReviewRecord
from ...shared.models.knowledge import Document

logger = logging.getLogger("analytics")


def _today_range():
    """返回今日 UTC 起止（与 plans 服务一致的 naive datetime）。"""
    today = datetime.now(timezone.utc).date()
    start = datetime(today.year, today.month, today.day, 0, 0, 0)
    end = datetime(today.year, today.month, today.day, 23, 59, 59)
    return start, end


def _compute_real_kpi(db: Session, user_id: str) -> dict[str, Any] | None:
    """从真实数据库表计算 KPI 指标。

    返回 None 表示尚无足够数据，调用方应降级为演示数据。
    """
    start, end = _today_range()

    # ── 今日计划完成率 ──
    plan = db.scalar(
        select(Plan).where(
            and_(
                Plan.user_id == user_id,
                Plan.created_at >= start,
                Plan.created_at <= end,
                Plan.status.in_(["draft", "active", "completed"]),
                Plan.deleted_at.is_(None),
            )
        ).order_by(Plan.created_at.desc())
    )

    completion_rate = 0.0
    total_tasks = 0
    completed_tasks = 0
    if plan and plan.stats_json:
        total_tasks = plan.stats_json.get("total_tasks", 0)
        completed_tasks = plan.stats_json.get("completed_tasks", 0)
        completion_rate = plan.stats_json.get("completion_rate", 0.0)
        if isinstance(completion_rate, int):
            completion_rate = float(completion_rate)

    # ── SOP 总量（累计） ──
    sop_count = db.scalar(
        select(func.count(ReviewRecord.id)).where(
            and_(
                ReviewRecord.user_id == user_id,
                ReviewRecord.sop_title.isnot(None),
                ReviewRecord.sop_title != "",
            )
        )
    ) or 0

    # ── 连续使用天数 ──
    streak_days = _compute_streak(db, user_id)

    # ── 平均情绪分 ──
    emotion_row = db.execute(
        select(
            func.avg(ReviewRecord.emotion_score),
            func.count(ReviewRecord.emotion_score),
        ).where(
            and_(
                ReviewRecord.user_id == user_id,
                ReviewRecord.emotion_score.isnot(None),
            )
        )
    ).first()
    avg_emotion = round(float(emotion_row[0]), 1) if emotion_row and emotion_row[0] is not None else 0.0

    # ── 录音总数 ──
    total_recordings = db.scalar(
        select(func.count(EventLog.id)).where(
            and_(
                EventLog.user_id == user_id,
                EventLog.event_type == "recording_completed",
            )
        )
    ) or 0

    # ── 文档总数 ──
    total_docs = db.scalar(
        select(func.count(Document.id)).where(
            and_(
                Document.owner_user_id == user_id,
                Document.status != "recycled",
            )
        )
    ) or 0

    # ── 勇气值（累计） ──
    courage_row = db.execute(
        select(func.sum(ReviewRecord.courage_value)).where(
            ReviewRecord.user_id == user_id
        )
    ).first()
    courage_value = int(courage_row[0]) if courage_row and courage_row[0] else 0

    # 若完全无数据（无计划且无复盘），返回 None 让调用方用 demo
    if plan is None and sop_count == 0:
        return None

    return {
        "completion_rate": completion_rate,
        "sop_count": sop_count,
        "streak_days": streak_days,
        "emotion_score": avg_emotion,
        "total_recordings": total_recordings,
        "total_docs": total_docs,
        "courage_value": courage_value,
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
    }


def _compute_streak(db: Session, user_id: str) -> int:
    """计算连续使用天数（从今天往回数，有 plan 或 review 记录的天数）。"""
    today = datetime.now(timezone.utc).date()
    streak = 0
    for offset in range(365):
        check_date = today - timedelta(days=offset)
        day_start = datetime(check_date.year, check_date.month, check_date.day, 0, 0, 0)
        day_end = datetime(check_date.year, check_date.month, check_date.day, 23, 59, 59)

        has_plan = db.scalar(
            select(func.count(Plan.id)).where(
                and_(
                    Plan.user_id == user_id,
                    Plan.created_at >= day_start,
                    Plan.created_at <= day_end,
                    Plan.deleted_at.is_(None),
                )
            )
        ) or 0

        has_review = db.scalar(
            select(func.count(ReviewRecord.id)).where(
                and_(
                    ReviewRecord.user_id == user_id,
                    ReviewRecord.created_at >= day_start,
                    ReviewRecord.created_at <= day_end,
                )
            )
        ) or 0

        if has_plan > 0 or has_review > 0:
            streak += 1
        elif offset > 0:  # 今天可以还没有记录，但昨天必须有
            break
        # offset == 0 (today) with no data: still continue to yesterday

    return streak


def _compute_diagnosis(completion_rate: float, sop_count: int, streak_days: int) -> dict[str, Any]:
    """双向诊断：根据完成率给出正向激励或温暖关怀。

    步骤13 核心功能：
    - 完成率 >= 80% → 正向激励
    - 完成率 50%-80% → 温和鼓励
    - 完成率 < 50% → 温暖关怀
    """
    if completion_rate >= 80:
        diagnosis_type = "positive"
        messages = [
            f"姐，计划完成率 {completion_rate:.0f}%，太棒了！这份执行力就是你的核心竞争力 💪",
            f"完成率 {completion_rate:.0f}%，今天又是高效的一天！继续保持这个节奏~",
            f"{completion_rate:.0f}% 的完成率，你已经是自己的冠军了！🏆",
        ]
        # 根据 streak 选一句
        idx = min(streak_days % len(messages), len(messages) - 1)
        message = messages[idx]
        tone = "celebratory"
        emoji = "🎉"
    elif completion_rate >= 50:
        diagnosis_type = "encouraging"
        messages = [
            f"完成率 {completion_rate:.0f}%，还不错哦~ 把没完成的挪到明天继续加油！",
            f"{completion_rate:.0f}% 完成，已经做了一大半了，明天把剩下的补上~",
            f"进度 {completion_rate:.0f}%，稳扎稳打就是最好的节奏 🌱",
        ]
        idx = min((streak_days + sop_count) % len(messages), len(messages) - 1)
        message = messages[idx]
        tone = "supportive"
        emoji = "🌿"
    else:
        diagnosis_type = "caring"
        messages = [
            f"姐，今天完成率 {completion_rate:.0f}%，是不是有点忙？没关系，下周我们一起加油~",
            f"完成率 {completion_rate:.0f}% 也没关系，关键是每天都在往前走 💙",
            f"有时候慢就是快。{completion_rate:.0f}% 是今天的起点，明天会更好~",
        ]
        idx = min((streak_days + sop_count) % len(messages), len(messages) - 1)
        message = messages[idx]
        tone = "gentle"
        emoji = "💙"

    return {
        "type": diagnosis_type,
        "message": message,
        "tone": tone,
        "emoji": emoji,
        "completion_rate": completion_rate,
        "sop_count": sop_count,
        "streak_days": streak_days,
        "suggestion": _get_suggestion(diagnosis_type, completion_rate),
    }


def _get_suggestion(diagnosis_type: str, completion_rate: float) -> str:
    """根据诊断类型给出建议。"""
    if diagnosis_type == "positive":
        return "建议把今天的 SOP 沉淀到知识库，让经验可复用~"
    elif diagnosis_type == "encouraging":
        return "未完成的事项可以标注优先级，明天从最重要的开始~"
    else:
        return "明天从一件最重要的小事开始，完成它就会有成就感 💪"


def _demo_trend(metric_type: str, period: str) -> list[dict]:
    """生成演示趋势数据。"""
    if period == "week":
        labels = ["一", "二", "三", "四", "五", "六", "日"]
    else:
        labels = ["W1", "W2", "W3", "W4"]

    if metric_type == "completion_rate":
        values = [82, 85, 78, 92, 88, 95, 87.5][:len(labels)]
    elif metric_type == "sop_count":
        values = [18, 19, 21, 20, 22, 24, 24][:len(labels)]
    else:
        values = [50 + i * 5 for i in range(len(labels))]

    return [{"label": l, "value": v} for l, v in zip(labels, values)]


# ═══════════════════════════════════════════════
# 公开接口
# ═══════════════════════════════════════════════

def get_kpi(db: Session, user_id: str) -> dict[str, Any]:
    """核心指标：计划完成率、SOP数、连续天数、情绪分等。

    优先从真实数据库计算，数据不足时降级为演示数据。
    """
    real = _compute_real_kpi(db, user_id)
    if real is not None:
        return real
    # 降级：演示数据
    return {
        "completion_rate": 87.5,
        "sop_count": 14,
        "streak_days": 7,
        "emotion_score": 6.0,
        "total_recordings": 23,
        "total_docs": 45,
        "courage_value": 128,
        "total_tasks": 8,
        "completed_tasks": 7,
    }


def get_diagnosis(db: Session, user_id: str) -> dict[str, Any]:
    """双向诊断：根据真实计划完成率给出正向激励或温暖关怀。

    步骤13 核心接口 —— 做得好给正向激励，做得不够给温暖关怀。
    """
    real = _compute_real_kpi(db, user_id)
    if real is not None:
        cr = real["completion_rate"]
        sop = real["sop_count"]
        streak = real["streak_days"]
    else:
        # 无真实数据时使用演示值
        cr = 87.5
        sop = 14
        streak = 7

    return _compute_diagnosis(cr, sop, streak)


def get_trend(db: Session, user_id: str, metric_type: str,
              days: int = 7, dimension: str | None = None) -> dict[str, Any]:
    """趋势时序数据。"""
    period = "week" if days <= 7 else "month"
    points = _demo_trend(metric_type, period)
    return {"points": points, "metric_type": metric_type, "period": period}


def get_trend_detail(db: Session, user_id: str,
                     period: str = "week") -> dict[str, Any]:
    """趋势详细版（双维度：完成率 + SOP）。"""
    if period not in ("week", "month"):
        raise E_DATE_RANGE_INVALID

    completion = _demo_trend("completion_rate", period)
    sop = _demo_trend("sop_count", period)
    return {
        "completion": completion,
        "sop": sop,
        "period": period,
    }


def get_distribution(db: Session, user_id: str,
                     dimension: str = "module",
                     from_date: str | None = None,
                     to_date: str | None = None) -> dict[str, Any]:
    """按维度分布统计。"""
    # MVP: 演示数据
    distributions = {
        "module": [
            {"name": "朝有规划", "value": 85},
            {"name": "暮有复盘", "value": 72},
            {"name": "智能记录", "value": 60},
            {"name": "智能问答", "value": 45},
            {"name": "智能办公", "value": 55},
            {"name": "高维求职", "value": 30},
        ],
        "doc_type": [
            {"name": "SOP", "value": 35},
            {"name": "萃取报告", "value": 25},
            {"name": "问答沉淀", "value": 20},
            {"name": "其他", "value": 20},
        ],
    }
    items = distributions.get(dimension, distributions["module"])
    total = sum(i["value"] for i in items) if items else 0
    for i in items:
        i["percentage"] = round(i["value"] / total * 100, 1) if total else 0
    return {"items": items, "dimension": dimension, "total": total}


def get_comparison(db: Session, user_id: str) -> dict[str, Any]:
    """双时段对比（本周 vs 上周）。"""
    labels = ["一", "二", "三", "四", "五", "六", "日"]
    return {
        "current": [{"label": l, "value": v} for l, v in zip(labels, [82, 85, 78, 92, 88, 95, 87.5])],
        "previous": [{"label": l, "value": v} for l, v in zip(labels, [75, 80, 72, 85, 82, 90, 84])],
        "delta_pct": 4.8,
    }


def get_sop_weekly(db: Session, user_id: str) -> dict[str, Any]:
    """每周SOP产量和质量。"""
    return {
        "week": "2026-W25",
        "count": 24,
        "items": [
            {"title": "结构化面试SOP", "quality_score": 4.5, "created_at": "2026-06-24"},
            {"title": "绩效面谈SOP", "quality_score": 4.0, "created_at": "2026-06-23"},
            {"title": "新员工入职SOP", "quality_score": 4.8, "created_at": "2026-06-22"},
        ],
    }


def get_contribution(db: Session, user_id: str) -> dict[str, Any]:
    """模块贡献度分布。"""
    return {
        "items": [
            {"name": "朝有规划", "value": 85},
            {"name": "暮有复盘", "value": 72},
            {"name": "智能记录", "value": 60},
            {"name": "智能问答", "value": 45},
            {"name": "智能办公", "value": 55},
            {"name": "高维求职", "value": 30},
        ],
    }


def get_composition(db: Session, user_id: str) -> dict[str, Any]:
    """指标构成饼图数据。"""
    return {
        "items": [
            {"name": "计划执行", "value": 45, "color": "#C03A39"},
            {"name": "复盘沉淀", "value": 30, "color": "#E8A94D"},
            {"name": "知识积累", "value": 25, "color": "#4CAF50"},
        ],
    }


def get_emotion(db: Session, user_id: str) -> dict[str, Any]:
    """情绪评分趋势。"""
    return {
        "score": 7.0,
        "label": "状态稳定，充满动力",
        "ai_analysis": "本周情绪整体积极，计划完成率与情绪正向相关",
        "self_reported": 7,
        "weekly_trend": [
            {"label": "一", "value": 6},
            {"label": "二", "value": 7},
            {"label": "三", "value": 5},
            {"label": "四", "value": 8},
            {"label": "五", "value": 7},
            {"label": "六", "value": 9},
            {"label": "日", "value": 7},
        ],
    }


def get_alerts(db: Session, user_id: str) -> dict[str, Any]:
    """预警列表。"""
    return {
        "items": [
            {
                "level": "warning",
                "title": "计划完成率下降",
                "message": "本周计划完成率较上周下降2.1%，建议关注「朝有规划」模块",
                "module": "M1",
            },
            {
                "level": "info",
                "title": "SOP沉淀速度放缓",
                "message": "近两周SOP生成数量低于月均值，建议增加复盘频率",
                "module": "M2",
            },
        ],
    }


def get_recommendations(db: Session, user_id: str) -> dict[str, Any]:
    """推荐服务。"""
    return {
        "items": [
            {
                "title": "1对1职业规划咨询",
                "description": "基于您的数据沉淀，定制职业发展路径",
                "icon": "💝",
                "action_label": "预约咨询",
                "action_url": "/m/career-mentor",
            },
            {
                "title": "ABS产品方案诊断",
                "description": "用ABS模型系统化梳理您的顾问产品线",
                "icon": "📦",
                "action_label": "开始诊断",
                "action_url": "/m/product-design",
            },
        ],
    }


# ═══════════════════════════════════════════════════════════════════
# Step 25 / Wave 5 — 全量扩展功能
# ═══════════════════════════════════════════════════════════════════

# ── 内部常量 ──
_UTC_TZ = timezone(timedelta(hours=8))  # 北京时间
_MODULE_MAP = {
    "M1": "朝有规划", "M2": "暮有复盘", "M3": "智能记录",
    "M4": "智能问答", "M5": "智能办公", "M6": "高维求职",
    "M7": "情绪树洞", "M8": "知识库",   "M9": "咨询辅导",
    "M10": "产品设计", "M11": "数据分析",
}
_POSITIVE_TRIGGERS = {
    "streak_7days": "连续使用7天，习惯已养成",
    "completion_100": "今日计划100%完成，完美执行力",
    "sop_10": "累计产出10条SOP，知识沉淀扎实",
    "courage_100": "勇气值突破100，持续突破舒适区",
    "first_review": "完成第一次复盘，开启成长循环",
    "comeback_3days": "断用后回归第3天，韧性回归",
}
_NEGATIVE_TRIGGERS = {
    "completion_below_30": {"message": "计划完成率持续低于30%", "escalation": "completion_below_30_7d"},
    "streak_break": {"message": "连续使用中断超过2天", "escalation": "streak_break_5d"},
    "emotion_drop": {"message": "情绪评分连续3天下降", "escalation": "emotion_drop_7d"},
    "inactive_3days": {"message": "连续3天无任何使用记录", "escalation": "inactive_7d"},
}
_NIGHT_START = 21  # 21:00
_NIGHT_END = 9     # 09:00
_MAX_PUSH_PER_WEEK = 5
_NEW_USER_QUIET_DAYS = 7
_MAX_APPEAL_PCT = 20.0
_BRIDGE_COOLDOWN_DAYS = 3


# ── 工具函数 ──

def _now_cn() -> datetime:
    """返回北京时间当前时刻。"""
    return datetime.now(_UTC_TZ)


def _today_cn_str() -> str:
    return _now_cn().strftime("%Y-%m-%d")


def _week_start_cn() -> datetime:
    """本周一 00:00 北京时间。"""
    now = _now_cn()
    monday = now - timedelta(days=now.weekday())
    return monday.replace(hour=0, minute=0, second=0, microsecond=0)


def _is_workday() -> bool:
    """是否工作日（周一~周五）。"""
    return _now_cn().weekday() < 5


def _is_business_hours() -> bool:
    """是否在工作时间（9:00-21:00 北京时间）。"""
    hour = _now_cn().hour
    return _NIGHT_END <= hour < _NIGHT_START


def _compute_new_user_days(db: Session, user_id: str) -> int:
    """计算用户注册至今的天数。"""
    from ...shared.models.user import User as UserModel
    user = db.scalar(select(UserModel).where(UserModel.id == user_id))
    if not user or not user.created_at:
        return 999  # 老用户，无限制
    delta = _now_cn() - user.created_at.replace(tzinfo=_UTC_TZ)
    return max(0, delta.days)


def _count_weekly_pushes(db: Session, user_id: str) -> int:
    """统计本周已推送次数（正反向合计）。"""
    week_start = _week_start_cn()
    count = db.scalar(
        select(func.count(CarePushLog.id)).where(
            and_(
                CarePushLog.user_id == user_id,
                CarePushLog.pushed_at >= week_start,
                CarePushLog.intercepted_reason.is_(None),
            )
        )
    ) or 0
    return count


def _get_care_mode(db: Session, user_id: str) -> str:
    """获取用户关怀模式（默认 active）。"""
    from ...shared.models.user import User as UserModel
    user = db.scalar(select(UserModel).where(UserModel.id == user_id))
    if user and user.care_mode:
        return user.care_mode
    return "active"


# ── 模块指标计算 ──

def _module_metric(db: Session, user_id: str, module_key: str,
                   module_name: str) -> dict[str, Any]:
    """计算单个模块的指标数据。

    各模块数据来源不同，缺数据时返回合理默认值。
    """
    start, end = _today_range()

    if module_key == "M1":  # 朝有规划
        plan = db.scalar(
            select(Plan).where(
                and_(
                    Plan.user_id == user_id,
                    Plan.created_at >= start,
                    Plan.created_at <= end,
                    Plan.status.in_(["draft", "active", "completed"]),
                    Plan.deleted_at.is_(None),
                )
            ).order_by(Plan.created_at.desc())
        )
        if plan and plan.stats_json:
            total = plan.stats_json.get("total_tasks", 0)
            completed = plan.stats_json.get("completed_tasks", 0)
            rate = plan.stats_json.get("completion_rate", 0.0)
            if isinstance(rate, int):
                rate = float(rate)
        else:
            total, completed, rate = 0, 0, 0.0

    elif module_key == "M2":  # 暮有复盘
        review_count = db.scalar(
            select(func.count(ReviewRecord.id)).where(
                and_(
                    ReviewRecord.user_id == user_id,
                    ReviewRecord.created_at >= start,
                    ReviewRecord.created_at <= end,
                )
            )
        ) or 0
        sop_today = db.scalar(
            select(func.count(ReviewRecord.id)).where(
                and_(
                    ReviewRecord.user_id == user_id,
                    ReviewRecord.created_at >= start,
                    ReviewRecord.created_at <= end,
                    ReviewRecord.sop_title.isnot(None),
                    ReviewRecord.sop_title != "",
                )
            )
        ) or 0
        total = 1  # 每日应有1次复盘
        completed = 1 if review_count > 0 else 0
        rate = 100.0 if review_count > 0 else 0.0

    elif module_key == "M3":  # 智能记录
        from ...shared.models.recording import Recording, ExtractionResult
        rec_count = db.scalar(
            select(func.count(Recording.id)).where(
                and_(
                    Recording.user_id == user_id,
                    Recording.created_at >= start,
                    Recording.created_at <= end,
                )
            )
        ) or 0
        ext_count = db.scalar(
            select(func.count(ExtractionResult.id)).where(
                and_(
                    ExtractionResult.user_id == user_id,
                    ExtractionResult.created_at >= start,
                    ExtractionResult.created_at <= end,
                )
            )
        ) or 0
        total = rec_count
        completed = ext_count
        rate = (completed / total * 100) if total > 0 else 0.0

    elif module_key == "M4":  # 智能问答
        qa_count = db.scalar(
            select(func.count(EventLog.id)).where(
                and_(
                    EventLog.user_id == user_id,
                    EventLog.event_type == "qa_completed",
                    EventLog.created_at >= start,
                    EventLog.created_at <= end,
                )
            )
        ) or 0
        total = qa_count if qa_count > 0 else 1
        completed = qa_count
        rate = min(100.0, qa_count * 20.0)  # 每次问答20%

    elif module_key == "M5":  # 智能办公
        from ...shared.models.office import OfficeDocument
        doc_count = db.scalar(
            select(func.count(OfficeDocument.id)).where(
                and_(
                    OfficeDocument.owner_user_id == user_id,
                    OfficeDocument.created_at >= start,
                    OfficeDocument.created_at <= end,
                )
            )
        ) or 0
        total = doc_count if doc_count > 0 else 1
        completed = doc_count
        rate = min(100.0, doc_count * 25.0)

    elif module_key == "M6":  # 高维求职
        from ...shared.models.career import CareerProgress, JobApplication
        app_count = db.scalar(
            select(func.count(JobApplication.id)).where(
                and_(
                    JobApplication.user_id == user_id,
                    JobApplication.created_at >= start,
                    JobApplication.created_at <= end,
                )
            )
        ) or 0
        prog_count = db.scalar(
            select(func.count(CareerProgress.id)).where(
                and_(
                    CareerProgress.user_id == user_id,
                    CareerProgress.updated_at >= start,
                    CareerProgress.updated_at <= end,
                )
            )
        ) or 0
        total = max(1, app_count + prog_count)
        completed = app_count + prog_count
        rate = min(100.0, completed / total * 100)

    elif module_key == "M7":  # 情绪树洞
        emotion_today = db.scalar(
            select(EmotionScore).where(
                and_(
                    EmotionScore.user_id == user_id,
                    EmotionScore.score_date == _today_cn_str(),
                )
            )
        )
        total = 1
        completed = 1 if emotion_today else 0
        rate = 100.0 if emotion_today else 0.0

    elif module_key == "M8":  # 知识库
        doc_total = db.scalar(
            select(func.count(Document.id)).where(
                and_(
                    Document.owner_user_id == user_id,
                    Document.status != "recycled",
                )
            )
        ) or 0
        doc_today = db.scalar(
            select(func.count(Document.id)).where(
                and_(
                    Document.owner_user_id == user_id,
                    Document.created_at >= start,
                    Document.created_at <= end,
                    Document.status != "recycled",
                )
            )
        ) or 0
        total = doc_total if doc_total > 0 else 1
        completed = doc_total
        rate = 100.0 if doc_total > 0 else 0.0

    elif module_key == "M9":  # 咨询辅导
        from ...shared.models.user import TeacherAssignment
        assign_count = db.scalar(
            select(func.count(TeacherAssignment.id)).where(
                and_(
                    TeacherAssignment.student_id == user_id,
                    TeacherAssignment.created_at >= start,
                    TeacherAssignment.created_at <= end,
                )
            )
        ) or 0
        total = 1
        completed = assign_count
        rate = min(100.0, assign_count * 50.0)

    elif module_key == "M10":  # 产品设计
        prod_events = db.scalar(
            select(func.count(EventLog.id)).where(
                and_(
                    EventLog.user_id == user_id,
                    EventLog.event_type == "product_diagnosis_completed",
                    EventLog.created_at >= start,
                    EventLog.created_at <= end,
                )
            )
        ) or 0
        total = 1
        completed = prod_events
        rate = min(100.0, prod_events * 50.0)

    elif module_key == "M11":  # 数据分析
        dashboard_views = db.scalar(
            select(func.count(EventLog.id)).where(
                and_(
                    EventLog.user_id == user_id,
                    EventLog.event_type == "dashboard_viewed",
                    EventLog.created_at >= start,
                    EventLog.created_at <= end,
                )
            )
        ) or 0
        total = 1
        completed = 1 if dashboard_views > 0 else 0
        rate = 100.0 if dashboard_views > 0 else 0.0

    else:
        total, completed, rate = 0, 0, 0.0

    # 趋势判断
    if rate >= 80:
        trend, trend_pct = "up", min(rate - 70, 30.0)
    elif rate >= 40:
        trend, trend_pct = "stable", 0.0
    else:
        trend, trend_pct = "down", 0.0 - min(40 - rate, 30.0)

    return {
        "module_key": module_key,
        "module_name": module_name,
        "completion_rate": round(rate, 1),
        "total_items": total,
        "completed_items": completed,
        "trend": trend,
        "trend_pct": round(trend_pct, 1),
    }


# ── 1. 全量仪表盘 ──

def get_full_dashboard(db: Session, user_id: str) -> dict[str, Any]:
    """聚合全部 11 模块指标到一个视图。

    从各数据表实时计算，≤2s 响应。
    """
    modules = [
        _module_metric(db, user_id, key, name)
        for key, name in _MODULE_MAP.items()
    ]
    overall = (
        sum(m["completion_rate"] for m in modules) / len(modules)
        if modules else 0.0
    )
    up_count = sum(1 for m in modules if m["trend"] == "up")
    down_count = sum(1 for m in modules if m["trend"] == "down")
    if up_count > down_count:
        overall_trend = "up"
    elif down_count > up_count:
        overall_trend = "down"
    else:
        overall_trend = "stable"

    return {
        "modules": modules,
        "overall_completion_rate": round(overall, 1),
        "overall_trend": overall_trend,
        "updated_at": _now_cn().isoformat(),
    }


# ── 2. 三级下钻 ──

def drill_down(db: Session, user_id: str, metric_key: str,
               level: int = 1) -> dict[str, Any]:
    """三级下钻：大盘→模块→日明细→源头数据。

    响应时间 ≤2s。
    """
    import time as _time
    t0 = _time.time()

    if level == 1:
        # Level 1: 大盘汇总
        dash = get_full_dashboard(db, user_id)
        children = [
            {
                "level": 2,
                "label": m["module_name"],
                "value": m["completion_rate"],
                "children": [],
                "breadcrumb": [f"大盘 > {m['module_name']}"],
                "source_data": None,
            }
            for m in dash["modules"]
        ]
        root = {
            "level": 1,
            "label": "全模块大盘",
            "value": dash["overall_completion_rate"],
            "children": children,
            "breadcrumb": ["大盘"],
            "source_data": {"total_modules": 11, "trend": dash["overall_trend"]},
        }
    elif level == 2:
        # Level 2: 模块明细
        module_name = _MODULE_MAP.get(metric_key, metric_key)
        metric = _module_metric(db, user_id, metric_key, module_name)
        # 模拟过去7天的日明细
        daily_children = _build_daily_drilldown(db, user_id, metric_key, 7)
        root = {
            "level": 2,
            "label": module_name,
            "value": metric["completion_rate"],
            "children": daily_children,
            "breadcrumb": [f"大盘 > {module_name}"],
            "source_data": {
                "total_items": metric["total_items"],
                "completed_items": metric["completed_items"],
                "trend": metric["trend"],
            },
        }
    elif level == 3:
        # Level 3: 日明细→源头
        module_name = _MODULE_MAP.get(metric_key, metric_key)
        daily_children = _build_daily_drilldown(db, user_id, metric_key, 30)
        # 为每个日节点附加上下文源头
        for child in daily_children:
            child["source_data"] = _get_source_data(db, user_id,
                                                     metric_key, child["label"])
        root = {
            "level": 3,
            "label": f"{module_name} 日明细",
            "value": daily_children[0]["value"] if daily_children else 0,
            "children": daily_children,
            "breadcrumb": [f"大盘 > {module_name} > 日明细"],
            "source_data": None,
        }
    else:
        raise E_METRIC_NOT_FOUND

    response_ms = (_time.time() - t0) * 1000
    return {
        "metric_key": metric_key,
        "root": root,
        "current_level": level,
        "response_ms": round(response_ms, 1),
    }


def _build_daily_drilldown(db: Session, user_id: str,
                           module_key: str, days: int) -> list[dict]:
    """构建指定模块最近 N 天的日明细下钻节点。"""
    nodes = []
    today = _now_cn().date()
    for offset in range(days):
        check_date = today - timedelta(days=offset)
        date_str = check_date.strftime("%Y-%m-%d")
        day_start = datetime(check_date.year, check_date.month,
                            check_date.day, 0, 0, 0)
        day_end = datetime(check_date.year, check_date.month,
                          check_date.day, 23, 59, 59)

        # 简化：根据模块类型估算当日完成率
        if module_key == "M1":
            plan = db.scalar(
                select(Plan).where(
                    and_(
                        Plan.user_id == user_id,
                        Plan.created_at >= day_start,
                        Plan.created_at <= day_end,
                        Plan.deleted_at.is_(None),
                    )
                ).order_by(Plan.created_at.desc())
            )
            value = plan.stats_json.get("completion_rate", 0) if (
                plan and plan.stats_json
            ) else 0.0
            if isinstance(value, int):
                value = float(value)
        elif module_key == "M2":
            count = db.scalar(
                select(func.count(ReviewRecord.id)).where(
                    and_(
                        ReviewRecord.user_id == user_id,
                        ReviewRecord.created_at >= day_start,
                        ReviewRecord.created_at <= day_end,
                    )
                )
            ) or 0
            value = 100.0 if count > 0 else 0.0
        elif module_key == "M7":
            es = db.scalar(
                select(EmotionScore).where(
                    and_(
                        EmotionScore.user_id == user_id,
                        EmotionScore.score_date == date_str,
                    )
                )
            )
            value = (es.score + 10) / 20 * 100 if es and es.score is not None else 50.0
        else:
            # 其他模块用事件日志估算
            ev_count = db.scalar(
                select(func.count(EventLog.id)).where(
                    and_(
                        EventLog.user_id == user_id,
                        EventLog.module == module_key,
                        EventLog.created_at >= day_start,
                        EventLog.created_at <= day_end,
                    )
                )
            ) or 0
            value = min(100.0, ev_count * 25.0)

        nodes.append({
            "level": 3,
            "label": date_str,
            "value": round(float(value), 1),
            "children": [],
            "breadcrumb": [
                f"大盘 > {_MODULE_MAP.get(module_key, module_key)} > {date_str}"
            ],
            "source_data": None,
        })

    return nodes


def _get_source_data(db: Session, user_id: str,
                     module_key: str, date_str: str) -> dict | None:
    """获取 level 3 的源头数据（当天具体事件记录）。"""
    check_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    day_start = datetime(check_date.year, check_date.month, check_date.day, 0, 0, 0)
    day_end = datetime(check_date.year, check_date.month, check_date.day, 23, 59, 59)

    events = db.scalars(
        select(EventLog).where(
            and_(
                EventLog.user_id == user_id,
                EventLog.module == module_key,
                EventLog.created_at >= day_start,
                EventLog.created_at <= day_end,
            )
        ).order_by(EventLog.created_at).limit(10)
    ).all()

    if events:
        return {
            "total_events": len(events),
            "event_types": list(set(e.event_type for e in events if e.event_type)),
            "first_event": events[0].created_at.isoformat() if events[0].created_at else None,
            "last_event": events[-1].created_at.isoformat() if events[-1].created_at else None,
        }
    return {"total_events": 0, "event_types": [], "first_event": None, "last_event": None}


# ── 3. 情绪健康指数 ──

def calculate_emotion_index(db: Session, user_id: str) -> dict[str, Any]:
    """计算情绪健康指数（-10 ~ +10）。

    算法：
    - 用户自报评分权重 0.6
    - 语言特征提取的评分权重 0.4（仅提取情绪方向与频次，绝对不涉及原始倾诉内容）
    - 最终得分 clamp 到 [-10, +10]
    """
    today_str = _today_cn_str()
    today_score = db.scalar(
        select(EmotionScore).where(
            and_(
                EmotionScore.user_id == user_id,
                EmotionScore.score_date == today_str,
            )
        )
    )

    # 本周平均
    week_start = _week_start_cn().strftime("%Y-%m-%d")
    week_scores = db.scalars(
        select(EmotionScore).where(
            and_(
                EmotionScore.user_id == user_id,
                EmotionScore.score_date >= week_start,
                EmotionScore.score_date <= today_str,
            )
        ).order_by(EmotionScore.score_date)
    ).all()

    # 上周平均（用于趋势对比）
    last_week_start = (_week_start_cn() - timedelta(days=7)).strftime("%Y-%m-%d")
    last_week_end = (_week_start_cn() - timedelta(days=1)).strftime("%Y-%m-%d")
    last_week_scores = db.scalars(
        select(EmotionScore).where(
            and_(
                EmotionScore.user_id == user_id,
                EmotionScore.score_date >= last_week_start,
                EmotionScore.score_date <= last_week_end,
            )
        )
    ).all()

    # 本月平均
    month_start = _now_cn().replace(day=1).strftime("%Y-%m-%d")
    month_scores = db.scalars(
        select(EmotionScore).where(
            and_(
                EmotionScore.user_id == user_id,
                EmotionScore.score_date >= month_start,
                EmotionScore.score_date <= today_str,
            )
        )
    ).all()

    week_vals = [s.score for s in week_scores if s.score is not None]
    last_week_vals = [s.score for s in last_week_scores if s.score is not None]
    month_vals = [s.score for s in month_scores if s.score is not None]

    # 综合得分：优先用户自报，其次模型提取
    if today_score and today_score.score is not None:
        current_score = float(today_score.score)
        user_confirmed = today_score.user_reported_score is not None
    elif week_vals:
        current_score = sum(week_vals) / len(week_vals)
        user_confirmed = False
    else:
        current_score = 0.0
        user_confirmed = False

    weekly_avg = sum(week_vals) / len(week_vals) if week_vals else 0.0
    last_week_avg = sum(last_week_vals) / len(last_week_vals) if last_week_vals else 0.0
    monthly_avg = sum(month_vals) / len(month_vals) if month_vals else 0.0
    trend_delta = round(weekly_avg - last_week_avg, 1) if last_week_vals else 0.0

    if trend_delta > 0.5:
        trend = "improving"
    elif trend_delta < -0.5:
        trend = "declining"
    else:
        trend = "stable"

    # 标签
    if current_score >= 7:
        label = "状态极佳，精力充沛"
    elif current_score >= 4:
        label = "状态稳定，保持节奏"
    elif current_score >= 0:
        label = "状态平静，可适度挑战"
    elif current_score >= -4:
        label = "状态略低，给自己一点空间"
    else:
        label = "需要关注，建议休息调整"

    return {
        "score": round(current_score, 1),
        "trend": trend,
        "trend_delta": trend_delta,
        "user_confirmed": user_confirmed,
        "last_updated": (
            today_score.updated_at.isoformat()
            if today_score and today_score.updated_at else _now_cn().isoformat()
        ),
        "weekly_avg": round(weekly_avg, 1),
        "monthly_avg": round(monthly_avg, 1),
        "label": label,
    }


# ── 4. 情绪曲线 ──

def generate_emotion_curve(db: Session, user_id: str,
                           period: str = "daily") -> dict[str, Any]:
    """聚合情绪数据到日/周/月/年视图。

    仅提取情绪方向与频次，绝对不涉及原始倾诉内容。
    """
    today = _now_cn().date()

    if period == "daily":
        # 最近14天，每天一个点
        days = 14
        points = []
        for offset in range(days - 1, -1, -1):
            check_date = today - timedelta(days=offset)
            date_str = check_date.strftime("%Y-%m-%d")
            es = db.scalar(
                select(EmotionScore).where(
                    and_(
                        EmotionScore.user_id == user_id,
                        EmotionScore.score_date == date_str,
                    )
                )
            )
            val = float(es.score) if es and es.score is not None else None
            points.append({"label": date_str[5:], "value": val})

    elif period == "weekly":
        # 最近12周
        weeks = 12
        points = []
        for w in range(weeks - 1, -1, -1):
            week_end = today - timedelta(days=today.weekday()) - timedelta(weeks=w) + timedelta(days=6)
            week_start = week_end - timedelta(days=6)
            vals = db.scalars(
                select(EmotionScore.score).where(
                    and_(
                        EmotionScore.user_id == user_id,
                        EmotionScore.score_date >= week_start.strftime("%Y-%m-%d"),
                        EmotionScore.score_date <= week_end.strftime("%Y-%m-%d"),
                        EmotionScore.score.isnot(None),
                    )
                )
            ).all()
            avg = sum(vals) / len(vals) if vals else None
            points.append({
                "label": f"{week_start.strftime('%m/%d')}",
                "value": round(avg, 1) if avg is not None else None,
            })

    elif period == "monthly":
        # 最近12个月
        months = 12
        points = []
        for m in range(months - 1, -1, -1):
            check_month = (today.replace(day=1) - timedelta(days=m * 30)).replace(day=1)
            if check_month.month == 12:
                next_month = check_month.replace(year=check_month.year + 1, month=1)
            else:
                next_month = check_month.replace(month=check_month.month + 1)
            vals = db.scalars(
                select(EmotionScore.score).where(
                    and_(
                        EmotionScore.user_id == user_id,
                        EmotionScore.score_date >= check_month.strftime("%Y-%m-%d"),
                        EmotionScore.score_date < next_month.strftime("%Y-%m-%d"),
                        EmotionScore.score.isnot(None),
                    )
                )
            ).all()
            avg = sum(vals) / len(vals) if vals else None
            points.append({
                "label": check_month.strftime("%Y-%m"),
                "value": round(avg, 1) if avg is not None else None,
            })

    elif period == "yearly":
        # 最近5年
        years = 5
        points = []
        for y in range(years - 1, -1, -1):
            year = today.year - y
            vals = db.scalars(
                select(EmotionScore.score).where(
                    and_(
                        EmotionScore.user_id == user_id,
                        EmotionScore.score_date >= f"{year}-01-01",
                        EmotionScore.score_date <= f"{year}-12-31",
                        EmotionScore.score.isnot(None),
                    )
                )
            ).all()
            avg = sum(vals) / len(vals) if vals else None
            points.append({
                "label": str(year),
                "value": round(avg, 1) if avg is not None else None,
            })
    else:
        raise E_DATE_RANGE_INVALID

    # 过滤掉 None 值计算平均值
    valid_vals = [p["value"] for p in points if p["value"] is not None]
    avg_score = round(sum(valid_vals) / len(valid_vals), 1) if valid_vals else 0.0

    # 找到高低点
    scored_points = [p for p in points if p["value"] is not None]
    high_point = max(scored_points, key=lambda p: p["value"]) if scored_points else None
    low_point = min(scored_points, key=lambda p: p["value"]) if scored_points else None

    return {
        "period": period,
        "points": points,
        "avg_score": avg_score,
        "high_point": high_point,
        "low_point": low_point,
    }


# ── 5. 情绪自评提交 ──

def submit_emotion_score(db: Session, user_id: str, score: int,
                         note: str | None = None) -> dict[str, Any]:
    """用户每日自评情绪（每日首次对话后询问）。

    存入 emotion_score 表，同时记录事件。
    """
    today_str = _today_cn_str()

    # 检查今日是否已有记录
    existing = db.scalar(
        select(EmotionScore).where(
            and_(
                EmotionScore.user_id == user_id,
                EmotionScore.score_date == today_str,
            )
        )
    )

    is_first_today = existing is None

    if existing:
        # 更新已有记录
        existing.user_reported_score = score
        existing.score = score  # 用户自报覆盖综合分
        existing.source = "user_reported"
    else:
        # 新建记录
        new_score = EmotionScore(
            user_id=user_id,
            score_date=today_str,
            score=score,
            source="user_reported",
            user_reported_score=score,
        )
        db.add(new_score)

    # 记录事件
    db.add(EventLog(
        user_id=user_id,
        module="M7",
        event_type="emotion_self_reported",
        properties={"score": score, "note": note},
        ts=_now_cn(),
    ))

    db.commit()

    logger.info(
        f"User {user_id} self-reported emotion score={score} "
        f"(first_today={is_first_today})"
    )

    return {
        "score": score,
        "recorded_at": _now_cn().isoformat(),
        "is_first_today": is_first_today,
    }


# ── 6. 情绪申诉 ──

def appeal_emotion_score(db: Session, user_id: str, date: str,
                         corrected_score: int, reason: str | None = None) -> dict[str, Any]:
    """用户申诉系统计算的评分。

    规则：修正率 ≤ 20% 视为正常。
    """
    # 查找原始记录
    existing = db.scalar(
        select(EmotionScore).where(
            and_(
                EmotionScore.user_id == user_id,
                EmotionScore.score_date == date,
            )
        )
    )
    if not existing:
        raise E_METRIC_NOT_FOUND

    original_score = existing.score or 0

    # 统计本月申诉次数
    month_start = _now_cn().replace(day=1).strftime("%Y-%m-%d")
    month_appeals = db.scalar(
        select(func.count(EmotionScore.id)).where(
            and_(
                EmotionScore.user_id == user_id,
                EmotionScore.score_date >= month_start,
                EmotionScore.is_corrected.is_(True),
            )
        )
    ) or 0

    # 统计本月总评分记录
    month_total = db.scalar(
        select(func.count(EmotionScore.id)).where(
            and_(
                EmotionScore.user_id == user_id,
                EmotionScore.score_date >= month_start,
            )
        )
    ) or 1

    appeal_pct = (month_appeals + 1) / month_total * 100
    is_accepted = appeal_pct <= _MAX_APPEAL_PCT

    if is_accepted:
        # 接受修正
        existing.corrected_score = corrected_score
        existing.is_corrected = True
        existing.score = corrected_score
        db.add(EventLog(
            user_id=user_id,
            module="M7",
            event_type="emotion_appealed",
            properties={
                "date": date,
                "original": original_score,
                "corrected": corrected_score,
                "reason": reason,
            },
            ts=_now_cn(),
        ))
        db.commit()

    return {
        "original_score": original_score,
        "corrected_score": corrected_score if is_accepted else original_score,
        "is_accepted": is_accepted,
        "appeal_count_this_month": month_appeals + 1,
        "max_appeal_pct": _MAX_APPEAL_PCT,
    }


# ── 7. 正向关怀触发 ──

def check_positive_triggers(db: Session, user_id: str,
                            force: bool = False) -> dict[str, Any]:
    """检查6种正向里程碑触发条件。

    6 types: streak_7days, completion_100, sop_10, courage_100,
              first_review, comeback_3days
    """
    real = _compute_real_kpi(db, user_id) or {}
    streak = real.get("streak_days", 0)
    completion = real.get("completion_rate", 0)
    sop_count = real.get("sop_count", 0)
    courage = real.get("courage_value", 0)

    conditions_met = []

    if streak >= 7:
        conditions_met.append("streak_7days")
    if completion >= 99.5:  # 接近100%
        conditions_met.append("completion_100")
    if sop_count >= 10:
        conditions_met.append("sop_10")
    if courage >= 100:
        conditions_met.append("courage_100")

    # 检查首次复盘
    first_review = db.scalar(
        select(func.count(ReviewRecord.id)).where(
            ReviewRecord.user_id == user_id
        )
    ) or 0
    if first_review == 1:
        conditions_met.append("first_review")

    # 检查回归3天
    if _check_comeback_3days(db, user_id):
        conditions_met.append("comeback_3days")

    triggered = len(conditions_met) > 0
    message = None
    message_sent = False
    blocked_reason = None

    if triggered:
        # 构造消息
        msgs = [_POSITIVE_TRIGGERS[c] for c in conditions_met]
        message = "🎉 " + "；".join(msgs) + "！继续保持~"

        if force:
            message_sent = _do_push(db, user_id, "positive",
                                     conditions_met[0], message)
        else:
            # 自动触发：检查推送规则
            blocked_reason = _check_push_rules(db, user_id, "positive")
            if blocked_reason is None:
                message_sent = _do_push(db, user_id, "positive",
                                         conditions_met[0], message)
    else:
        message = "暂无正向里程碑触发条件满足，继续加油~"

    return {
        "triggered": triggered,
        "trigger_type": "positive",
        "conditions_met": conditions_met,
        "message": message,
        "message_sent": message_sent,
        "blocked_reason": blocked_reason,
    }


def _check_comeback_3days(db: Session, user_id: str) -> bool:
    """检查是否为断用后回归第3天。"""
    today = _now_cn().date()
    # 检查过去7天内是否有连续3天空白期，且最近3天连续使用
    consecutive_use = 0
    had_gap = False
    for offset in range(7, -1, -1):
        check_date = today - timedelta(days=offset)
        day_start = datetime(check_date.year, check_date.month,
                            check_date.day, 0, 0, 0)
        day_end = datetime(check_date.year, check_date.month,
                          check_date.day, 23, 59, 59)
        has_activity = db.scalar(
            select(func.count(EventLog.id)).where(
                and_(
                    EventLog.user_id == user_id,
                    EventLog.created_at >= day_start,
                    EventLog.created_at <= day_end,
                )
            )
        ) or 0
        if has_activity > 0:
            consecutive_use += 1
        else:
            if consecutive_use >= 3:
                had_gap = True
            consecutive_use = 0
    return had_gap and consecutive_use >= 3


# ── 8. 反向关怀触发 ──

def check_negative_triggers(db: Session, user_id: str,
                            force: bool = False) -> dict[str, Any]:
    """检查4种反向警告触发条件，含逐级升级机制。

    4 types: completion_below_30, streak_break, emotion_drop, inactive_3days
    升级: completion_below_30_7d, streak_break_5d, emotion_drop_7d, inactive_7d
    """
    new_user_days = _compute_new_user_days(db, user_id)
    if new_user_days < _NEW_USER_QUIET_DAYS and not force:
        return {
            "triggered": False,
            "trigger_type": "negative",
            "conditions_met": [],
            "message": f"新用户前{_NEW_USER_QUIET_DAYS}天仅正向激励，再等{_NEW_USER_QUIET_DAYS - new_user_days}天~",
            "message_sent": False,
            "blocked_reason": "new_user_quiet_period",
        }

    real = _compute_real_kpi(db, user_id) or {}
    completion = real.get("completion_rate", 0)
    streak = real.get("streak_days", 0)

    conditions_met = []
    escalation_met = []

    # 检查连续低完成率
    if _check_consecutive_low_completion(db, user_id, 3):
        conditions_met.append("completion_below_30")
        if _check_consecutive_low_completion(db, user_id, 7):
            escalation_met.append("completion_below_30_7d")

    # 检查连续中断
    if _check_streak_break(db, user_id, 2):
        conditions_met.append("streak_break")
        if _check_streak_break(db, user_id, 5):
            escalation_met.append("streak_break_5d")

    # 检查情绪下降
    if _check_emotion_drop(db, user_id, 3):
        conditions_met.append("emotion_drop")
        if _check_emotion_drop(db, user_id, 7):
            escalation_met.append("emotion_drop_7d")

    # 检查不活跃
    if _check_inactive_days(db, user_id, 3):
        conditions_met.append("inactive_3days")
        if _check_inactive_days(db, user_id, 7):
            escalation_met.append("inactive_7d")

    triggered = len(conditions_met) > 0
    message = None
    message_sent = False
    blocked_reason = None

    if triggered:
        parts = [_NEGATIVE_TRIGGERS[c]["message"] for c in conditions_met if c in _NEGATIVE_TRIGGERS]
        if escalation_met:
            parts.append(f"⚠️ 升级警告: {', '.join(escalation_met)}")
        message = "💙 " + "；".join(parts) + "。需要帮助随时找我~"

        blocked_reason = _check_push_rules(db, user_id, "negative")
        if blocked_reason is None:
            message_sent = _do_push(db, user_id, "negative",
                                     conditions_met[0], message)

    return {
        "triggered": triggered,
        "trigger_type": "negative",
        "conditions_met": conditions_met + escalation_met,
        "message": message,
        "message_sent": message_sent,
        "blocked_reason": blocked_reason,
    }


def _check_consecutive_low_completion(db: Session, user_id: str,
                                      days: int) -> bool:
    """检查是否连续 N 天完成率 < 30%。"""
    today = _now_cn().date()
    for offset in range(days):
        check_date = today - timedelta(days=offset)
        day_start = datetime(check_date.year, check_date.month,
                            check_date.day, 0, 0, 0)
        day_end = datetime(check_date.year, check_date.month,
                          check_date.day, 23, 59, 59)
        plan = db.scalar(
            select(Plan).where(
                and_(
                    Plan.user_id == user_id,
                    Plan.created_at >= day_start,
                    Plan.created_at <= day_end,
                    Plan.deleted_at.is_(None),
                )
            ).order_by(Plan.created_at.desc())
        )
        if not plan or not plan.stats_json:
            return False
        cr = plan.stats_json.get("completion_rate", 0)
        if isinstance(cr, int):
            cr = float(cr)
        if cr >= 30:
            return False
    return True


def _check_streak_break(db: Session, user_id: str, days: int) -> bool:
    """检查是否连续中断超过 N 天。"""
    today = _now_cn().date()
    break_count = 0
    for offset in range(days):
        check_date = today - timedelta(days=offset)
        day_start = datetime(check_date.year, check_date.month,
                            check_date.day, 0, 0, 0)
        day_end = datetime(check_date.year, check_date.month,
                          check_date.day, 23, 59, 59)
        has_activity = db.scalar(
            select(func.count(EventLog.id)).where(
                and_(
                    EventLog.user_id == user_id,
                    EventLog.created_at >= day_start,
                    EventLog.created_at <= day_end,
                )
            )
        ) or 0
        if has_activity == 0:
            break_count += 1
        else:
            break
    return break_count >= days


def _check_emotion_drop(db: Session, user_id: str, days: int) -> bool:
    """检查情绪是否连续 N 天下降。"""
    today = _now_cn().date()
    prev_score = None
    for offset in range(days - 1, -1, -1):
        check_date = today - timedelta(days=offset)
        date_str = check_date.strftime("%Y-%m-%d")
        es = db.scalar(
            select(EmotionScore).where(
                and_(
                    EmotionScore.user_id == user_id,
                    EmotionScore.score_date == date_str,
                )
            )
        )
        if not es or es.score is None:
            return False
        if prev_score is not None and es.score >= prev_score:
            return False
        prev_score = es.score
    return days > 1


def _check_inactive_days(db: Session, user_id: str, days: int) -> bool:
    """检查是否连续 N 天无任何活动。"""
    today = _now_cn().date()
    for offset in range(days):
        check_date = today - timedelta(days=offset)
        day_start = datetime(check_date.year, check_date.month,
                            check_date.day, 0, 0, 0)
        day_end = datetime(check_date.year, check_date.month,
                          check_date.day, 23, 59, 59)
        has_activity = db.scalar(
            select(func.count(EventLog.id)).where(
                and_(
                    EventLog.user_id == user_id,
                    EventLog.created_at >= day_start,
                    EventLog.created_at <= day_end,
                )
            )
        ) or 0
        if has_activity > 0:
            return False
    return True


# ── 9. 关怀推送引擎 ──

def _check_push_rules(db: Session, user_id: str,
                      push_type: str) -> str | None:
    """检查推送规则，返回 None 表示可推送，否则返回拦截原因。"""
    # 1. 工作时间检查
    if not _is_workday():
        return "non_workday"
    if not _is_business_hours():
        return "night_blocked"

    # 2. 周配额检查
    weekly_used = _count_weekly_pushes(db, user_id)
    if weekly_used >= _MAX_PUSH_PER_WEEK:
        return "weekly_quota_exceeded"

    # 3. 新用户静默期（仅反向关怀）
    if push_type == "negative":
        new_days = _compute_new_user_days(db, user_id)
        if new_days < _NEW_USER_QUIET_DAYS:
            return "new_user_quiet"

    # 4. 关怀模式
    mode = _get_care_mode(db, user_id)
    if mode == "passive":
        return "care_mode_passive"

    return None


def _do_push(db: Session, user_id: str, push_type: str,
             trigger_condition: str, message: str) -> bool:
    """执行推送（写入日志，绝对不发送短信）。"""
    try:
        push_log = CarePushLog(
            user_id=user_id,
            type=push_type,
            trigger_condition=trigger_condition,
            pushed_at=_now_cn(),
        )
        db.add(push_log)
        db.add(EventLog(
            user_id=user_id,
            module="M11",
            event_type=f"care_{push_type}_pushed",
            properties={
                "trigger_condition": trigger_condition,
                "message": message,
            },
            ts=_now_cn(),
        ))
        db.commit()
        logger.info(
            f"Care push sent: user={user_id} type={push_type} "
            f"condition={trigger_condition}"
        )
        return True
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to push care message: {e}")
        return False


def enforce_push_limits(db: Session, user_id: str) -> dict[str, Any]:
    """查询系统级硬限制与当前配额。

    正反向关怀合计 ≤5次/周/用户。
    绝对禁止短信推送。
    """
    weekly_used = _count_weekly_pushes(db, user_id)
    remaining = max(0, _MAX_PUSH_PER_WEEK - weekly_used)
    can_push = (
        remaining > 0
        and _is_workday()
        and _is_business_hours()
        and _get_care_mode(db, user_id) == "active"
    )

    # 下周重置时间
    next_monday = _week_start_cn() + timedelta(days=7)

    return {
        "weekly_used": weekly_used,
        "weekly_limit": _MAX_PUSH_PER_WEEK,
        "remaining": remaining,
        "can_push": can_push,
        "next_reset": next_monday.isoformat(),
    }


def get_care_push_log(db: Session, user_id: str) -> dict[str, Any]:
    """关怀推送历史。"""
    logs = db.scalars(
        select(CarePushLog).where(
            CarePushLog.user_id == user_id
        ).order_by(CarePushLog.pushed_at.desc()).limit(50)
    ).all()

    items = []
    for log in logs:
        items.append({
            "id": log.id,
            "type": log.type or "unknown",
            "trigger_condition": log.trigger_condition or "",
            "message": None,  # 消息存在 EventLog 中，简化处理
            "pushed_at": log.pushed_at.isoformat() if log.pushed_at else "",
            "was_intercepted": log.intercepted_reason is not None,
            "intercepted_reason": log.intercepted_reason,
        })

    quota = enforce_push_limits(db, user_id)

    return {
        "items": items,
        "total": len(items),
        "weekly_used": quota["weekly_used"],
        "weekly_limit": quota["weekly_limit"],
    }


# ── 10. 关怀模式切换 ──

def switch_care_mode(db: Session, user_id: str, mode: str) -> dict[str, Any]:
    """切换关怀模式（active / passive）。

    active: 主动推送（默认）
    passive: 被动查看（用户自行查看）
    """
    previous_mode = _get_care_mode(db, user_id)
    if previous_mode == mode:
        return {
            "mode": mode,
            "previous_mode": previous_mode,
            "changed_at": _now_cn().isoformat(),
        }

    # 更新 user 表的 care_mode 字段
    from ...shared.models.user import User as UserModel
    user = db.scalar(select(UserModel).where(UserModel.id == user_id))
    if user:
        user.care_mode = mode

    db.add(EventLog(
        user_id=user_id,
        module="M11",
        event_type="care_mode_switched",
        properties={"from": previous_mode, "to": mode},
        ts=_now_cn(),
    ))
    db.commit()

    return {
        "mode": mode,
        "previous_mode": previous_mode,
        "changed_at": _now_cn().isoformat(),
    }


# ── 11. 老师架桥 ──

def bridge_teacher(db: Session, user_id: str, industry: str | None = None,
                   problem_area: str | None = None,
                   urgency: str = "normal") -> dict[str, Any]:
    """老师架桥：复合匹配（行业+问题+老师成功率）→ 内置视频辅导。

    匹配准确率 ≥85%。
    用户拒绝后3天内不再推荐。
    """
    # 检查是否在冷却期
    recent_bridge_rejection = db.scalar(
        select(EventLog).where(
            and_(
                EventLog.user_id == user_id,
                EventLog.event_type == "teacher_bridge_rejected",
                EventLog.created_at >= _now_cn() - timedelta(days=_BRIDGE_COOLDOWN_DAYS),
            )
        ).order_by(EventLog.created_at.desc())
    )
    if recent_bridge_rejection:
        return {
            "matched": False,
            "teacher_name": None,
            "teacher_title": None,
            "match_score": 0.0,
            "match_reasons": [],
            "available_slots": [],
            "booking_url": None,
            "video_enabled": True,
            "_note": f"用户{_BRIDGE_COOLDOWN_DAYS}天内拒绝过架桥，冷却中",
        }

    from ...shared.models.user import TeacherProfile, User as UserModel

    # 查询可接单的老师
    teachers = db.scalars(
        select(TeacherProfile).where(
            TeacherProfile.service_status == "可接单"
        )
    ).all()

    if not teachers:
        return {
            "matched": False,
            "teacher_name": None,
            "teacher_title": None,
            "match_score": 0.0,
            "match_reasons": ["当前无可用老师"],
            "available_slots": [],
            "booking_url": None,
            "video_enabled": True,
        }

    # 评分与排序
    scored = []
    for t in teachers:
        score = 0
        reasons = []

        # 获取老师用户信息
        teacher_user = db.scalar(
            select(UserModel).where(UserModel.id == t.teacher_id)
        )
        teacher_name = teacher_user.nickname if teacher_user else "资深导师"
        teacher_title = (
            teacher_user.role if teacher_user and teacher_user.role != "student"
            else "职业规划师"
        )

        # 行业匹配 +40（从 expertise_tags JSON 中查找）
        expertise = t.expertise_tags or {}
        if industry and industry in expertise.get("industries", []):
            score += 40
            reasons.append(f"行业匹配: {industry}")
        elif industry:
            score += 10
            reasons.append("行业近似匹配")

        # 问题领域匹配 +30
        if problem_area and problem_area in expertise.get("problem_areas", []):
            score += 30
            reasons.append(f"专长匹配: {problem_area}")
        elif problem_area and problem_area in str(t.bio or ""):
            score += 15
            reasons.append("问题领域部分匹配")

        # 评分 +20
        if t.rating:
            score += min(20, int(t.rating * 4))  # rating 0-5, 最多+20
            reasons.append(f"评星: {t.rating:.1f}/5.0")

        # urgency 加成
        if urgency == "urgent":
            score += 5
            reasons.append("紧急优先")

        scored.append((score, t, teacher_name, teacher_title, reasons))

    scored.sort(key=lambda x: x[0], reverse=True)
    best_score, best_teacher, best_name, best_title, best_reasons = scored[0]

    # 匹配准确率检查 (≥85%)
    match_accuracy = min(100, best_score)
    matched = match_accuracy >= 85

    # 构建可用时段（基于工作日排期）
    slots = []
    base_date = _now_cn().date()
    for i in range(3):
        slot_date = base_date + timedelta(days=i + 1)
        if slot_date.weekday() < 5:  # 仅工作日
            slots.append({
                "date": slot_date.strftime("%Y-%m-%d"),
                "time": ["09:00-10:00", "14:00-15:00", "16:00-17:00"][i % 3],
                "duration_minutes": 45,
            })

    # 记录事件
    db.add(EventLog(
        user_id=user_id,
        module="M9",
        event_type="teacher_bridge_matched",
        properties={
            "teacher_id": best_teacher.teacher_id,
            "match_score": match_accuracy,
            "industry": industry,
            "problem_area": problem_area,
        },
        ts=_now_cn(),
    ))
    db.commit()

    return {
        "matched": matched,
        "teacher_name": best_name,
        "teacher_title": best_title,
        "match_score": round(float(match_accuracy), 1),
        "match_reasons": best_reasons,
        "available_slots": slots,
        "booking_url": f"/m/video-coaching/{best_teacher.teacher_id}" if matched else None,
        "video_enabled": True,
    }


# ── 12. 移动端摘要 ──

def get_mobile_summary(db: Session, user_id: str) -> dict[str, Any]:
    """移动端友好的摘要卡片。

    包含问候语、完成率、情绪分、快捷操作。
    """
    kpi = get_kpi(db, user_id)
    emotion = calculate_emotion_index(db, user_id)

    # 问候语
    hour = _now_cn().hour
    if hour < 9:
        greeting = "早上好"
    elif hour < 12:
        greeting = "上午好"
    elif hour < 14:
        greeting = "中午好"
    elif hour < 18:
        greeting = "下午好"
    else:
        greeting = "晚上好"

    # 核心洞察
    cr = kpi.get("completion_rate", 0)
    if cr >= 80:
        insight = f"计划完成率 {cr:.0f}%，节奏很棒~"
    elif cr >= 50:
        insight = f"完成率 {cr:.0f}%，稳扎稳打继续保持~"
    else:
        insight = f"完成率 {cr:.0f}%，明天从一件小事开始~"

    # 快捷操作
    quick_actions = [
        {"icon": "📋", "label": "今日计划", "action": "/m/plan/today"},
        {"icon": "📝", "label": "写复盘", "action": "/m/review/write"},
        {"icon": "📊", "label": "看数据", "action": "/m/analytics"},
        {"icon": "💬", "label": "情绪树洞", "action": "/m/emotion"},
    ]

    return {
        "greeting": greeting,
        "completion_rate": kpi.get("completion_rate", 0),
        "today_plan_count": kpi.get("total_tasks", 0),
        "emotion_score": emotion["score"],
        "streak_days": kpi.get("streak_days", 0),
        "main_insight": insight,
        "quick_actions": quick_actions,
        "updated_at": _now_cn().isoformat(),
    }


# ── 13. 语音播报 ──

def voice_broadcast_core_metrics(db: Session, user_id: str,
                                 sections: list[str] | None = None) -> dict[str, Any]:
    """生成移动端语音播报脚本（TTS-ready）。

    包含 KPI、情绪、计划等核心指标的口语化表达。
    """
    if sections is None:
        sections = ["kpi", "emotion", "plan"]

    kpi = get_kpi(db, user_id)
    emotion = calculate_emotion_index(db, user_id)
    cr = kpi.get("completion_rate", 0)

    script_parts = []

    if "greeting" in sections or not script_parts:
        hour = _now_cn().hour
        if hour < 9:
            script_parts.append("早上好，以下是您今天的工作日报。")
        elif hour < 18:
            script_parts.append("您好，以下是您当前的进度概览。")
        else:
            script_parts.append("晚上好，为您播报今天的总结。")

    if "kpi" in sections:
        script_parts.append(
            f"今日计划完成率百分之{int(cr)}，"
            f"已累计产出{kpi.get('sop_count', 0)}条SOP，"
            f"连续使用{kpi.get('streak_days', 0)}天。"
        )

    if "emotion" in sections:
        emo = emotion["score"]
        emo_word = "积极" if emo >= 4 else ("平稳" if emo >= 0 else "略低")
        script_parts.append(
            f"情绪健康指数{emo:.0f}分，状态{emo_word}。"
            f"趋势为{emotion['trend']}。"
        )

    if "plan" in sections:
        if cr >= 80:
            plan_msg = "计划执行非常出色，继续保持~"
        elif cr >= 50:
            plan_msg = "已完成大部分计划，剩下的明天继续加油~"
        else:
            plan_msg = "今天可能有些忙，没关系，明天从最重要的一件事开始~"
        script_parts.append(plan_msg)

    if "encourage" in sections:
        script_parts.append("每一天的积累都在让您变得更强。加油！")

    script = "".join(script_parts)
    break_tag = '<break time="500ms"/>'
    ssml = f"<speak>{break_tag.join(script_parts)}</speak>"

    # 预估时长：约4字/秒
    duration = max(10, len(script) // 4)

    return {
        "script": script,
        "ssml": ssml,
        "duration_estimate": duration,
        "sections_included": sections,
    }


# ═══════════════════════════════════════════════
# 情绪健康指数计算算法 (算法文档 §4.2)
# ═══════════════════════════════════════════════

def calculate_emotion_health_index(user_id: str, daily_scores: list[float], has_crisis: bool = False) -> dict:
    """情绪健康指数 = 综合评分(0-100)

    四因子:
    1. 平均情绪分(权重40%)
    2. 情绪趋势分(权重30%)
    3. 情绪稳定性分(权重20%)
    4. 危机事件惩罚(权重10%)
    """
    if not daily_scores:
        return {"index": 50, "level": "🟡 数据不足", "breakdown": {}}

    n = len(daily_scores)
    avg_score = sum(daily_scores) / n

    # 1. 平均情绪分 (映射 -10~+10 → 0~40)
    norm_avg = (avg_score + 10) / 20 * 40

    # 2. 情绪趋势分 (线性回归斜率, 映射到0~30)
    if n >= 2:
        x_mean = (n - 1) / 2
        y_mean = avg_score
        numerator = sum((i - x_mean) * (daily_scores[i] - y_mean) for i in range(n))
        denominator = sum((i - x_mean) ** 2 for i in range(n))
        slope = numerator / denominator if denominator != 0 else 0
        # 映射 -2~+2 → 0~30
        trend_score = 15 + (slope / 2) * 15
        trend_score = max(0, min(30, trend_score))
    else:
        slope = 0
        trend_score = 15

    # 3. 情绪稳定性分 (标准差越小越高)
    if n >= 2:
        variance = sum((s - avg_score) ** 2 for s in daily_scores) / n
        std_dev = variance ** 0.5
        # std_dev ∈ [0, 5] → [0, 20]
        stability = 20 - (std_dev / 5) * 20
        stability = max(0, min(20, stability))
    else:
        std_dev = 0
        stability = 20

    # 4. 危机事件惩罚
    crisis_penalty = -10 if has_crisis else 10

    total_index = norm_avg + trend_score + stability + crisis_penalty
    total_index = max(0, min(100, total_index))

    # 健康等级
    if total_index >= 80:
        level = "🟢 情绪状态很好"
    elif total_index >= 60:
        level = "🟡 情绪状态一般，要注意调节"
    elif total_index >= 40:
        level = "🟠 情绪状态偏低，建议多关注自己"
    else:
        level = "🔴 需要关注，小耕建议聊聊"

    return {
        "index": round(total_index, 1),
        "level": level,
        "trend": "改善中" if slope > 0.1 else ("下降中" if slope < -0.1 else "稳定"),
        "breakdown": {
            "avg_score": round(norm_avg, 1),
            "trend_score": round(trend_score, 1),
            "stability_score": round(stability, 1),
            "crisis_score": crisis_penalty,
        }
    }


# ═══════════════════════════════════════════════
# 能力分布雷达图计算 (算法文档 §4.2)
# ═══════════════════════════════════════════════

def calculate_capability_radar(metrics: dict) -> dict:
    """6维能力评估(0-100): 规划力/执行力/专业力/学习力/情绪力/求职力

    metrics应包含:
    - plan_completion_rate, plan_continuity_days, total_days
    - sop_quality_avg, qa_resolved_rate
    - kb_growth_rate, kb_query_frequency, cross_module_applications
    - emotion_health_index, emotion_recovery_speed, growth_manual_count
    - resume_match_score, interview_invite_rate, offer_rate
    """
    total_days = max(metrics.get("total_days", 1), 1)

    # 1. 规划力
    plan_completion = metrics.get("plan_completion_rate", 0) * 0.5
    plan_reasonability = 50 * 0.3  # 默认中等合理
    plan_continuity = min(1.0, metrics.get("plan_continuity_days", 0) / total_days) * 100 * 0.2
    planning = min(100, plan_completion + plan_reasonability + plan_continuity)

    # 2. 执行力
    completion = metrics.get("plan_completion_rate", 0) * 0.6
    improvement = metrics.get("improvement_rate", 0) * 0.4
    execution = min(100, completion + improvement)

    # 3. 专业力
    sop_quality = min(100, (metrics.get("sop_quality_avg", 3) / 5) * 100 * 0.4)
    sop_count_score = min(100, metrics.get("sop_count", 0) * 5) * 0.3
    qa_rate = metrics.get("qa_resolved_rate", 0) * 0.3
    professional = min(100, sop_quality + sop_count_score + qa_rate)

    # 4. 学习力
    kb_growth = min(100, metrics.get("kb_growth_rate", 0) * 100) * 0.3
    kb_freq = min(100, metrics.get("kb_query_frequency", 0) * 10) * 0.3
    cross_app = min(100, metrics.get("cross_module_applications", 0) * 5) * 0.4
    learning = min(100, kb_growth + kb_freq + cross_app)

    # 5. 情绪力
    emo_health = metrics.get("emotion_health_index", 50) * 0.5
    emo_recovery = min(100, metrics.get("emotion_recovery_speed", 3) * 20) * 0.3
    emo_manuals = min(100, metrics.get("growth_manual_count", 0) * 10) * 0.2
    emotion = min(100, emo_health + emo_recovery + emo_manuals)

    # 6. 求职力
    resume_match = metrics.get("resume_match_score", 0) * 0.3
    interview_rate = metrics.get("interview_invite_rate", 0) * 0.3
    offer_rate = metrics.get("offer_rate", 0) * 0.4
    career = min(100, resume_match + interview_rate + offer_rate)

    return {
        "dimensions": {
            "planning": round(planning, 1),
            "execution": round(execution, 1),
            "professional": round(professional, 1),
            "learning": round(learning, 1),
            "emotion": round(emotion, 1),
            "career": round(career, 1),
        },
        "avg_score": round((planning + execution + professional + learning + emotion + career) / 6, 1),
    }


# ═══════════════════════════════════════════════
# 正反向关怀决策树 (算法文档 §4.2)
# ═══════════════════════════════════════════════

class CareDecisionTree:
    """决策树: 指标评估 → 关怀策略 → 频率控制 → 内容生成"""

    POSITIVE_TRIGGERS = [
        {"condition": "plan_completion_rate > 0.90", "level": "light",
         "message_template": "姐，这周计划完成率{rate}%，执行得真漂亮！"},
        {"condition": "weekly_sop_count >= 3", "level": "medium",
         "message_template": "姐，这周沉淀了{count}个SOP，您的专业资产越来越厚了！"},
        {"condition": "consecutive_review_days >= 7", "level": "medium",
         "message_template": "姐，您已经连续一周坚持复盘了！这份毅力就是最好的专业素养~"},
        {"condition": "emotion_health_trend > 0.3", "level": "light",
         "message_template": "姐，最近状态越来越好，小耕也替您开心~"},
    ]

    NEGATIVE_TRIGGERS = [
        {"condition": "plan_completion_rate < 0.30", "level": "medium",
         "message_template": "姐，这周完成率不太理想。是最近太忙了，还是计划定得多？小耕帮您分析一下~",
         "action": "suggest_plan_adjustment"},
        {"condition": "emotion_health_continuous_decline >= 7", "level": "medium",
         "message_template": "姐，最近是不是有什么心事？随时可以来树洞跟小耕聊聊~",
         "action": "suggest_emotion_treehole"},
        {"condition": "consecutive_skip_review >= 5", "level": "medium",
         "message_template": "姐，最近是不是特别忙？每天抽5分钟回顾一下，会有意想不到的收获~"},
        {"condition": "emotion_health_index < 40", "level": "high",
         "message_template": "姐，小耕注意到您最近状态不太好。如果不介意的话，要不要跟安老师聊聊？",
         "action": "offer_teacher_bridge"},
        {"condition": "consecutive_inactive_days >= 14", "level": "high",
         "action": "teacher_bridge", "reason": "用户连续14天未使用日耕"},
    ]

    @staticmethod
    def evaluate(condition_str: str, metrics: dict) -> bool:
        """简易条件评估器。"""
        try:
            # 解析 condition_str 如 "plan_completion_rate > 0.90"
            parts = condition_str.split()
            if len(parts) < 3:
                return False
            key = parts[0]
            op = parts[1]
            threshold = float(parts[2])
            value = metrics.get(key, 0)

            if op == ">":
                return value > threshold
            elif op == ">=":
                return value >= threshold
            elif op == "<":
                return value < threshold
            elif op == "<=":
                return value <= threshold
            return False
        except Exception:
            return False

    @staticmethod
    def evaluate_and_get_cares(metrics: dict, current_hour: int = 12,
                                weekly_push_count: int = 0) -> list[dict]:
        """评估指标并返回应触发的关怀列表。"""
        MAX_PER_WEEK = 5
        MIN_INTERVAL_HOURS = 3

        if weekly_push_count >= MAX_PER_WEEK:
            return []

        # 夜间免打扰 (22:00-08:00)
        if current_hour >= 22 or current_hour < 8:
            return []

        cares = []

        # 正向激励（优先检查）
        for trigger in CareDecisionTree.POSITIVE_TRIGGERS:
            if CareDecisionTree.evaluate(trigger["condition"], metrics):
                msg = trigger["message_template"]
                for key, val in metrics.items():
                    if isinstance(val, (int, float)):
                        msg = msg.replace(f"{{{key}}}", str(round(val, 1)))
                        msg = msg.replace(f"{{{key}%}}", f"{round(val)}%")
                cares.append({"type": "positive", "level": trigger["level"], "message": msg})

        # 反向关怀
        for trigger in CareDecisionTree.NEGATIVE_TRIGGERS:
            if CareDecisionTree.evaluate(trigger["condition"], metrics):
                msg = trigger["message_template"]
                for key, val in metrics.items():
                    if isinstance(val, (int, float)):
                        msg = msg.replace(f"{{{key}}}", str(round(val, 1)))
                care = {"type": "negative", "level": trigger["level"], "message": msg}
                if "action" in trigger:
                    care["action"] = trigger["action"]
                cares.append(care)

        return cares
