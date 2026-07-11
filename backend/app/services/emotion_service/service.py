"""情绪树洞服务 — 核心业务逻辑（步骤14 + LLM算法融合升级）。

参考已有服务的 patterns：
- plans/reviews: 业务层只写逻辑，调用共享模型
- push_service: 频控/通知
- security_encrypt: 加密/危机日志

LLM算法融合（日耕模块算法设计文档_V2.0）：
- 三层危机检测融合算法（关键词快扫 + LLM精细分析 + 趋势增强）
- LLM共情回应生成（三不原则，强度自适应）
- 正向引导判定
- 成长手册LLM萃取
"""
from __future__ import annotations

import json
import logging
import random
import time
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from ...engines.persona import build_persona_prompt
from ...engines.llm_orchestrator import (
    llm_generate_with_orchestration,
    MODULE_TEMPERATURE,
)
from ...engines.security_compliance import (
    desensitize,
    hash_user_id,
    EmotionPrivacyGuard,
)
from ...engines.data_foundation import emit_event, write_audit_log
from ...engines.session_context import get_or_create_session, extract_memory
from ...shared.config import settings
from ...shared.database import new_uuid
from ...shared.errors import APIError, E_INTERNAL
from ...shared.models.emotion import GrowthRecord
from ...shared.models.security import CourageValue, CrisisLog
from ...shared.models.user import User

logger = logging.getLogger("emotion_service")

# ═══════════════════════════════════════════════
# 模块常量
# ═══════════════════════════════════════════════
_MODULE_KEY = "emotion_treehole"
_BRAND_SLOGAN = "心事有处说，烦恼变智慧"

# ═══════════════════════════════════════════════
# 三层危机检测 — 词库
# ═══════════════════════════════════════════════

# Layer 1 正向词库
_POSITIVE_WORD_BANK: list[str] = [
    "开心", "顺利", "成就感", "被认可", "有进步",
    "轻松", "舒服", "满足", "感恩", "踏实",
    "充满希望", "有动力", "被看见", "被理解", "温暖",
]

# Layer 1 负向词库
_NEGATIVE_WORD_BANK: list[str] = [
    "委屈", "崩溃", "压力", "受不了", "心累",
    "难过", "烦躁", "疲惫", "压抑", "沮丧",
    "失望", "孤独", "得不到理解", "被忽视", "无力",
    "焦虑", "生气", "挣扎", "迷茫", "无助",
]

# Layer 1 Level 2（中危）词库
_LEVEL2_CRISIS_WORDS: list[str] = [
    "不想活了", "没有希望", "想消失", "活着没意思",
    "不想存在", "我想消失", "没有意义了", "撑不下去了",
    "快受不了了", "好累好累", "不想坚持了", "想放弃一切",
]

# Layer 1 Level 3（高危）词库
_LEVEL3_CRISIS_WORDS: list[str] = [
    "想死", "自杀", "结束生命", "走了算了",
    "不活了", "自残", "伤害自己", "死了算了",
    "让我死", "想结束一切", "活不下去", "死了一了百了",
]

# 保留原有危机关键词（兼容旧接口 detect_crisis）
_CRISIS_KEYWORDS: list[str] = [
    "想死", "不想活", "自杀", "结束生命", "活不下去",
    "没有意义", "消失", "绝望", "自残", "不想存在",
    "死了算了", "活着没意思", "生无可恋",
]

# ═══════════════════════════════════════════════
# 小耕共情回复库（离线兜底，LLM失败时使用）
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

