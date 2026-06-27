"""复盘服务 业务逻辑层（步骤11：暮有复盘全部功能）。

实现：获取今日复盘统计、昨日复盘摘要、保存对话（含温柔坚持检测）、
      保存SOP（含知识库自动归档）、提交诊断、归档、获取周进度、
      获取历史列表、连续未复盘提醒检查。
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from ...shared import errors
from ...shared.database import utcnow
from ...shared.models.knowledge import AuditQueue, Document
from ...shared.models.plan import Plan, PlanTask
from ...shared.models.review import ReviewRecord, REVIEW_STAGES

# ── 温柔坚持：拒绝关键词列表 ──
_REFUSAL_KEYWORDS = [
    "太累了", "不想复盘", "不做了", "明天再说", "没心情",
    "不想做了", "算了", "跳过", "不写了", "改天",
    "不想说", "没时间", "不想回顾", "今天算了",
]

# ── 连续未复盘提醒阈值 ──
_REMINDER_THRESHOLDS = {
    3: {"channel": "push", "level": "gentle", "message": "已经有3天没复盘了，经验不沉淀就溜走了哦~"},
    5: {"channel": "sms", "level": "concerned", "message": "5天未复盘提醒：您的复盘习惯正在中断，小耕想念您了"},
    7: {"channel": "operator", "level": "urgent", "message": "运营官介入：用户已连续7天未复盘"},
}


def _today_range():
    """返回今日 UTC 起止（naive datetime，与 plans 服务保持一致）。"""
    today = datetime.now(timezone.utc).date()
    start = datetime(today.year, today.month, today.day, 0, 0, 0)
    end = datetime(today.year, today.month, today.day, 23, 59, 59)
    return start, end


def _get_or_create_review(db: Session, *, user_id: str) -> ReviewRecord:
    """获取今日复盘记录（不存在则创建）。"""
    start, end = _today_range()
    review = db.scalar(
        select(ReviewRecord).where(
            and_(
                ReviewRecord.user_id == user_id,
                ReviewRecord.created_at >= start,
                ReviewRecord.created_at <= end,
            )
        ).order_by(ReviewRecord.created_at.desc())
    )
    if not review:
        review = ReviewRecord(user_id=user_id)
        db.add(review)
        db.flush()
    return review


def _get_today_plan_summary(db: Session, *, user_id: str) -> dict:
    """获取今日计划统计汇总。"""
    start, end = _today_range()
    plan = db.scalar(
        select(Plan).where(
            and_(
                Plan.user_id == user_id,
                Plan.created_at >= start,
                Plan.created_at <= end,
                Plan.status.in_(["draft", "active", "completed"]),
            )
        ).order_by(Plan.created_at.desc())
    )
    if not plan:
        return {"total_tasks": 0, "completed_tasks": 0, "completion_rate": 0}

    tasks = list(
        db.scalars(
            select(PlanTask).where(PlanTask.plan_id == plan.id)
        )
    )
    total = len(tasks)
    completed = sum(1 for t in tasks if t.status == "completed")
    rate = round(completed / total * 100) if total > 0 else 0
    return {"total_tasks": total, "completed_tasks": completed, "completion_rate": rate}


# ── 温柔坚持：拒绝检测 ──

def _detect_refusal(messages: list[dict]) -> bool:
    """检测用户消息中是否含有拒绝复盘意图。"""
    for msg in messages:
        if msg.get("role") == "user":
            text = msg.get("text", "")
            for keyword in _REFUSAL_KEYWORDS:
                if keyword in text:
                    return True
    return False


def _generate_gentle_persistence_reply(user_message: str) -> str:
    """根据用户拒绝消息生成温柔坚持的回复。"""
    if "累" in user_message:
        return (
            "我知道你今天很累 💙 但正是累的时候，才更需要花3分钟做个简单回顾。"
            "不用写太多，就告诉我今天最重要的一个收获就好~"
        )
    elif "时间" in user_message or "没空" in user_message:
        return (
            "明白你很忙 ⏰ 不过复盘只需要3分钟，把今天的经验沉淀下来，明天就能直接用。"
            "简单说一句今天学了什么也行~"
        )
    elif "心情" in user_message:
        return (
            "心情不好的时候，复盘其实是一种释放 🌿 "
            "把今天的事理一理，明天就是全新的一天。要不要简单聊两句？"
        )
    else:
        return (
            "没关系，我们可以简单一点 🌙 "
            "复盘不一定要很正式，就告诉我今天最有价值的一个发现就好~"
        )


# ── P1 入口页 ──

def get_review_stats(db: Session, *, user_id: str) -> dict:
    """获取今日复盘统计数据。"""
    plan_summary = _get_today_plan_summary(db, user_id=user_id)
    review = _get_or_create_review(db, user_id=user_id)

    return {
        "total_tasks": plan_summary["total_tasks"],
        "completed_tasks": plan_summary["completed_tasks"],
        "completion_rate": plan_summary["completion_rate"],
        "sop_count": 1 if review.sop_title else 0,
        "courage_value": review.courage_value or 0,
        "courage_message": review.courage_message,
        "gentle_persistence_used": review.gentle_persistence_used or False,
    }


def get_yesterday_summary(db: Session, *, user_id: str) -> dict | None:
    """获取昨日复盘摘要。"""
    yesterday = datetime.now(timezone.utc).date() - timedelta(days=1)
    y_start = datetime(yesterday.year, yesterday.month, yesterday.day, 0, 0, 0)
    y_end = datetime(yesterday.year, yesterday.month, yesterday.day, 23, 59, 59)

    review = db.scalar(
        select(ReviewRecord).where(
            and_(
                ReviewRecord.user_id == user_id,
                ReviewRecord.created_at >= y_start,
                ReviewRecord.created_at <= y_end,
            )
        ).order_by(ReviewRecord.created_at.desc())
    )

    if not review:
        return None

    return {
        "sop_title": review.sop_title or "无标题",
        "completion_rate": f"{int(review.completion_rate or 0)}%",
        "courage_value": review.courage_value or 0,
        "archived": review.archived or False,
        "date": review.review_date or yesterday.isoformat(),
    }


# ── P2 对话页辅助 ──

def save_review_message(db: Session, *, user_id: str, stage: str,
                        messages: list[dict], emotion_score: int | None,
                        courage_value: int | None) -> dict:
    """保存复盘对话记录（每个阶段结束时触发）。

    阶段内如果检测到用户拒绝意图，触发温柔坚持机制：
    - 第一次拒绝：标记 gentle_persistence_used=True，返回温柔坚持回复
    - 第二次拒绝（温柔坚持已使用）：尊重用户选择，允许跳过
    """
    review = _get_or_create_review(db, user_id=user_id)
    if emotion_score is not None:
        review.emotion_score = emotion_score
    if courage_value is not None:
        review.courage_value = courage_value
    review.review_date = datetime.now(timezone.utc).date().isoformat()

    # ── 温柔坚持检测 ──
    is_refusal = _detect_refusal(messages)
    gentle_persistence_reply: str | None = None

    if is_refusal and stage in ("greeting",):
        if not review.gentle_persistence_used:
            # 第一次拒绝 → 温柔坚持一次
            review.gentle_persistence_used = True
            # 找到用户的拒绝消息
            user_msg = ""
            for m in messages:
                if m.get("role") == "user":
                    user_msg = m.get("text", "")
                    break
            gentle_persistence_reply = _generate_gentle_persistence_reply(user_msg)
        else:
            # 温柔坚持已用过 → 尊重用户选择
            review.status = "skipped"
            gentle_persistence_reply = "好的，今天先休息吧 🌙 明天再见~"

    db.commit()

    result: dict = {"saved": True, "stage": stage}
    if gentle_persistence_reply:
        result["gentle_persistence"] = {
            "triggered": True,
            "already_used": review.gentle_persistence_used and not is_refusal,
            "reply": gentle_persistence_reply,
            "allow_skip": review.status == "skipped",
        }
    return result


def save_sop(db: Session, *, user_id: str, title: str, steps: list[dict],
             key_phrases: str | None, precautions: str | None) -> dict:
    """生成/保存 SOP，并自动归档到知识库（跨模块数据流：复盘→知识库归档）。"""
    review = _get_or_create_review(db, user_id=user_id)
    review.sop_title = title
    review.sop_steps_json = {"steps": steps}
    review.sop_key_phrases = key_phrases
    review.sop_precautions = precautions
    review.sop_quality_score = min(5, max(1, len(steps)))

    # ── SOP 自动归档到知识库（步骤11 跨模块集成）──
    kb_doc_id: str | None = None
    try:
        content = {
            "sop_title": title,
            "sop_steps": steps,
            "key_phrases": key_phrases,
            "precautions": precautions,
            "quality_score": review.sop_quality_score,
            "source": "evening_review",
            "review_date": review.review_date or datetime.now(timezone.utc).date().isoformat(),
        }
        doc = Document(
            owner_user_id=user_id,
            library_type="private",
            doc_type="sop",
            source_module="M2",  # 暮有复盘
            title=title or "复盘萃取SOP",
            content=content,
            status="draft",
            audit_status="pending",
            is_desensitized=True,  # 复盘内容默认已脱敏
            is_negative_blocked=False,
            vector_status="pending",
            version=1,
        )
        db.add(doc)
        db.flush()

        # 进入待审核区
        now = utcnow()
        db.add(AuditQueue(
            doc_id=doc.id,
            entered_at=now,
            expire_remind_at=now + timedelta(days=30),
        ))
        kb_doc_id = doc.id
    except Exception:
        # 知识库归档失败不阻断SOP保存（降级策略）
        db.rollback()
        # 重新获取review（因为rollback可能使之前的修改失效）
        review2 = _get_or_create_review(db, user_id=user_id)
        review2.sop_title = title
        review2.sop_steps_json = {"steps": steps}
        review2.sop_key_phrases = key_phrases
        review2.sop_precautions = precautions
        review2.sop_quality_score = min(5, max(1, len(steps)))

    db.commit()

    return {
        "id": review.id,
        "title": review.sop_title,
        "steps": steps,
        "key_phrases": review.sop_key_phrases,
        "precautions": review.sop_precautions,
        "quality_score": review.sop_quality_score,
        "kb_doc_id": kb_doc_id,  # 知识库文档ID，验证跨模块数据流
        "created_at": review.created_at.isoformat() if review.created_at else None,
    }


def get_today_sop(db: Session, *, user_id: str) -> dict | None:
    """获取今日生成的 SOP。"""
    review = _get_or_create_review(db, user_id=user_id)
    if not review.sop_title:
        return None
    return {
        "id": review.id,
        "title": review.sop_title,
        "steps": review.sop_steps_json.get("steps", []) if review.sop_steps_json else [],
        "key_phrases": review.sop_key_phrases,
        "precautions": review.sop_precautions,
        "quality_score": review.sop_quality_score,
        "created_at": review.created_at.isoformat() if review.created_at else None,
    }


# ── P3 报告页 ──

def submit_diagnosis(db: Session, *, user_id: str, answers: dict) -> dict:
    """提交诊断问卷。"""
    review = _get_or_create_review(db, user_id=user_id)
    review.diagnosis_json = answers
    db.commit()
    return {"id": review.id, "answers": answers,
            "submitted_at": review.updated_at.isoformat() if review.updated_at else None}


def archive_review(db: Session, *, user_id: str) -> dict:
    """归档今日复盘。"""
    review = _get_or_create_review(db, user_id=user_id)
    review.archived = True

    # 同步计划完成率
    plan_summary = _get_today_plan_summary(db, user_id=user_id)
    review.completion_rate = plan_summary["completion_rate"]

    db.commit()

    return {
        "archived": True,
        "courage_value": review.courage_value or 0,
        "completion_rate": int(review.completion_rate or 0),
        "message": "复盘已归档，明天的你会感谢今天认真的自己 ✨",
    }


# ── P4 历史页 ──

WEEKDAY_LABELS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]


def get_weekly_progress(db: Session, *, user_id: str) -> dict:
    """获取本周复盘进度。"""
    today = datetime.now(timezone.utc).date()
    monday = today - timedelta(days=today.weekday())
    m_start = datetime(monday.year, monday.month, monday.day, 0, 0, 0)
    s_end = datetime(today.year, today.month, today.day, 23, 59, 59)

    reviews = list(
        db.scalars(
            select(ReviewRecord).where(
                and_(
                    ReviewRecord.user_id == user_id,
                    ReviewRecord.created_at >= m_start,
                    ReviewRecord.created_at <= s_end,
                )
            ).order_by(ReviewRecord.created_at)
        )
    )

    # 构建天索引映射
    review_map = {}
    for r in reviews:
        if r.created_at:
            d = r.created_at.date()
            day_index = d.weekday()
            review_map[day_index] = r

    days = []
    today_idx = today.weekday()
    for i in range(7):
        d = monday + timedelta(days=i)
        r = review_map.get(i)
        if r:
            status = "completed" if r.archived or r.status == "completed" else "in_progress"
            completion_rate = int(r.completion_rate or 0)
        elif i < today_idx:
            status = "pending"
            completion_rate = 0
        elif i == today_idx:
            status = "in_progress"
            plan = _get_today_plan_summary(db, user_id=user_id)
            completion_rate = plan["completion_rate"] if plan["total_tasks"] > 0 else 0
        else:
            status = "pending"
            completion_rate = 0

        days.append({
            "day": WEEKDAY_LABELS[i],
            "day_index": i,
            "status": status,
            "completion_rate": completion_rate,
        })

    return {"week_label": f"{monday.month}/{monday.day} - {today.month}/{today.day}", "days": days}


def get_review_history(db: Session, *, user_id: str, limit: int = 30) -> list[dict]:
    """获取历史复盘列表。"""
    reviews = list(
        db.scalars(
            select(ReviewRecord).where(
                ReviewRecord.user_id == user_id
            ).order_by(ReviewRecord.created_at.desc()).limit(limit)
        )
    )

    results = []
    for r in reviews:
        day_str = r.created_at.strftime("%m月%d日") if r.created_at else ""
        weekday = WEEKDAY_LABELS[r.created_at.weekday()] if r.created_at else ""

        results.append({
            "id": r.id,
            "date": day_str,
            "day_of_week": weekday,
            "sop_title": r.sop_title,
            "quality_score": r.sop_quality_score,
            "status": r.status if r.archived or r.sop_title else "skipped",
        })

    return results


# ── 连续未复盘提醒（步骤11：跨服务集成 - 推送服务）──

def get_consecutive_skip_days(db: Session, *, user_id: str) -> int:
    """查询连续未复盘天数（从最近一次复盘至今）。"""
    today = datetime.now(timezone.utc).date()
    t_end = datetime(today.year, today.month, today.day, 23, 59, 59)

    # 从今天往前查，找到最后一次有效复盘
    reviews = list(
        db.scalars(
            select(ReviewRecord).where(
                and_(
                    ReviewRecord.user_id == user_id,
                    ReviewRecord.created_at <= t_end,
                )
            ).order_by(ReviewRecord.created_at.desc()).limit(30)
        )
    )

    if not reviews:
        return 0

    # 计算连续跳过天数
    consecutive = 0
    check_date = today
    # 按日期分组：每天只要有 archived=True 或 sop_title 就不算跳过
    review_dates: dict = {}
    for r in reviews:
        if r.created_at:
            d = r.created_at.date()
            if d not in review_dates:
                review_dates[d] = r

    while check_date >= today - timedelta(days=30):
        r = review_dates.get(check_date)
        if r and (r.archived or r.sop_title):
            # 找到了有效复盘 → 停止计数
            break
        consecutive += 1
        check_date -= timedelta(days=1)

    return consecutive


def check_non_review_reminders(db: Session, *, user_id: str) -> dict:
    """检查连续未复盘天数并返回应触发的提醒信息。

    返回结构：
    {
        "consecutive_skip_days": int,
        "reminders": [
            {"channel": "push/sms/operator", "level": "...", "message": "..."}
        ]
    }
    """
    skip_days = get_consecutive_skip_days(db, user_id=user_id)
    reminders = []

    # 按阈值降序检查，每个阈值返回一条提醒
    for days_threshold in sorted(_REMINDER_THRESHOLDS.keys(), reverse=True):
        if skip_days >= days_threshold:
            reminder = _REMINDER_THRESHOLDS[days_threshold]
            reminders.append({
                "days": skip_days,
                "threshold": days_threshold,
                "channel": reminder["channel"],
                "level": reminder["level"],
                "message": reminder["message"],
            })

    return {
        "consecutive_skip_days": skip_days,
        "reminders": reminders,
        "needs_attention": skip_days >= 3,
    }
