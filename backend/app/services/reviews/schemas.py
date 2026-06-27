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


class SaveMessageIn(BaseModel):
    stage: str  # greeting|inventory|extraction|improvement|archive
    messages: list[dict] = Field(default_factory=list)
    emotion_score: int | None = None
    courage_value: int | None = None