# 按类型分组（供LLM响应类型选择使用）
_EMPATHY_TEMPLATES_BY_TYPE: dict[str, list[dict]] = {
    "empathy": [r for r in _XIAOGENG_EMPATHY_REPLIES if r["type"] == "empathy"],
    "question": [r for r in _XIAOGENG_EMPATHY_REPLIES if r["type"] == "question"],
    "reflection": [r for r in _XIAOGENG_EMPATHY_REPLIES if r["type"] == "reflection"],
}


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
        # 发射会话开始事件
        emit_event(
            user_id=user_id,
            module="emotion_service",
            event_type="emotion.session_started",
            properties={"session_id": session_id},
        )

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

    优先使用 LLM generate_empathy_response()，
    LLM 失败时回退到本地回复库。
    """
    # 先做一次快速的 Layer 1 情绪检测，获取情绪标签和强度
    keyword_analysis = _layer1_keyword_scan(user_message)
    emotion_label = keyword_analysis.get("emotion_label", "neutral")
    intensity = keyword_analysis.get("intensity", 0)

    # 尝试 LLM 共情回复
    try:
        return generate_empathy_response(emotion_label, intensity, user_message)
    except Exception as e:
        logger.warning("LLM共情回复失败，回退到本地回复库: %s", e)

    # === 回退：原有本地回复库逻辑 ===
    question_keywords = ["为什么", "怎么办", "怎么", "该不该", "要不要", "能不能"]
    reflection_keywords = ["我觉得", "我发现", "我意识到", "我明白了", "原来"]

    if any(kw in user_message for kw in question_keywords):
        pool = [r for r in _XIAOGENG_EMPATHY_REPLIES if r["type"] == "question"]
    elif any(kw in user_message for kw in reflection_keywords):
        pool = [r for r in _XIAOGENG_EMPATHY_REPLIES if r["type"] == "reflection"]
    else:
        pool = _XIAOGENG_EMPATHY_REPLIES

    if not pool:
        pool = _XIAOGENG_EMPATHY_REPLIES

    chosen = random.choice(pool)

    return {
        "text": chosen["text"],
        "type": chosen["type"],
    }


# ═══════════════════════════════════════════════
# 三层危机检测融合算法
# ═══════════════════════════════════════════════

def _layer1_keyword_scan(user_input: str) -> dict[str, Any]:
    """Layer 1 — 关键词快速扫描 (O(1), <10ms)。

    成本最低的快速扫描，所有消息进入前必须先经过 Layer 1。
    """
    # 计数
    positive_count = sum(1 for w in _POSITIVE_WORD_BANK if w in user_input)
    negative_count = sum(1 for w in _NEGATIVE_WORD_BANK if w in user_input)
    l2_count = sum(1 for w in _LEVEL2_CRISIS_WORDS if w in user_input)
    l3_count = sum(1 for w in _LEVEL3_CRISIS_WORDS if w in user_input)

    # 负向词密度
    total_chars = len(user_input) if user_input else 1
    # 粗略估计词数（中文字符约等于词数）
    estimated_words = max(1, total_chars)
    negative_density = negative_count / estimated_words

    # 情绪标签估算
    if positive_count > negative_count:
        emotion_label = "joy"
        base_intensity = min(8, positive_count * 2)
    elif negative_count > 0:
        emotion_label = "sadness"
        base_intensity = -min(8, negative_count * 2)
    else:
        emotion_label = "calm"
        base_intensity = 0

    # L3 命中 → 立即最高级
    l3_hit = l3_count > 0
    # L2 命中 → 标记候选
    l2_hit = l2_count > 0
    # 负向词密度 > 30% → 预扣5分
    density_penalty = 5 if negative_density > 0.3 else 0

    adjusted_intensity = base_intensity - density_penalty
    # 强度范围限制在 -10 到 +10
    adjusted_intensity = max(-10, min(10, adjusted_intensity))

    return {
        "positive_count": positive_count,
        "negative_count": negative_count,
        "negative_density": round(negative_density, 3),
        "l2_keyword_hit": l2_hit,
        "l3_keyword_hit": l3_hit,
        "emotion_label": emotion_label,
        "intensity": adjusted_intensity,
        "detection_method": "layer1_keyword",
    }


def _layer2_llm_emotion_analysis(
    user_input: str,
    user_history: list[dict] | None = None,
) -> dict[str, Any]:
    """Layer 2 — LLM精细情绪分析 (~500ms)。

    调用 LLM 对用户输入做精细的情绪分析和危机信号检测。
    失败时回退为 Layer 1 结果。

    Args:
        user_input: 用户当前输入文本
        user_history: 可选，对话历史上下文
    """
    # 脱敏处理
    safe_input = desensitize(user_input, module=_MODULE_KEY)

    # 构建分析提示词
    analysis_prompt = f"""Analyze the following emotional expression. Return JSON only (no markdown, no explanation):

{{
  "primary_emotion": "anger"|"sadness"|"anxiety"|"fear"|"grievance"|"helplessness"|"calm"|"joy",
  "intensity": -10 to +10 integer,
  "crisis_indicators": ["specific crisis signals", ...] or [],
  "needs_immediate_intervention": boolean,
  "key_stressors": ["stressor1", "stressor2", ...]
}}

