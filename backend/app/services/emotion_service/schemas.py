"""情绪树洞服务 — 请求/响应模型。"""
from __future__ import annotations

from pydantic import BaseModel, Field


# ═══════ 情绪概览 ═══════
class TodayEmotionResponse(BaseModel):
    """今日情绪概览。"""
    mood: str = "平静"
    mood_emoji: str = "😊"
    score: int = 0
    courage_value: int = 0
    has_today_chat: bool = False


# ═══════ 对话消息 ═══════
class EmotionMessageLogRequest(BaseModel):
    """保存倾诉对话消息。"""
    role: str = Field(..., pattern="^(user|assistant)$")
    text: str = Field(..., min_length=1, max_length=10000)
    duration_seconds: int | None = None


class EmotionMessageLogResponse(BaseModel):
    """消息保存结果。"""
    saved: bool
    message_id: str


# ═══════ 共情回复 ═══════
class EmotionSuggestRequest(BaseModel):
    """请求小耕共情回复。"""
    message: str = Field(..., min_length=1, max_length=5000)


# ── AI 情绪树洞对话 ──

class EmotionChatIn(BaseModel):
    """情绪树洞 AI 对话请求 — 所有小耕回复由AI模型生成。"""
    message: str = Field(default="", max_length=5000, description="用户当前消息（初始问候可为空）")
    context: list[dict] = Field(default_factory=list, description="对话历史 [{role, text}]")
    elapsed_seconds: int = Field(default=0, description="已倾诉秒数")


class EmotionSuggestResponse(BaseModel):
    """小耕共情回复。"""
    text: str
    type: str = "empathy"  # empathy / question / reflection


# ═══════ 危机干预 ═══════
class CrisisTriggerRequest(BaseModel):
    """触发危机干预。"""
    reason: str | None = None


class CrisisTriggerResponse(BaseModel):
    """危机干预结果。"""
    triggered: bool
    hotline: str = "400-161-9995"
    message: str = ""


# ═══════ 情绪历史 ═══════
class EmotionDaySummaryResponse(BaseModel):
    """单日情绪摘要。"""
    date: str
    day_of_week: str = ""
    mood: str
    mood_emoji: str
    duration_minutes: int = 0
    growth_record_count: int = 0
    score: int = 0


class WeeklyEmotionDay(BaseModel):
    """一周中某天的情绪柱状图数据点。"""
    day: str
    day_index: int
    score: int
    has_record: bool


class WeeklyEmotionResponse(BaseModel):
    """本周情绪趋势。"""
    week_label: str
    days: list[WeeklyEmotionDay] = []


# ═══════ 成长记录 ═══════
class GrowthRecordCreateRequest(BaseModel):
    """创建成长记录（结束倾诉时调用）。"""
    chat_messages: list[dict] = Field(default_factory=list)
    emotion_score: int = Field(default=0, ge=-10, le=10)
    courage_value: int = Field(default=0, ge=0, le=100)
    duration_minutes: int = Field(default=0, ge=0)


class GrowthRecordResponse(BaseModel):
    """成长记录。"""
    id: str
    date: str
    category: str
    category_color: str
    content: str
    tags: list[str] = []
    created_at: str = ""
