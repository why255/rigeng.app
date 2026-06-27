"""情绪树洞服务 — 核心业务逻辑（步骤14）。

参考已有服务的 patterns：
- plans/reviews: 业务层只写逻辑，调用共享模型
- push_service: 频控/通知
- security_encrypt: 加密/危机日志
"""
from __future__ import annotations

import logging
import random
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from ...shared.config import settings
from ...shared.database import new_uuid
from ...shared.errors import APIError, E_INTERNAL
from ...shared.models.emotion import GrowthRecord
from ...shared.models.security import CourageValue, CrisisLog
from ...shared.models.user import User

logger = logging.getLogger("emotion_service")

# ═══════════════════════════════════════════════
# 小耕共情回复库（离线兜底）
# ═══════════════════════════════════════════════
_XIAOGENG_EMPATHY_REPLIES = [
    {"text": "嗯，小耕在听。这确实不容易，姐，您辛苦了。", "type": "empathy"},
    {"text": "还有呢？这件事让您最难过的点是什么？", "type": "question"},
    {"text": "姐，小耕在，想哭就哭出来吧，没关系的。", "type": "empathy"},
    {"text": "我听到您说的了。有时候，说出来本身就是一种疗愈。", "type": "reflection"},
    {"text": "这种感觉我理解。您已经很勇敢了，能面对这些情绪。", "type": "empathy"},
    {"text": "如果换个角度看这件事，您会怎么想？", "type": "question"},
    {"text": "您的感受是真实且重要的，不需要为此自责。", "type": "empathy"},
    {"text": "经历过这些之后，您觉得自己有什么变化吗？", "type": "reflection"},
    {"text": "姐，能在这种处境下坚持到现在，已经很了不起了。", "type": "empathy"},
    {"text": "有时候烦恼其实是未被拆解的智慧，我们一起慢慢理。", "type": "reflection"},
    {"text": "累了就歇一歇，小耕帮您守着。", "type": "empathy"},
    {"text": "能和我说说，今天是什么让您感到这样？", "type": "question"},
    {"text": "每一种情绪都值得被好好对待，包括您现在这一种。", "type": "reflection"},
    {"text": "嗯，我明白了。这确实不是您的错。", "type": "empathy"},
    {"text": "把情绪说出来，就像把石头从心里搬出来一样。", "type": "reflection"},
]

# 危机关键词
_CRISIS_KEYWORDS = [
    "想死", "不想活", "自杀", "结束生命", "活不下去",
    "没有意义", "消失", "绝望", "自残", "不想存在",
    "死了算了", "活着没意思", "生无可恋",
]


# ═══════════════════════════════════════════════
# 内存存储（MVP阶段；生产环境用 Redis 替代）
# ═══════════════════════════════════════════════
# 活跃会话: session_id → {user_id, started_at, message_count, latest_message_at}
_active_sessions: dict[str, dict[str, Any]] = {}
# 用户当日是否有过倾诉
_user_daily_chat: dict[str, bool] = {}


def _today_str() -> str:
    return date.today().isoformat()


def _week_range() -> tuple[date, date]:
    """返回本周一和本周日的日期。"""
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    sunday = monday + timedelta(days=6)
    return monday, sunday


# ═══════════════════════════════════════════════
# 情绪概览
# ═══════════════════════════════════════════════
def get_today_emotion(db: Session, user_id: str) -> dict[str, Any]:
    """获取今日情绪概览。

    从 emotion_score 表查今日评分，从 courage_value 表查勇气值，
    从活跃会话判断今日是否有倾诉。
    """
    today = _today_str()

    # 查询今日情绪评分
    emotion_score = db.query(
        func.coalesce(func.avg(
            db.query(GrowthRecord.emotion_score).filter(
                GrowthRecord.user_id == user_id,
                GrowthRecord.session_date == today,
            ).scalar_subquery()
        ), 0)
    ).scalar() or 0

    # 更简洁的方式：直接查最高分的 growth_record
    latest_growth = (
        db.query(GrowthRecord)
        .filter(
            GrowthRecord.user_id == user_id,
            GrowthRecord.session_date == today,
        )
        .order_by(desc(GrowthRecord.created_at))
        .first()
    )

    score = latest_growth.emotion_score if latest_growth and latest_growth.emotion_score else 0

    # 查询勇气值
    courage = (
        db.query(CourageValue)
        .filter(CourageValue.user_id == user_id)
        .first()
    )
    courage_val = courage.value if courage else 80

    # 判断今日是否有倾诉（查活跃会话或 growth_record）
    has_chat = _user_daily_chat.get(user_id, False)
    if not has_chat and latest_growth:
        has_chat = True

    # 情绪标签
    mood, mood_emoji = _score_to_mood(score)

    return {
        "mood": mood,
        "mood_emoji": mood_emoji,
        "score": score,
        "courage_value": courage_val,
        "has_today_chat": has_chat,
    }