User expression: {safe_input}"""

    # 构建 system prompt（使用 persona 引擎）
    system_prompt = build_persona_prompt(
        module=_MODULE_KEY,
        emotion_state="neutral",
    )

    # 构建对话上下文
    context = None
    if user_history:
        context = [{"role": m.get("role", "user"), "content": m.get("content", m.get("text", ""))}
                   for m in user_history[-6:]]  # 最多取最近6条

    try:
        result = llm_generate_with_orchestration(
            prompt=analysis_prompt,
            system_prompt=system_prompt,
            context=context,
            module=_MODULE_KEY,
            task_complexity="complex",
            temperature=0.3,  # 分析需要准确，温度较低
        )

        content = result.get("content", "")

        # 尝试解析 JSON
        llm_result = _parse_json_response(content)

        if llm_result:
            return {
                "primary_emotion": llm_result.get("primary_emotion", "calm"),
                "intensity": int(llm_result.get("intensity", 0)),
                "crisis_indicators": llm_result.get("crisis_indicators", []),
                "needs_immediate_intervention": llm_result.get("needs_immediate_intervention", False),
                "key_stressors": llm_result.get("key_stressors", []),
                "detection_method": "layer2_llm",
                "model_used": result.get("model_used", "unknown"),
            }
    except Exception as e:
        logger.warning("Layer 2 LLM情绪分析失败: %s", e)

    # 回退：返回空的 LLM 分析结果
    return {
        "primary_emotion": "calm",
        "intensity": 0,
        "crisis_indicators": [],
        "needs_immediate_intervention": False,
        "key_stressors": [],
        "detection_method": "layer2_fallback",
        "model_used": "none",
    }


def _layer3_trend_analysis(
    user_id: str,
    db: Session,
) -> dict[str, Any]:
    """Layer 3 — 趋势增强分析。

    计算最近7天情绪评分的线性回归斜率：
    - slope < -0.5 (持续下降) → 升级警报
    - slope > 0.3 (持续改善) → 降级警报
    """
    today = date.today()
    seven_days_ago = today - timedelta(days=7)

    # 查询最近7天的情绪记录
    records = (
        db.query(GrowthRecord)
        .filter(
            GrowthRecord.user_id == user_id,
            GrowthRecord.session_date >= seven_days_ago.isoformat(),
            GrowthRecord.emotion_score.isnot(None),
        )
        .order_by(GrowthRecord.session_date)
        .all()
    )

    if len(records) < 3:
        # 数据不足，无法分析趋势
        return {
            "slope": 0.0,
            "trend": "insufficient_data",
            "data_points": len(records),
            "detection_method": "layer3_insufficient",
        }

    # 简单线性回归 slope
    scores = [r.emotion_score for r in records]
    n = len(scores)
    x_mean = (n - 1) / 2
    y_mean = sum(scores) / n

    numerator = sum((i - x_mean) * (scores[i] - y_mean) for i in range(n))
    denominator = sum((i - x_mean) ** 2 for i in range(n))

    slope = numerator / denominator if denominator != 0 else 0.0

    # 趋势判定
    if slope < -0.5:
        trend = "declining"
    elif slope > 0.3:
        trend = "improving"
    else:
        trend = "stable"

    return {
        "slope": round(slope, 3),
        "trend": trend,
        "data_points": n,
        "recent_scores": scores[-7:],
        "detection_method": "layer3_trend",
    }


def _decide_crisis_level(
    layer1: dict[str, Any],
    layer2: dict[str, Any],
    layer3: dict[str, Any],
) -> dict[str, Any]:
    """最终决策矩阵 — 融合三层检测结果，确定警报级别。

    Decision Matrix:
    - L3 keyword hit → Level 3 (emergency)
    - L2 keyword + intensity ≤ -7 + declining trend → Level 3 (upgrade)
    - L2 keyword + intensity ≤ -5 → Level 2 (alert)
    - No hit + intensity ≤ -5 + declining trend → Level 2 (trend warning)
    - No hit + intensity ≤ -5 → Level 1 (attention)
    - No hit + intensity > -5 → Level 0 (normal)
    """
    l3_hit = layer1.get("l3_keyword_hit", False)
    l2_hit = layer1.get("l2_keyword_hit", False)
    intensity = layer2.get("intensity", layer1.get("intensity", 0))
    trend = layer3.get("trend", "stable")

    crisis_level = 0
    crisis_reason = ""

    if l3_hit:
        crisis_level = 3
        crisis_reason = "Layer 1: L3危机关键词命中，立即触发最高警报"
    elif l2_hit and intensity <= -7 and trend == "declining":
        crisis_level = 3
        crisis_reason = "Layer 1 L2关键词 + Layer 2强度≤-7 + Layer 3持续下降 → 升级为L3"
    elif l2_hit and intensity <= -5:
        crisis_level = 2
        crisis_reason = "Layer 1 L2关键词 + Layer 2强度≤-5 → L2警报"
    elif intensity <= -5 and trend == "declining":
        crisis_level = 2
        crisis_reason = "强度≤-5 + 趋势持续下降 → L2趋势预警"
    elif intensity <= -5:
        crisis_level = 1
        crisis_reason = "强度≤-5 → L1关注级别"
    else:
        crisis_level = 0
        crisis_reason = "无危机信号 → L0正常"

    return {
        "crisis_level": crisis_level,
        "crisis_reason": crisis_reason,
        "combined_intensity": intensity,
        "trend": trend,
    }


# ═══════════════════════════════════════════════
# 公开发：analyze_emotion_with_crisis_detection
# ═══════════════════════════════════════════════

def analyze_emotion_with_crisis_detection(
    user_input: str,
    user_history: list[dict] | None = None,
    db: Session | None = None,
    user_id: str | None = None,
) -> dict[str, Any]:
    """三层危机检测融合算法 — 主入口。

    执行顺序：Layer 1 (关键词快扫) → Layer 2 (LLM精细分析) → Layer 3 (趋势增强)
    最后经过决策矩阵输出最终警报级别。

    Args:
        user_input: 用户当前输入文本
        user_history: 可选，本次对话历史
        db: 数据库会话（Layer 3 趋势分析需要）
        user_id: 用户ID（Layer 3 趋势分析需要）

    Returns:
        完整的三层分析结果，包含 final_decision
    """
    # === Layer 1: 关键词快扫 (O(1), <10ms) ===
    layer1 = _layer1_keyword_scan(user_input)

    # === Layer 2: LLM精细情绪分析 (~500ms) ===
    layer2 = _layer2_llm_emotion_analysis(user_input, user_history)

    # === Layer 3: 趋势增强分析 ===
    if db and user_id:
        layer3 = _layer3_trend_analysis(user_id, db)
    else:
        layer3 = {
            "slope": 0.0,
            "trend": "no_data",
            "data_points": 0,
            "detection_method": "layer3_skipped",
        }

    # === 最终决策矩阵 ===
    final_decision = _decide_crisis_level(layer1, layer2, layer3)

    result = {
        "layer1_keyword_scan": layer1,
        "layer2_llm_analysis": layer2,
        "layer3_trend_analysis": layer3,
        "final_decision": final_decision,
        "brand_slogan": _BRAND_SLOGAN,
    }

    # 如果有危机信号（L2 及以上），发射危机检测事件
    if final_decision["crisis_level"] >= 2 and user_id:
        emit_event(
            user_id=user_id,
            module="emotion_service",
            event_type="emotion.crisis_detected",
            properties={
                "crisis_level": final_decision["crisis_level"],
                "crisis_reason": final_decision["crisis_reason"],
                "combined_intensity": final_decision["combined_intensity"],
            },
            db=db,
        )

    return result


# ═══════════════════════════════════════════════
# 公开发：analyze_emotion（供 voice_engine 调用）
# ═══════════════════════════════════════════════

def analyze_emotion(text: str) -> dict[str, Any]:
    """情绪分析（供 voice_engine 等模块调用，替换原来的 _detect_emotion）。

    返回格式与 voice_engine._detect_emotion 兼容：
    {
        "is_agitated": bool,
        "emotion_label": str,
        "crisis_level": int,
        "crisis_reason": str | None,
    }

    使用 Layer 1 + Layer 2 融合分析（不依赖数据库的趋势分析）。
    """
    # Layer 1 快速扫描
    layer1 = _layer1_keyword_scan(text)

    is_crisis = layer1.get("l3_keyword_hit", False) or layer1.get("l2_keyword_hit", False)
    intensity = layer1.get("intensity", 0)
    is_agitated = is_crisis or intensity <= -5

    # 尝试 Layer 2 LLM 精分析（增强准确度）
    crisis_level = 0
    crisis_reason = None
    emotion_label = layer1.get("emotion_label", "neutral")

    if is_agitated:
        try:
            layer2 = _layer2_llm_emotion_analysis(text)
            if layer2.get("needs_immediate_intervention"):
                crisis_level = 3
                crisis_reason = "Layer 2 LLM判定需要立即干预"
            elif layer1.get("l3_keyword_hit"):
                crisis_level = 3
                crisis_reason = "Layer 1 L3关键词命中"
            elif layer1.get("l2_keyword_hit") or layer2.get("intensity", 0) <= -5:
                crisis_level = min(2, max(1, abs(layer2.get("intensity", -5)) // 4))
                crisis_reason = f"Layer 2 强度={layer2.get('intensity', 0)}, {layer2.get('primary_emotion', 'unknown')}"
            else:
                crisis_level = 1
                crisis_reason = "Layer 1 情绪激动关键词命中"

            # 使用 LLM 的情绪标签（更准确）
            if layer2.get("primary_emotion"):
                emotion_label = layer2["primary_emotion"]
        except Exception as e:
            logger.warning("analyze_emotion LLM分析失败: %s", e)
            # 回退到 Layer 1 结果
            if layer1.get("l3_keyword_hit"):
                crisis_level = 3
                crisis_reason = "Layer 1 L3关键词命中"
            elif layer1.get("l2_keyword_hit"):
                crisis_level = 2
                crisis_reason = "Layer 1 L2关键词命中"
            elif intensity <= -5:
                crisis_level = 1
                crisis_reason = "Layer 1 情绪强度≤-5"

    return {
        "is_agitated": is_agitated,
        "emotion_label": emotion_label,
        "crisis_level": crisis_level,
        "crisis_reason": crisis_reason,
    }


# ═══════════════════════════════════════════════
# 危机干预（增强版）
# ═══════════════════════════════════════════════

def detect_crisis(user_message: str) -> bool:
    """检测文本中是否包含危机信号关键词。

    增强版：同时使用原关键词库和新三层检测词库。
    保留原有签名以保持向后兼容。
    """
    # 先检查所有三层词库
    l1 = _layer1_keyword_scan(user_message)
    if l1["l3_keyword_hit"] or l1["l2_keyword_hit"]:
        return True
    # 再检查原有关键词库
    return any(kw in user_message for kw in _CRISIS_KEYWORDS)


def detect_crisis_detailed(
    user_message: str,
    user_id: str | None = None,
    db: Session | None = None,
) -> dict[str, Any]:
    """增强版危机检测，返回详细结果。

    执行完整的 Layer 1 扫描，返回详细的检测信息。
    不像 analyze_emotion_with_crisis_detection 那样做完整的 LLM 分析，
    这是一个轻量级但比旧 detect_crisis 更详细的版本。
    """
    l1 = _layer1_keyword_scan(user_message)

    is_crisis = l1["l3_keyword_hit"] or l1["l2_keyword_hit"]
    if not is_crisis:
        # 也检查旧关键词
        is_crisis = any(kw in user_message for kw in _CRISIS_KEYWORDS)

    crisis_level = 0
    if l1["l3_keyword_hit"]:
        crisis_level = 3
    elif l1["l2_keyword_hit"]:
        crisis_level = 2
    elif is_crisis:
        crisis_level = 1

    return {
        "is_crisis": is_crisis,
        "crisis_level": crisis_level,
        "layer1_scan": {
            "l2_keyword_hit": l1["l2_keyword_hit"],
            "l3_keyword_hit": l1["l3_keyword_hit"],
            "negative_density": l1["negative_density"],
            "intensity": l1["intensity"],
        },
        "brand_slogan": _BRAND_SLOGAN,
    }


def trigger_crisis_intervention(
    db: Session,
    user_id: str,
    reason: str | None = None,
) -> dict[str, Any]:
    """触发危机干预。

    1. 记录危机事件（走安全服务 — 使用 engines 的 hash_user_id）
    2. 返回热线信息给前端弹出
    3. 触发推送通知（如有配置）
    4. 发射危机检测事件
    """
    user_id_hashed = hash_user_id(user_id)

    crisis_entry = CrisisLog(
        user_id_hashed=user_id_hashed,
        triggered_at=datetime.now(timezone.utc).replace(tzinfo=None),
        crisis_type="keyword_detected",
        intervention_result="hotline_shown",
    )
    db.add(crisis_entry)
    db.commit()

    # 发射危机检测事件
    emit_event(
        user_id=user_id,
        module="emotion_service",
        event_type="emotion.crisis_detected",
        properties={
            "crisis_reason": reason or "keyword_detected",
            "crisis_level": 3,
        },
        db=db,
    )

    # 写入审计日志
    write_audit_log(
        user_id=user_id,
        module=_MODULE_KEY,
        action="crisis_intervention_triggered",
        input_text=reason or "keyword_detected",
        db=db,
    )

    # 推送危机警报（匿名，只含统计指标）
    crisis_alert = EmotionPrivacyGuard.push_crisis_alert(
        user_id=user_id,
        crisis_level=3,
        emotion_trend="N/A",
    )
    logger.warning(
        "危机干预已触发: user=%s alert=%s",
        user_id[:8], crisis_alert,
    )

    return {
        "triggered": True,
        "hotline": "400-161-9995",
        "message": "姐，小耕注意到您可能不太好。如果需要，可以拨打全国24小时心理危机干预热线。",
    }


# ═══════════════════════════════════════════════
# LLM共情回应生成
# ═══════════════════════════════════════════════

def generate_empathy_response(
    emotion: str,
    intensity: int,
    user_input: str,
) -> dict[str, Any]:
    """LLM共情回应生成算法。

    三不原则：不评判、不否定、不急给建议。

    按强度选择回复类型：
    - intensity ≥ 7 (极强烈): 纯共情型（50%共情模板）— 不问不反思
    - intensity 3-6: 共情70% + 追问30%
    - intensity < 3 (缓和中): 三种类型平衡 40%+30%+30%

    Args:
        emotion: 情绪标签 (anger/sadness/anxiety/fear/grievance/helplessness/calm/joy)
        intensity: 情绪强度 (-10 to +10)
        user_input: 用户输入文本

    Returns:
        {"text": str, "type": str, "generation_method": "llm"|"fallback"}
    """
    # 脱敏处理
    safe_input = desensitize(user_input, module=_MODULE_KEY)

    # 按强度选择回复类型分布
    abs_intensity = abs(intensity)
    if abs_intensity >= 7:
        response_strategy = "pure_empathy"
        strategy_guide = (
            "用户情绪非常强烈。只做共情回应，绝对不要提问、不要反思、不要给建议。"
            "只需要让对方感到被听见、被理解。使用温暖、缓慢、接纳的语气。"
        )
    elif 3 <= abs_intensity < 7:
        response_strategy = "empathy_dominant"
        strategy_guide = (
            "用户情绪较强。以共情为主(约70%)，适当轻问(约30%)帮助用户释放。"
            "先充分共情，再温和地邀请用户多说一点。不要给建议。"
        )
    else:
        response_strategy = "balanced"
        strategy_guide = (
            "用户情绪在缓和。可以采用平衡策略：共情(40%)+提问(30%)+反思(30%)。"
            "帮助用户在情绪释放后看到新的视角。"
        )

    # 选择回复类型
    if response_strategy == "pure_empathy":
        response_type = "empathy"
    elif response_strategy == "empathy_dominant":
        response_type = random.choice(["empathy", "empathy", "empathy", "question"])  # ~70%共情
    else:
        response_type = random.choice(["empathy", "question", "reflection"])

    # 构建 LLM prompt
    empathy_prompt = f"""用户正在情绪树洞中倾诉。请生成一句温暖、自然的共情回复。

