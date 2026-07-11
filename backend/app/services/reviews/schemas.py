"""复盘服务 请求/响应模型。"""
from __future__ import annotations

from pydantic import BaseModel, Field


class DiagnoseIn(BaseModel):
    goal_completion: str = "completed"
    new_experience: str = ""
    improvements: str = ""
    tomorrow_priority: str = ""


class SopStepIn(BaseModel):
    step_number: int
    title: str
    description: str


class SopIn(BaseModel):
    title: str
    steps: list[SopStepIn] = Field(default_factory=list)
    key_phrases: str | None = None
    precautions: str | None = None
    reflection_text: str | None = None  # V2.0: 用户原始反思文本，用于AI自动萃取SOP


class SaveMessageIn(BaseModel):
    stage: str  # greeting|inventory|extraction|improvement|archive
    messages: list[dict] = Field(default_factory=list)
    emotion_score: int | None = None
    courage_value: int | None = None


# ── AI 复盘对话 ──

class ReviewChatIn(BaseModel):
    """暮有复盘 AI 对话请求 — 所有小耕回复由AI模型生成。"""
    message: str = Field(default="", max_length=4096, description="用户当前消息（初始问候可为空）")
    phase: str = Field(default="reviewing", description="collecting | reviewing")
    stage: str = Field(default="greeting", description="greeting|inventory|extraction|improvement|archive")
    context: list[dict] = Field(default_factory=list, description="对话历史 [{role, text}]")
    info_rounds: int = Field(default=0, description="信息收集已进行轮数")
    gentle_persistence_used: bool = Field(default=False, description="本次复盘温柔坚持是否已用过")
