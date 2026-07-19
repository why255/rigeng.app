"""用户画像引擎 UserProfilerEngine (Tier 2 记忆系统)。

核心能力:
  - extract_profile_from_history(user_id) — 从对话历史提取结构化画像
  - detect_unfinished_tasks(user_id) — 检测昨日未完成事项
  - generate_morning_context(user_id) — 生成今日早规划上下文
  - track_user_activity(user_id, module) — 记录用户活跃模块和时间

画像维度:
  - work_habits: 工作习惯（早起/夜猫子/批处理/逐个击破…）
  - preferences: 偏好（简洁/详细/追问/不追问…）
  - emotion_patterns: 情感模式（周一焦虑/周三疲惫/周五放松…）
  - common_topics: 常关注话题（绩效/招聘/培训/劳动法…）
  - persona_traits: 人格特征（完美主义/行动派/分析型…）
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

logger = logging.getLogger("user_profiler")

# 默认空画像
_DEFAULT_PROFILE: dict[str, Any] = {
    "work_habits": {},
    "preferences": {},
    "emotion_patterns": {},
    "common_topics": [],
    "persona_traits": [],
    "last_updated": None,
}


def _get_today_date() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _get_yesterday_date() -> str:
    return (datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat()


def get_profile(db, user_id: str) -> dict[str, Any]:
    """从数据库读取用户画像（无则返回默认）。"""
    from ..shared.models.user import User
    user = db.query(User).filter(User.id == user_id).first()
    if user and user.user_profile:
        return user.user_profile
    return dict(_DEFAULT_PROFILE)


def save_profile(db, user_id: str, profile: dict[str, Any]) -> None:
    """保存用户画像到数据库。"""
    from ..shared.models.user import User
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        profile["last_updated"] = _get_today_date()
        user.user_profile = profile
        db.commit()
        logger.info("用户画像已更新: user=%s", user_id[:8])


def track_user_activity(db, user_id: str, module: str) -> None:
    """记录用户活跃模块和时间。

    每次用户发起对话时调用，用于画像分析和跨模块记忆。
    """
    try:
        from ..shared.models.user import User
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user.last_active_module = module
            user.last_active_at = datetime.now(timezone.utc)
            db.commit()
    except Exception as e:
        logger.warning("用户活跃追踪失败: %s", e)


def extract_profile_from_history(db, user_id: str) -> dict[str, Any]:
    """从对话历史和记忆数据中提取用户画像。

    结合 Tier 1 会话记忆、plan/review/emotion 表格数据，
    构建用户的多维度画像。

    Returns:
        更新后的画像字典
    """
    current_profile = get_profile(db, user_id)

    # 1. 从 Tier 1 会话记忆分析对话风格
    try:
        from .session_context import load_context as load_session_context
        ctx = load_session_context(db, user_id, "general", max_memories=10)
        memories = ctx.get("memories", [])

        for m in memories:
            key = m.get("key", "")
            value = m.get("value", "")
            if key == "prefer_concise":
                current_profile["preferences"]["concise"] = True
            elif key == "prefer_detailed":
                current_profile["preferences"]["detailed"] = True
            elif key == "user_company_size":
                current_profile["work_habits"]["company_size"] = value
    except Exception as e:
        logger.debug("Tier 1 记忆分析跳过: %s", e)

    # 2. 从 plan 表分析工作习惯
    try:
        from ..shared.models.plan import Plan, PlanTask
        from sqlalchemy import and_

        yesterday = _get_yesterday_date()
        recent_plans = db.query(Plan).filter(
            and_(Plan.user_id == user_id, Plan.date >= yesterday)
        ).limit(5).all()

        if recent_plans:
            total_tasks = sum(len(p.tasks) if hasattr(p, 'tasks') else 0 for p in recent_plans)
            completed = sum(
                sum(1 for t in getattr(p, 'tasks', []) if getattr(t, 'status', '') == 'done')
                for p in recent_plans
            )
            current_profile["work_habits"]["avg_daily_tasks"] = total_tasks // max(len(recent_plans), 1)
            current_profile["work_habits"]["completion_rate"] = round(
                completed / max(total_tasks, 1), 2
            )

        # 分析常用的象限分布
        all_tasks = []
        for p in recent_plans:
            all_tasks.extend(getattr(p, 'tasks', []))
        quadrants = {}
        for t in all_tasks:
            q = getattr(t, 'quadrant', '')
            if q:
                quadrants[q] = quadrants.get(q, 0) + 1
        if quadrants:
            top_q = max(quadrants, key=quadrants.get)  # type: ignore
            current_profile["work_habits"]["dominant_quadrant"] = top_q
    except Exception as e:
        logger.debug("plan 分析跳过: %s", e)

    # 3. 从 emotion 表分析情感模式
    try:
        from ..shared.models.emotion import EmotionRecord
        from sqlalchemy import and_

        today = _get_today_date()
        week_ago = (datetime.now(timezone.utc).date() - timedelta(days=7)).isoformat()
        recent_emotions = db.query(EmotionRecord).filter(
            and_(EmotionRecord.user_id == user_id, EmotionRecord.date >= week_ago)
        ).all()

        if recent_emotions:
            emotion_labels = [e.emotion_label for e in recent_emotions if e.emotion_label]
            scores = [e.score for e in recent_emotions if e.score]
            if emotion_labels:
                from collections import Counter
                dominant_emotion = Counter(emotion_labels).most_common(1)[0][0]
                current_profile["emotion_patterns"]["dominant_emotion_7d"] = dominant_emotion
            if scores:
                current_profile["emotion_patterns"]["avg_score_7d"] = round(
                    sum(scores) / len(scores), 1
                )
    except Exception as e:
        logger.debug("emotion 分析跳过: %s", e)

    # 保存更新后的画像
    save_profile(db, user_id, current_profile)
    return current_profile


def detect_unfinished_tasks(db, user_id: str) -> list[dict[str, Any]]:
    """检测昨日（及更早）未完成事项。

    从 plan 表中查找最近 3 天内状态非 done/completed 的任务。

    Returns:
        [{"title": str, "date": str, "quadrant": str, "source": str}]
    """
    unfinished: list[dict[str, Any]] = []
    try:
        from ..shared.models.plan import Plan, PlanTask
        from sqlalchemy import and_

        three_days_ago = (datetime.now(timezone.utc).date() - timedelta(days=3)).isoformat()
        recent_plans = db.query(Plan).filter(
            and_(Plan.user_id == user_id, Plan.date >= three_days_ago, Plan.date < _get_today_date())
        ).all()

        for plan in recent_plans:
            tasks = getattr(plan, 'tasks', [])
            for task in tasks:
                status = getattr(task, 'status', '')
                if status and status not in ('done', 'completed', 'cancelled'):
                    unfinished.append({
                        "title": getattr(task, 'title', ''),
                        "date": getattr(plan, 'date', ''),
                        "quadrant": getattr(task, 'quadrant', ''),
                        "source": getattr(task, 'source', ''),
                        "plan_id": plan.id,
                        "task_id": task.id,
                    })
    except Exception as e:
        logger.warning("未完成任务检测失败: %s", e)

    return unfinished


def generate_morning_context(db, user_id: str) -> dict[str, Any]:
    """生成今日早规划上下文（供 plans/service.py 调用）。

    整合 Tier 1 会话记忆 + Tier 2 画像 + 未完成任务，
    作为 prompt 注入到 morning plan chat 中。

    Returns:
        {
            "yesterday_unfinished": [...],
            "user_profile_summary": str,
            "recent_context": str,
            "date_anchor": str,
        }
    """
    from .persona import get_date_anchor

    context: dict[str, Any] = {
        "yesterday_unfinished": [],
        "user_profile_summary": "",
        "recent_context": "",
        "date_anchor": get_date_anchor(),
    }

    # 未完成任务
    unfinished = detect_unfinished_tasks(db, user_id)
    context["yesterday_unfinished"] = unfinished

    # 用户画像摘要
    profile = get_profile(db, user_id)
    parts = []
    habits = profile.get("work_habits", {})
    if habits.get("completion_rate"):
        parts.append(f"任务完成率约{int(habits['completion_rate'] * 100)}%")
    if habits.get("dominant_quadrant"):
        quadrant_labels = {
            "urgent_important": "重要紧急",
            "not_urgent_important": "重要不紧急",
            "urgent_not_important": "不重要但紧急",
            "not_urgent_not_important": "不重要不紧急",
        }
        label = quadrant_labels.get(habits["dominant_quadrant"], habits["dominant_quadrant"])
        parts.append(f"倾向于处理{label}类任务")
    prefs = profile.get("preferences", {})
    if prefs.get("concise"):
        parts.append("偏好简洁回答")
    if prefs.get("detailed"):
        parts.append("偏好详细说明")
    emotion = profile.get("emotion_patterns", {})
    if emotion.get("dominant_emotion_7d"):
        parts.append(f"近一周情绪偏向{emotion['dominant_emotion_7d']}")

    if parts:
        context["user_profile_summary"] = "；".join(parts)

    # 最近对话上下文（Tier 1）
    try:
        from .session_context import get_recent_turns
        recent_turns = get_recent_turns(user_id, "morning_plan", n=5)
        if recent_turns:
            context["recent_context"] = "\n".join(
                f"{t['role']}: {t['content'][:100]}" for t in recent_turns[-6:]
            )
    except Exception:
        pass

    return context