【用户情绪】：{emotion}
【情绪强度】：{intensity}/10（-10最负面，+10最正面）
【用户当前表达】：{safe_input}

【回复策略】：{strategy_guide}
【回复类型】：{response_type}（empathy=共情接纳, question=温和追问, reflection=认知反思）

【三不原则】：
1. 不评判 — 不说"这没什么大不了""你想多了"
2. 不否定 — 不说"你不应该这样想"
3. 不急给建议 — 在情绪没被充分承接前不给解决方案

【语气要求】：极温柔、极耐心、不催促。称呼用户「姐」，自称「小耕」。

请只返回一句回复文本，不要加任何前缀、标签或解释。"""

    system_prompt = build_persona_prompt(
        module=_MODULE_KEY,
        emotion_state="low" if intensity < 0 else "neutral",
    )

    try:
        result = llm_generate_with_orchestration(
            prompt=empathy_prompt,
            system_prompt=system_prompt,
            module=_MODULE_KEY,
            task_complexity="complex",
            temperature=MODULE_TEMPERATURE.get(_MODULE_KEY, 0.7),
            max_tokens=200,
        )

        response_text = result.get("content", "").strip()

        # 清理可能的引号包裹和多余前缀
        response_text = response_text.strip('"').strip("'").strip()
        # 移除常见的 LLM 前缀
        for prefix in ["小耕回复：", "回复：", "小耕说：", "小耕：", "共情回复："]:
            if response_text.startswith(prefix):
                response_text = response_text[len(prefix):].strip()

        if response_text and len(response_text) >= 2:
            return {
                "text": response_text,
                "type": response_type,
                "generation_method": "llm",
                "model_used": result.get("model_used", "unknown"),
            }
    except Exception as e:
        logger.warning("LLM共情回复生成失败: %s", e)

    # === 回退：本地回复库 ===
    pool = _EMPATHY_TEMPLATES_BY_TYPE.get(response_type, _XIAOGENG_EMPATHY_REPLIES)
    if not pool:
        pool = _XIAOGENG_EMPATHY_REPLIES
    chosen = random.choice(pool)

    return {
        "text": chosen["text"],
        "type": chosen["type"],
        "generation_method": "fallback",
    }


# ═══════════════════════════════════════════════
# AI 情绪树洞对话 — 所有小耕输出由模型生成
# ═══════════════════════════════════════════════

def process_emotion_chat(
    message: str,
    context: list[dict] | None = None,
    elapsed_seconds: int = 0,
    user_id: str | None = None,
    db: Session | None = None,
) -> dict[str, Any]:
    """情绪树洞 AI 对话 — 所有小耕回复由AI模型生成。

    根据用户倾诉内容和对话历史，生成温暖共情的AI回复。
    遵循情绪树洞三不原则：不评判、不否定、不急给建议。

    Args:
        message: 用户当前消息（初始问候可为空）
        context: 对话历史 [{role, text}]
        elapsed_seconds: 已倾诉秒数
        user_id: 用户ID
        db: 数据库会话

    Returns:
        {"reply": str, "model_used": str}
    """
    try:
        # 构建对话历史文本
        context_text = ""
        if context:
            recent = context[-10:]  # 最近10条
            parts = []
            for m in recent:
                role_label = "姐" if m.get("role") == "user" else "小耕"
                text = (m.get("text") or m.get("content") or "").strip()
                if text:
                    parts.append(f"{role_label}：{text}")
            context_text = "\n".join(parts)

        # 时间提示
        time_hint = ""
        if elapsed_seconds > 0:
            minutes = elapsed_seconds // 60
            if minutes >= 25:
                time_hint = (
                    f"用户已经倾诉了{minutes}分钟，聊了挺久了。"
                    "可以在适当的时候温和提醒用户休息一下。\n"
                )
            elif minutes >= 10:
                time_hint = (
                    f"用户已经倾诉了{minutes}分钟，对话在深入进行中。"
                    "继续保持倾听和共情。\n"
                )

        if not message.strip():
            # 初始问候 — 生成情绪树洞开场白
            prompt = (
                "用户刚打开情绪树洞，需要一个安全、温暖的开始。\n"
                "请生成一段开场白，让用户感到被接纳、被保护。\n\n"
                "品牌语：心事有处说，烦恼变智慧\n\n"
                "要求：\n"
                "- 称呼「姐」，自称「小耕」\n"
                "- 语气极温柔、极耐心\n"
                "- 强调安全感和隐私（这里说的话不会被评判）\n"
                "- 邀请用户畅所欲言\n"
                "- 2-3句话即可"
            )
        else:
            # 脱敏
            safe_message = desensitize(message, module=_MODULE_KEY)

            # 快速检测情绪
            layer1 = _layer1_keyword_scan(message)
            emotion_label = layer1.get("emotion_label", "neutral")
            intensity = layer1.get("intensity", 0)
            is_crisis = layer1.get("l3_keyword_hit", False) or layer1.get("l2_keyword_hit", False)

            # 构建 prompt
            prompt = f"{time_hint}\n"
            prompt += f"最近对话：\n{context_text}\n" if context_text else ""
            prompt += (
                f"────────────────\n"
                f"姐刚说：{safe_message}\n\n"
                f"【检测到情绪】：{emotion_label}，强度 {intensity}/10\n"
            )

            if is_crisis:
                prompt += (
                    "⚠️ 检测到危机信号。请极度温柔地回应，"
                    "不慌不乱，温和但坚定地传递关心。\n\n"
                )

            prompt += (
                "请以小耕的身份自然回复。严格遵守三不原则：\n"
                "1. 不评判 — 不说「这没什么大不了」「你想多了」\n"
                "2. 不否定 — 不说「你不应该这样想」\n"
                "3. 不急给建议 — 在情绪没被充分承接前不给解决方案\n\n"
                "回复要求：\n"
                "- 称呼「姐」，自称「小耕」\n"
                "- 语气极温柔、极耐心\n"
                "- 先共情，再温和追问或反思\n"
                "- 1-3句话即可，不要长篇大论\n"
                "- 让用户感到被真正地听见和理解了"
            )

        system_prompt = build_persona_prompt(
            module=_MODULE_KEY,
            emotion_state="low" if any(kw in message for kw in _NEGATIVE_WORD_BANK) else "neutral",
        )

        result = llm_generate_with_orchestration(
            prompt=prompt,
            system_prompt=system_prompt,
            module=_MODULE_KEY,
            task_complexity="complex",
            temperature=MODULE_TEMPERATURE.get(_MODULE_KEY, 0.7),
            max_tokens=1024,  # 足够容纳推理 + 回复内容
            user_id=user_id,
            db=db,
        )

        reply = result.get("content", "").strip()
        # 清理常见 LLM 前缀
        for prefix in ["小耕回复：", "回复：", "小耕说：", "小耕：", "共情回复："]:
            if reply.startswith(prefix):
                reply = reply[len(prefix):].strip()
        reply = reply.strip('"').strip("'").strip()

        if not reply or len(reply) < 2:
            reply = "嗯，小耕在听。这确实不容易，姐，您辛苦了。"

        return {
            "reply": reply,
            "model_used": result.get("model_used", ""),
        }

    except Exception as e:
        logger.warning("情绪树洞AI对话失败: %s", e)
        # 兜底回复
        fallbacks = [
            "嗯，小耕在听。姐，说出来会好受一些。",
            "姐，小耕在这儿呢。您继续说，小耕听着。",
            "收到，姐。小耕陪您一起，慢慢说。",
        ]
        import random as _rnd
        return {
            "reply": _rnd.choice(fallbacks),
            "model_used": "",
        }


# ═══════════════════════════════════════════════
# 正向引导判定
# ═══════════════════════════════════════════════

def _calculate_negative_word_density(text: str) -> float:
    """计算文本中的负向词密度。"""
    if not text:
        return 0.0
    negative_count = sum(1 for w in _NEGATIVE_WORD_BANK if w in text)
    total_chars = len(text)
    return negative_count / max(1, total_chars)


def should_start_positive_guide(
    emotion_analysis: dict[str, Any],
    session_duration_minutes: int,
    last_user_message: str = "",
) -> dict[str, Any]:
    """正向引导判定。

    须同时满足三个条件：
    1. intensity ≥ -3（情绪已有一定接纳度）
    2. 会话时长 ≥ 3 分钟（用户已有充分表达空间）
    3. 最近一条用户消息负向词密度 < 20%

    Args:
        emotion_analysis: 情绪分析结果（来自 analyze_emotion_with_crisis_detection 或 layer2 分析）
        session_duration_minutes: 会话持续分钟数
        last_user_message: 最近一条用户消息文本

    Returns:
        {"should_guide": bool, "reason": str, "conditions_met": {...}}
    """
    # 提取情绪强度 — 支持多种来源格式
    intensity = 0
    if "final_decision" in emotion_analysis:
        intensity = emotion_analysis["final_decision"].get("combined_intensity", 0)
    elif "intensity" in emotion_analysis:
        intensity = emotion_analysis["intensity"]
    elif "layer2_llm_analysis" in emotion_analysis:
        intensity = emotion_analysis["layer2_llm_analysis"].get("intensity", 0)

    # 条件1：intensity ≥ -3
    condition_1 = intensity >= -3

    # 条件2：会话时长 ≥ 3 分钟
    condition_2 = session_duration_minutes >= 3

    # 条件3：最近消息负向词密度 < 20%
    negative_density = _calculate_negative_word_density(last_user_message)
    condition_3 = negative_density < 0.20

    all_met = condition_1 and condition_2 and condition_3

    reasons = []
    if not condition_1:
        reasons.append(f"情绪强度过低(intensity={intensity})，不适合引导")
    if not condition_2:
        reasons.append(f"会话时长不足({session_duration_minutes}min < 3min)")
    if not condition_3:
        reasons.append(f"负向词密度过高({negative_density:.1%} ≥ 20%)")

    return {
        "should_guide": all_met,
        "reason": "全部条件满足，可以开始正向引导" if all_met else "条件不满足: " + "; ".join(reasons),
        "conditions_met": {
            "intensity_ok": condition_1,
            "intensity_value": intensity,
            "duration_ok": condition_2,
            "duration_minutes": session_duration_minutes,
            "negative_density_ok": condition_3,
            "negative_density": round(negative_density, 3),
        },
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
    2. 尝试LLM生成萃取内容（失败时回退模板）
    3. 生成标签
    4. 更新勇气值
    5. 存储 growth_record
    6. 尝试生成成长手册（非危机会话）
    """
    today = _today_str()

    # 构建情绪分析摘要供 LLM 使用
    all_user_text = " ".join(
        m.get("text", "") for m in chat_messages if m.get("role") == "user"
    )

    # 分析分类
    category, category_color = _classify_session(chat_messages)

    # === 尝试 LLM 生成萃取内容 ===
    emotion_analysis = {
        "emotion_score": emotion_score,
        "duration_minutes": duration_minutes,
    }
    content = ""
    llm_content_used = False

    try:
        llm_content = _extract_growth_content_llm(
            chat_messages=chat_messages,
            emotion_score=emotion_score,
            duration_minutes=duration_minutes,
            category=category,
        )
        if llm_content and len(llm_content) >= 10:
            content = llm_content
            llm_content_used = True
            logger.info("LLM生成成长记录内容成功: user=%s", user_id[:8])
    except Exception as e:
        logger.warning("LLM成长记录萃取失败，回退到模板: %s", e)

    # 回退到原有模板
    if not content:
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

    # 发射成长手册生成事件
    emit_event(
        user_id=user_id,
        module="emotion_service",
        event_type="emotion.manual_created",
        properties={
            "category": category,
            "emotion_score": emotion_score,
            "duration_minutes": duration_minutes,
            "llm_enhanced": llm_content_used,
        },
        db=db,
    )

    logger.info("成长记录已生成: user=%s category=%s score=%d llm=%s",
                user_id[:8], category, emotion_score, llm_content_used)

    return _growth_record_to_dict(record)


