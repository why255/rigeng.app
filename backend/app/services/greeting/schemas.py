"""开场白服务 请求/响应模型。"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

# 支持的模块：与 persona.py 中的 MODULE_SCENE_PROMPTS key 对齐
ModuleKey = Literal["morning_plan", "evening_review", "career"]


class GreetingRequest(BaseModel):
    """开场白请求 — 传入模块名即可，后端根据时间和场景生成。"""
    module: ModuleKey = Field(..., description="模块标识：morning_plan / evening_review / career")


class GreetingResponse(BaseModel):
    greeting: str
    model_used: str