def _score_to_mood(score: int) -> tuple[str, str]:
    """将 -10~+10 评分映射为情绪标签和 emoji。"""
    if score >= 7:
        return "振奋", "🤩"
    elif score >= 4:
        return "开心", "😊"
    elif score >= 1:
        return "平静", "😌"
    elif score >= -2:
        return "平和", "🙂"
    elif score >= -5:
        return "疲惫", "😔"
    elif score >= -8:
        return "焦虑", "😰"
    else:
        return "低落", "😞"


# ═══════════════════════════════════════════════
# 对话消息管理
# ═══════════════════════════════════════════════
def log_emotion_message(
    user_id: str,
    role: str,
    text: str,
    duration_seconds: int | None = None,
) -> dict[str, Any]:
    """记录一条倾诉对话消息。

    MVP 阶段使用内存存储+标记当日有倾诉；
    生产环境应写入 conversation/message 表。
    """
    # 标记用户当日有倾诉
    _user_daily_chat[user_id] = True

    # 查找或创建会话
    session_id = None
    for sid, sess in _active_sessions.items():
        if sess["user_id"] == user_id:
            session_id = sid
            sess["message_count"] += 1
            sess["latest_message_at"] = datetime.now(timezone.utc).isoformat()
            break

    if session_id is None:
        session_id = new_uuid()
        _active_sessions[session_id] = {
            "user_id": user_id,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "message_count": 1,
            "latest_message_at": datetime.now(timezone.utc).isoformat(),
            "duration_seconds": duration_seconds or 0,
        }

    msg_id = new_uuid()

    logger.info("情绪消息已记录: user=%s role=%s len=%d", user_id[:8], role, len(text))

    return {
        "saved": True,
        "message_id": msg_id,
    }


# ═══════════════════════════════════════════════
# 共情回复
# ═══════════════════════════════════════════════
def generate_suggest(user_message: str) -> dict[str, Any]:
    """生成小耕共情回复。

    MVP 阶段使用本地回复库 + 随机选择；
    生产环境应调用 AI 引擎服务，结合用户历史情绪生成个性化回复。
    """
    # 尝试基于关键词的类型匹配
    question_keywords = ["为什么", "怎么办", "怎么", "该不该", "要不要", "能不能"]
    reflection_keywords = ["我觉得", "我发现", "我意识到", "我明白了", "原来"]

    if any(kw in user_message for kw in question_keywords):
        # 倾向追问
        pool = [r for r in _XIAOGENG_EMPATHY_REPLIES if r["type"] == "question"]
    elif any(kw in user_message for kw in reflection_keywords):
        # 倾向反思
        pool = [r for r in _XIAOGENG_EMPATHY_REPLIES if r["type"] == "reflection"]
    else:
        # 默认共情
        pool = _XIAOGENG_EMPATHY_REPLIES

    if not pool:
        pool = _XIAOGENG_EMPATHY_REPLIES

    chosen = random.choice(pool)

    return {
        "text": chosen["text"],
        "type": chosen["type"],
    }


# ═══════════════════════════════════════════════
# 危机干预
# ═══════════════════════════════════════════════
def detect_crisis(user_message: str) -> bool:
    """检测文本中是否包含危机信号关键词。"""
    return any(kw in user_message for kw in _CRISIS_KEYWORDS)