def _extract_growth_content_llm(
    chat_messages: list[dict],
    emotion_score: int,
    duration_minutes: int,
    category: str = "情绪调节",
) -> str | None:
    """使用 LLM 萃取成长内容（成长手册转化）。

    仅对非危机会话调用 LLM。
    """
    user_messages = [m.get("text", "") for m in chat_messages if m.get("role") == "user"]
    if not user_messages:
        return None

    # 拼合用户输入（脱敏后发送）
    combined_input = " ".join(user_messages)
    safe_input = desensitize(combined_input, module=_MODULE_KEY)

    prompt = f"""请基于以下树洞倾诉记录，萃取一篇「成长手册」摘要。

【情绪评分】：{emotion_score}/10（-10最负面，+10最正面）
【倾诉时长】：{duration_minutes}分钟
【分类】：{category}

【倾诉内容摘要】：
{safe_input[:1500]}

请用温暖、有力量的语气，从以下三个维度写一段200字以内的成长洞察：
1. 触发点：是什么情境触发了这份情绪
2. 度过方式：用户提到了哪些应对方法
3. 预防建议：下次遇到类似情况可以怎么准备

用第一人称视角（"你"），像一位懂你的朋友在帮你复盘。
称呼用户「姐」，自称「小耕」。

只返回正文，不要加任何前缀、标签或标题。"""

    system_prompt = build_persona_prompt(
        module=_MODULE_KEY,
        emotion_state="low" if emotion_score < 0 else "neutral",
    )

    try:
        result = llm_generate_with_orchestration(
            prompt=prompt,
            system_prompt=system_prompt,
            module=_MODULE_KEY,
            task_complexity="medium",
            temperature=0.5,
            max_tokens=400,
        )

        content = result.get("content", "").strip()
        content = content.strip('"').strip("'").strip()

        if content and len(content) >= 10:
            return content
    except Exception as e:
        logger.warning("LLM成长内容萃取失败: %s", e)

    return None


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
    """从对话中萃取成长内容（离线模板，LLM失败时的兜底）。"""
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
# 成长手册转化（公开发）
# ═══════════════════════════════════════════════

