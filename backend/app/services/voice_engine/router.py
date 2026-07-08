"""③语音/智能引擎服务 路由层（A1-A5）。"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...shared.database import get_db
from ...shared.response import ok
from ...shared.security import get_current_user, CurrentUser
from . import service
from .schemas import ASRRequest, ConversationRequest, LLMRequest

router = APIRouter(tags=["③语音/智能引擎"], prefix="/voice")


@router.post("/asr")  # A1/A2: 语音转文字（在线+离线）
def speech_to_text(body: ASRRequest, user: CurrentUser = Depends(get_current_user)):
    """语音转文字。默认使用在线ASR（腾讯云），prefer_offline=True时优先离线（Vosk）。"""
    result = service.recognize_speech(
        audio_base64=body.audio_base64,
        audio_format=body.audio_format,
        sample_rate=body.sample_rate,
        prefer_offline=body.prefer_offline,
        engine=body.engine,
    )
    return ok(result)


@router.post("/llm")  # A3/A4: AI生成回答
def generate(body: LLMRequest, user: CurrentUser = Depends(get_current_user)):
    """AI推理/生成回答（智谱AI GLM）。"""
    result = service.llm_generate(
        prompt=body.prompt,
        system_prompt=body.system_prompt,
        context=body.context,
        model=body.model,
        temperature=body.temperature,
        max_tokens=body.max_tokens,
        stream=body.stream,
    )
    return ok(result)


@router.post("/converse")  # A5: 多轮对话
def converse(body: ConversationRequest, user: CurrentUser = Depends(get_current_user),
             db: Session = Depends(get_db)):
    """多轮对话管理。自动维护上下文，支持各模块专属系统提示词+算法文件检索。"""
    result = service.converse(
        user_input=body.user_input,
        conversation_id=body.conversation_id,
        module=body.module,
        context_meta=body.context_meta,
        provider=body.provider,
        db=db,
    )
    return ok(result)


@router.get("/conversations/{conversation_id}")  # 查询对话历史
def get_conversation(conversation_id: str, user: CurrentUser = Depends(get_current_user)):
    """获取指定对话的历史记录。"""
    history = service._conversations.get(conversation_id)
    return ok({"conversation_id": conversation_id, "history": history or []})


@router.delete("/conversations/{conversation_id}")  # 清除对话
def delete_conversation(conversation_id: str, user: CurrentUser = Depends(get_current_user)):
    """清除指定对话历史。"""
    service._conversations.pop(conversation_id, None)
    return ok({"deleted": conversation_id})


@router.get("/health")  # 服务健康检查
def voice_health():
    """语音引擎服务健康检查。"""
    online_ready = bool(service.settings.TENCENT_ASR_SECRET_ID)
    llm_ready = bool(service.settings.ZHIPUAI_API_KEY)
    offline_ready = service._get_vosk_model() is not None and service._get_vosk_model() is not False
    return ok({
        "status": "up",
        "online_asr": online_ready,
        "offline_asr": offline_ready,
        "llm": llm_ready,
    })