def trigger_crisis_intervention(
    db: Session,
    user_id: str,
    reason: str | None = None,
) -> dict[str, Any]:
    """触发危机干预。

    1. 记录危机事件（走安全服务）
    2. 返回热线信息给前端弹出
    3. 触发推送通知（如有配置）
    """
    import hashlib

    # 记录危机日志
    user_id_hashed = hashlib.sha256(
        (user_id + "日耕危机日志盐值_2026").encode("utf-8")
    ).hexdigest()[:64]

    crisis_entry = CrisisLog(
        user_id_hashed=user_id_hashed,
        triggered_at=datetime.now(timezone.utc).replace(tzinfo=None),
        crisis_type="keyword_detected",
        intervention_result="hotline_shown",
    )
    db.add(crisis_entry)
    db.commit()

    logger.warning("危机干预已触发: user=%s", user_id[:8])

    return {
        "triggered": True,
        "hotline": "400-161-9995",
        "message": "姐，小耕注意到您可能不太好。如果需要，可以拨打全国24小时心理危机干预热线。",
    }


# ═══════════════════════════════════════════════
# 情绪历史
# ═══════════════════════════════════════════════
def get_weekly_emotion(db: Session, user_id: str) -> dict[str, Any]:
    """获取本周情绪趋势（柱状图数据）。"""
    monday, sunday = _week_range()
    week_label = f"{monday.strftime('%m/%d')} - {sunday.strftime('%m/%d')}"

    day_names = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
    days = []

    for i in range(7):
        day_date = monday + timedelta(days=i)
        day_str = day_date.isoformat()

        # 查当日 growth_record 的评分
        records = (
            db.query(GrowthRecord)
            .filter(
                GrowthRecord.user_id == user_id,
                GrowthRecord.session_date == day_str,
            )
            .all()
        )

        if records:
            scores = [r.emotion_score for r in records if r.emotion_score is not None]
            avg_score = round(sum(scores) / len(scores)) if scores else 0
            days.append({
                "day": day_names[i],
                "day_index": i,
                "score": avg_score,
                "has_record": True,
            })
        else:
            days.append({
                "day": day_names[i],
                "day_index": i,
                "score": 0,
                "has_record": False,
            })

    return {
        "week_label": week_label,
        "days": days,
    }


def get_emotion_history(
    db: Session,
    user_id: str,
    month: str | None = None,
) -> list[dict[str, Any]]:
    """获取情绪历史记录列表。"""
    query = db.query(GrowthRecord).filter(GrowthRecord.user_id == user_id)

    if month == "current":
        today = date.today()
        start_of_month = today.replace(day=1)
        query = query.filter(GrowthRecord.session_date >= start_of_month.isoformat())

    records = (
        query
        .order_by(desc(GrowthRecord.session_date), desc(GrowthRecord.created_at))
        .limit(50)
        .all()
    )

    day_names = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]

    # 按日期分组聚合
    day_map: dict[str, dict] = {}
    for r in records:
        day_key = r.session_date or ""
        if day_key not in day_map:
            try:
                d = date.fromisoformat(day_key)
                dow = day_names[d.weekday()]
            except (ValueError, TypeError):
                dow = ""
            day_map[day_key] = {
                "date": day_key,
                "day_of_week": dow,
                "scores": [],
                "total_duration": 0,
                "growth_count": 0,
            }
        if r.emotion_score is not None:
            day_map[day_key]["scores"].append(r.emotion_score)
        day_map[day_key]["total_duration"] += r.duration_minutes or 0
        day_map[day_key]["growth_count"] += 1

    result = []
    for day_key, agg in day_map.items():
        avg_score = round(sum(agg["scores"]) / len(agg["scores"])) if agg["scores"] else 0
        mood, mood_emoji = _score_to_mood(avg_score)
        result.append({
            "date": agg["date"],
            "day_of_week": agg["day_of_week"],
            "mood": mood,
            "mood_emoji": mood_emoji,
            "duration_minutes": agg["total_duration"],
            "growth_record_count": agg["growth_count"],
            "score": avg_score,
        })

    return result