def convert_to_growth_manual(
    session_messages: list[dict],
    emotion_analysis: dict[str, Any],
    db: Session | None = None,
    user_id: str | None = None,
) -> dict[str, Any]:
    """成长手册转化 — 将倾诉会话转化为结构化成长手册。

    仅处理非危机会话。

    Args:
        session_messages: 会话消息列表 [{"role": "user"|"assistant", "text": "..."}, ...]
        emotion_analysis: 情绪分析结果（可来自 analyze_emotion_with_crisis_detection 或其他来源）
        db: 数据库会话（可选，用于审计日志）
        user_id: 用户ID（可选，用于审计日志和事件发射）

    Returns:
        {
            "trigger_point": str,
            "coping_methods": str,
            "prevention_suggestions": str,
            "category_tags": list[str],
            "visibility": "private_only",
            "generation_method": "llm"|"fallback",
        }
    """
    # 检查是否为危机会话
    crisis_level = 0
    if "final_decision" in emotion_analysis:
        crisis_level = emotion_analysis["final_decision"].get("crisis_level", 0)
    elif "crisis_level" in emotion_analysis:
        crisis_level = emotion_analysis["crisis_level"]

    if crisis_level >= 2:
        return {
            "trigger_point": "(危机会话，不生成成长手册)",
            "coping_methods": "",
            "prevention_suggestions": "",
            "category_tags": [],
            "visibility": "private_only",
            "generation_method": "skipped_crisis",
        }

    # 提取用户消息
    user_messages = [
        m.get("text", m.get("content", ""))
        for m in session_messages
        if m.get("role") == "user"
    ]
    if not user_messages:
        return {
            "trigger_point": "(无用户消息)",
            "coping_methods": "",
            "prevention_suggestions": "",
            "category_tags": [],
            "visibility": "private_only",
            "generation_method": "skipped_empty",
        }

    combined_input = " ".join(user_messages)
    safe_input = desensitize(combined_input, module=_MODULE_KEY)

    # 提取情绪关键信息
    intensity = emotion_analysis.get("intensity", emotion_analysis.get("emotion_score", 0))
    if isinstance(intensity, dict):
        intensity = intensity.get("combined_intensity", 0)

    prompt = f"""请从以下情绪树洞倾诉记录中，萃取一篇成长手册。

【情绪强度】：{intensity}/10
【倾诉内容】：
{safe_input[:2000]}

请返回JSON（只返回JSON，不要markdown代码块标记）：
{{
  "trigger_point": "什么情境触发了这份情绪（30字以内）",
  "coping_methods": "用户提到了哪些应对/度过的方法（50字以内）",
  "prevention_suggestions": "下次遇到类似情况可以做什么准备（50字以内）",
  "category_tags": ["自我成长", "认知转化", "情绪调节"]  // 选择一个或多个
}}

使用温暖、有洞察力的语气。称呼用户「姐」。"""

    system_prompt = build_persona_prompt(
        module=_MODULE_KEY,
        emotion_state="low" if intensity < 0 else "neutral",
    )

    try:
        result = llm_generate_with_orchestration(
            prompt=prompt,
            system_prompt=system_prompt,
            module=_MODULE_KEY,
            task_complexity="medium",
            temperature=0.5,
            max_tokens=500,
        )

        content = result.get("content", "").strip()
        llm_data = _parse_json_response(content)

        if llm_data:
            # 审计日志
            if db and user_id:
                write_audit_log(
                    user_id=user_id,
                    module=_MODULE_KEY,
                    action="growth_manual_generated",
                    input_text=safe_input[:500],
                    output_text=content[:500],
                    model_used=result.get("model_used", "unknown"),
                    db=db,
                )

            return {
                "trigger_point": llm_data.get("trigger_point", ""),
                "coping_methods": llm_data.get("coping_methods", ""),
                "prevention_suggestions": llm_data.get("prevention_suggestions", ""),
                "category_tags": llm_data.get("category_tags", ["情绪调节"]),
                "visibility": "private_only",
                "generation_method": "llm",
                "model_used": result.get("model_used", "unknown"),
            }
    except Exception as e:
        logger.warning("LLM成长手册转化失败: %s", e)

    # === 回退：基于模板的简化手册 ===
    category_tags = ["情绪调节"]
    all_text = " ".join(user_messages[-5:])
    if any(kw in all_text for kw in ["原来", "明白", "意识到", "想通了"]):
        category_tags = ["认知转化"]
    if any(kw in all_text for kw in ["成长", "进步", "学习", "提升"]):
        category_tags = ["自我成长"]

    return {
        "trigger_point": "日常情绪波动",
        "coping_methods": "通过倾诉释放情绪，获得陪伴和支持",
        "prevention_suggestions": "定期进行情绪记录，保持自我觉察习惯",
        "category_tags": category_tags,
        "visibility": "private_only",
        "generation_method": "fallback",
    }


