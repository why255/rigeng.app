"""③语音/智能引擎服务 请求/响应模型。"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


# ═══════ 语音识别 ASR ═══════
class ASRRequest(BaseModel):
    """A1 语音转文字请求。"""
    audio_base64: str = Field(..., min_length=1, description="Base64编码的音频数据")
    audio_format: str = Field(default="wav", description="音频格式: wav/mp3/pcm")
    sample_rate: int = Field(default=16000, ge=8000, le=48000)
    engine: str | None = None  # 覆盖默认引擎
    prefer_offline: bool = Field(default=False, description="优先使用离线识别")


class ASRResponse(BaseModel):
    text: str
    confidence: float = Field(ge=0.0, le=1.0)
    engine_used: str  # "tencent_online" / "vosk_offline"
    duration_ms: int


# ═══════ AI 推理/生成 ═══════
class LLMRequest(BaseModel):
    """A3 AI生成回答请求。"""
    prompt: str = Field(..., min_length=1, max_length=8192)
    system_prompt: str | None = None
    context: list[dict[str, str]] | None = None  # 多轮对话历史 [{role, content}]
    model: str | None = None  # 覆盖默认模型
    temperature: float | None = None
    max_tokens: int | None = None
    stream: bool = False


class LLMResponse(BaseModel):
    content: str
    model_used: str
    usage: dict[str, int]  # {prompt_tokens, completion_tokens, total_tokens}


# ═══════ 多轮对话 ═══════
class ConversationRequest(BaseModel):
    """A5 多轮对话管理。"""
    conversation_id: str | None = None  # 空=新建对话
    user_input: str = Field(..., min_length=1)
    module: str = Field(default="general")  # M1朝有规划 / M2暮有复盘 / M3情绪树洞 / M5智能问答
    context_meta: dict[str, Any] | None = None  # 模块特有上下文


class ConversationResponse(BaseModel):
    conversation_id: str
    assistant_reply: str
    is_crisis: bool = False  # 是否触发危机检测
    is_hr_guided: bool = False  # 是否超出HR范围被温和引导
    suggestions: list[str] | None = None


# ═══════ 情绪/危机检测（内部）═══
class EmotionDetection(BaseModel):
    is_agitated: bool = False
    emotion_label: str | None = None  # neutral/happy/sad/anxious/angry
    crisis_level: int = Field(default=0, ge=0, le=3)  # 0=正常 1=关注 2=预警 3=危机
    crisis_reason: str | None = None