# ═══════════════════════════════════════════════
# 成长记录
# ═══════════════════════════════════════════════
def get_growth_records(
    db: Session,
    user_id: str,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """获取成长记录列表。"""
    records = (
        db.query(GrowthRecord)
        .filter(GrowthRecord.user_id == user_id)
        .order_by(desc(GrowthRecord.session_date), desc(GrowthRecord.created_at))
        .limit(limit)
        .all()
    )

    return [_growth_record_to_dict(r) for r in records]


def create_growth_record(
    db: Session,
    user_id: str,
    chat_messages: list[dict],
    emotion_score: int,
    courage_value: int,
    duration_minutes: int,
) -> dict[str, Any]:
    """结束倾诉时生成成长记录。

    1. 分析对话内容，确定分类
    2. 生成萃取内容
    3. 生成标签
    4. 更新勇气值
    5. 存储 growth_record
    """
    today = _today_str()

    # 分析分类
    category, category_color = _classify_session(chat_messages)

    # 生成萃取内容
    content = _extract_growth_content(chat_messages, emotion_score, duration_minutes)

    # 生成标签
    tags = _generate_tags(chat_messages, emotion_score, courage_value)

    # 创建成长记录
    record = GrowthRecord(
        user_id=user_id,
        session_date=today,
        category=category,
        category_color=category_color,
        content=content,
        tags=tags,
        emotion_score=emotion_score,
        courage_value=courage_value,
        duration_minutes=duration_minutes,
        conv_id=None,  # MVP: 暂不关联 conversation 表
        is_published=False,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    # 更新勇气值
    courage = db.query(CourageValue).filter(CourageValue.user_id == user_id).first()
    if not courage:
        courage = CourageValue(user_id=user_id, value=80, milestones={})
        db.add(courage)

    # 勇气值变化：倾诉本身 +1~3，情绪改善 +1~5
    delta = min(3, max(1, duration_minutes // 10)) + min(5, max(0, emotion_score + 5) // 3)
    courage.value = min(100, (courage.value or 80) + delta)
    db.commit()

    # 清除当日标记
    _user_daily_chat.pop(user_id, None)

    logger.info("成长记录已生成: user=%s category=%s score=%d", user_id[:8], category, emotion_score)

    return _growth_record_to_dict(record)


def _classify_session(messages: list[dict]) -> tuple[str, str]:
    """根据对话内容分类。

    Returns: (category, category_color)
    """
    all_text = " ".join(m.get("text", "") for m in messages)

    # 简单关键词分类
    growth_keywords = ["成长", "进步", "学习", "提升", "改变", "变得", "更好"]
    cognition_keywords = ["原来", "明白", "意识到", "发现", "想通", "看透", "理解"]
    emotion_keywords = ["难过", "伤心", "焦虑", "生气", "委屈", "烦", "累", "压力"]

    growth_score = sum(1 for kw in growth_keywords if kw in all_text)
    cognition_score = sum(1 for kw in cognition_keywords if kw in all_text)
    emotion_score = sum(1 for kw in emotion_keywords if kw in all_text)

    if growth_score >= cognition_score and growth_score >= emotion_score:
        return "自我成长", "#FFCC80"
    elif cognition_score >= emotion_score:
        return "认知转化", "#9E9E9E"
    else:
        return "情绪调节", "#C03A39"


def _extract_growth_content(
    messages: list[dict],
    emotion_score: int,
    duration_minutes: int,
) -> str:
    """从对话中萃取成长内容。"""
    user_messages = [m.get("text", "") for m in messages if m.get("role") == "user"]

    if not user_messages:
        return "今天的倾诉帮你释放了内心的情绪，每一次表达都是一次自我疗愈。"

    # 取最后几条用户消息作为萃取素材
    recent = user_messages[-3:]
    combined = " ".join(recent)

    # 简单萃取逻辑（生产环境用 AI 模型生成）
    if emotion_score <= -5:
        template = (
            "今天你经历了比较低落的时刻，但你没有选择独自承受，"
            "而是来到这里倾诉。这种面对情绪的勇气本身就是一种成长。"
            f"在{duration_minutes}分钟的倾诉中，你表达了内心的困扰，"
            "这些情绪被看见、被接住，本身就是疗愈的开始。"
        )
    elif emotion_score <= 0:
        template = (
            "今天你坦诚地分享了自己的心事，这是一种可贵的自我关怀。"
            "把混乱的感受说出来，就像整理一个杂乱的房间——"
            "说出来的过程，就是在整理自己的内心。"
            "你的感受是真实且重要的。"
        )
    elif emotion_score <= 5:
        template = (
            "今天的倾诉让你从情绪中看到了一些新的东西。"
            "你能在表达中逐渐找到方向，这说明你内心有很强的复原力。"
            "每一次这样的对话，都是在给自己积累情绪智慧。"
        )
    else:
        template = (
            "今天的对话充满了力量和希望！"
            "你不仅表达了自己的感受，还在过程中找到了新的视角。"
            "这种从情绪中萃取智慧的能力，是你最宝贵的成长资产。"
        )

    return template


def _generate_tags(
    messages: list[dict],
    emotion_score: int,
    courage_value: int,
) -> list[str]:
    """生成成长标签。"""
    tags = []

    all_text = " ".join(m.get("text", "") for m in messages if m.get("role") == "user")

    if courage_value >= 90:
        tags.append("💪 勇气达人")
    elif courage_value >= 70:
        tags.append("💪 勇气+1")

    if emotion_score >= 5:
        tags.append("✨ 情绪韧性+1")
    elif emotion_score <= -3:
        tags.append("🤍 勇敢面对")

    if any(kw in all_text for kw in ["原来", "明白", "意识到", "想通了"]):
        tags.append("💡 认知突破")
    if any(kw in all_text for kw in ["谢谢", "感谢", "感恩"]):
        tags.append("🙏 感恩觉察")
    if any(kw in all_text for kw in ["努力", "坚持", "不放弃"]):
        tags.append("💪 毅力可嘉")

    # 至少一个标签
    if not tags:
        tags.append("💬 小耕陪伴")

    return tags


def _growth_record_to_dict(r: GrowthRecord) -> dict[str, Any]:
    """将 GrowthRecord ORM 对象转为 API 响应字典。"""
    tags = r.tags if isinstance(r.tags, list) else (
        list(r.tags.values()) if isinstance(r.tags, dict) else []
    )
    return {
        "id": r.id,
        "date": r.session_date or "",
        "category": r.category or "情绪调节",
        "category_color": r.category_color or "#C03A39",
        "content": r.content or "",
        "tags": tags,
        "created_at": r.created_at.isoformat() if r.created_at else "",
    }


# ═══════════════════════════════════════════════
# 跨模块联动：次日关怀
# ═══════════════════════════════════════════════
def check_yesterday_crisis(db: Session, user_id: str) -> dict[str, Any]:
    """检查用户昨日是否有危机触发，用于朝有规划开场关怀。

    被 plans 服务的 morning check 调用。
    """
    import hashlib

    yesterday = (date.today() - timedelta(days=1)).isoformat()
    user_id_hashed = hashlib.sha256(
        (user_id + "日耕危机日志盐值_2026").encode("utf-8")
    ).hexdigest()[:64]

    # 查昨日危机日志
    crisis = (
        db.query(CrisisLog)
        .filter(
            CrisisLog.user_id_hashed == user_id_hashed,
            CrisisLog.triggered_at >= f"{yesterday}T00:00:00",
            CrisisLog.triggered_at < f"{date.today().isoformat()}T00:00:00",
        )
        .first()
    )

    if crisis:
        return {
            "had_crisis_yesterday": True,
            "care_message": "姐，小耕看到您昨天可能不太好。今天感觉怎么样？小耕一直在。",
            "crisis_type": crisis.crisis_type,
        }

    # 也检查昨日是否有低落情绪评分
    low_score = (
        db.query(GrowthRecord)
        .filter(
            GrowthRecord.user_id == user_id,
            GrowthRecord.session_date == yesterday,
            GrowthRecord.emotion_score <= -5,
        )
        .first()
    )

    if low_score:
        return {
            "had_crisis_yesterday": False,
            "had_low_mood_yesterday": True,
            "care_message": "姐，昨天看起来有些累呢。今天好点了吗？小耕帮您泡杯热茶~",
        }

    return {
        "had_crisis_yesterday": False,
        "had_low_mood_yesterday": False,
    }
