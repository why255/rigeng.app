"""情绪树洞服务 — 路由层（步骤14）。

API 端点：
  GET  /emotion/today     — 今日情绪概览
  POST /emotion/log       — 记录倾诉消息
  POST /emotion/suggest   — 获取小耕共情回复
  POST /emotion/crisis    — 触发危机干预
  GET  /emotion/history   — 情绪历史趋势
  GET  /growth/records    — 成长记录列表
  POST /growth/record     — 创建成长记录
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ...shared.database import get_db
from ...shared.response import ok
from ...shared.security import CurrentUser, get_current_user
from . import service
from .schemas import (
    CrisisTriggerRequest,
    EmotionChatIn,
    EmotionMessageLogRequest,
    EmotionSuggestRequest,
    GrowthRecordCreateRequest,
)

router = APIRouter(tags=["情绪树洞"])


# ═══════════════════════════════════════════════
# 情绪概览
# ═══════════════════════════════════════════════
@router.get("/emotion/today")
def get_today_emotion(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取今日情绪概览：当前情绪、评分、勇气值、是否有今日倾诉。"""
    return ok(service.get_today_emotion(db, user.user_id))


# ═══════════════════════════════════════════════
# 对话消息
# ═══════════════════════════════════════════════
@router.post("/emotion/log")
def log_emotion_message(
    body: EmotionMessageLogRequest,
    user: CurrentUser = Depends(get_current_user),
):
    """记录一条倾诉对话消息。"""
    return ok(service.log_emotion_message(
        user_id=user.user_id,
        role=body.role,
        text=body.text,
        duration_seconds=body.duration_seconds,
    ))


# ═══════════════════════════════════════════════
# 共情回复
# ═══════════════════════════════════════════════
@router.post("/emotion/suggest")
def get_emotion_suggest(
    body: EmotionSuggestRequest,
    user: CurrentUser = Depends(get_current_user),
):
    """获取小耕共情回复。基于用户消息生成温柔的陪伴性回应。"""
    return ok(service.generate_suggest(body.message))


# ═══════ 情绪树洞 AI 对话 ═══════

@router.post("/emotion/chat")
def emotion_chat(
    body: EmotionChatIn,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """情绪树洞 AI 对话 — 所有小耕回复由AI模型生成。

    AI根据对话历史和当前消息生成温暖共情的回复，
    遵循三不原则（不评判/不否定/不急给建议）。
    支持空消息（初始问候）。
    """
    data = service.process_emotion_chat(
        message=body.message,
        context=body.context,
        elapsed_seconds=body.elapsed_seconds,
        user_id=user.user_id,
        db=db,
    )
    return ok(data)


# ═══════════════════════════════════════════════
# 危机干预
# ═══════════════════════════════════════════════
@router.post("/emotion/crisis")
def trigger_crisis(
    body: CrisisTriggerRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """触发危机干预。记录危机事件并返回心理援助热线。"""
    return ok(service.trigger_crisis_intervention(
        db, user.user_id, body.reason,
    ))


# ═══════════════════════════════════════════════
# 情绪历史
# ═══════════════════════════════════════════════
@router.get("/emotion/history")
def get_emotion_history(
    week: str | None = Query(None),
    month: str | None = Query(None),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取情绪历史。
    - week=current → 返回本周情绪趋势（WeeklyEmotionResponse 格式）
    - month=current → 返回历史记录列表（EmotionDaySummaryResponse[] 格式）
    """
    if week == "current":
        return ok(service.get_weekly_emotion(db, user.user_id))
    return ok(service.get_emotion_history(db, user.user_id, month))


# ═══════════════════════════════════════════════
# 成长记录
# ═══════════════════════════════════════════════
@router.get("/growth/records")
def get_growth_records(
    limit: int = Query(default=10, le=50),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取成长记录列表，按日期倒序。"""
    return ok(service.get_growth_records(db, user.user_id, limit))


@router.post("/growth/record")
def create_growth_record(
    body: GrowthRecordCreateRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """结束倾诉时创建成长记录。分析对话内容，萃取成长洞察，更新勇气值。"""
    return ok(service.create_growth_record(
        db=db,
        user_id=user.user_id,
        chat_messages=body.chat_messages,
        emotion_score=body.emotion_score,
        courage_value=body.courage_value,
        duration_minutes=body.duration_minutes,
    ))


# ═══════════════════════════════════════════════
# 跨模块：次日关怀检查
# ═══════════════════════════════════════════════
@router.get("/emotion/yesterday-check")
def check_yesterday(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """检查昨日是否有危机或低落情绪（供朝有规划开场时调用）。"""
    return ok(service.check_yesterday_crisis(db, user.user_id))