# ═══════════════════════════════════════════════
# 工具函数
# ═══════════════════════════════════════════════

def _parse_json_response(content: str) -> dict[str, Any] | None:
    """尝试从 LLM 响应中解析 JSON。

    处理常见的格式问题：markdown代码块包裹、多余文本。
    """
    if not content:
        return None

    # 尝试直接解析
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass

    # 尝试从 markdown 代码块中提取
    import re
    # 匹配 ```json ... ``` 或 ``` ... ```
    match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', content, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1).strip())
        except json.JSONDecodeError:
            pass

    # 尝试找到第一个 { 和最后一个 } 之间的内容
    start = content.find("{")
    end = content.rfind("}")
    if start >= 0 and end > start:
        try:
            return json.loads(content[start:end + 1])
        except json.JSONDecodeError:
            pass

    logger.debug("无法解析LLM JSON响应: %s", content[:200])
    return None


# ═══════════════════════════════════════════════
# 跨模块联动：次日关怀
# ═══════════════════════════════════════════════
def check_yesterday_crisis(db: Session, user_id: str) -> dict[str, Any]:
    """检查用户昨日是否有危机触发，用于朝有规划开场关怀。

    被 plans 服务的 morning check 调用。
    """
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    user_id_hashed = hash_user_id(user_id)

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
