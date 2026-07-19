"""③语音/智能引擎服务 路由层（A1-A5）。"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...shared.database import get_db
from ...shared.response import ok
from ...shared.security import get_current_user, CurrentUser
from . import service
from .schemas import ASRRequest, ConversationRequest, LLMRequest

router = APIRouter(tags=["③语音/智能引擎"], prefix="/voice")
logger = logging.getLogger("voice_router")


@router.post("/asr")  # A1/A2: 语音转文字（在线+离线）
def speech_to_text(body: ASRRequest, user: CurrentUser = Depends(get_current_user)):
    """语音转文字。优先通义听悟 → 腾讯云备用 → Vosk离线。"""
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
    """AI推理/生成回答（多提供商：豆包/通义千问/混元/Kimi/DeepSeek/智谱/Claude）。"""
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
        user_id=user.user_id,
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
    """语音引擎服务健康检查（多提供商状态）。"""
    online_asr_ready = bool(service.settings.TINGWU_API_KEY or service.settings.TENCENT_ASR_SECRET_ID)
    offline_ready = service._get_vosk_model() is not None and service._get_vosk_model() is not False

    llm_providers = {
        "volcano": bool(service.settings.VOLCANO_API_KEY),
        "dashscope": bool(service.settings.DASHSCOPE_API_KEY),
        "hunyuan": bool(service.settings.HUNYUAN_SECRET_ID),
        "kimi": bool(service.settings.KIMI_API_KEY),
        "deepseek": bool(service.settings.DEEPSEEK_API_KEY),
        "zhipu": bool(service.settings.ZHIPUAI_API_KEY),
        "anthropic": bool(service.settings.ANTHROPIC_API_KEY),
    }
    llm_ready = any(llm_providers.values())

    return ok({
        "status": "up",
        "online_asr": online_asr_ready,
        "offline_asr": offline_ready,
        "llm": llm_ready,
        "llm_providers": llm_providers,
    })


# ═══════════════════════════════════════════════
# Phase 3: 语音全链路流式处理
# ═══════════════════════════════════════════════


class AudioChunkIn(BaseModel):
    audio_chunk: str  # Base64 编码的音频块
    chunk_index: int = 0  # 音频块序号
    is_last: bool = False  # 是否为最后一块
    audio_format: str = "webm"  # webm/wav
    session_id: str = ""  # 语音会话 ID


class PreWarmIn(BaseModel):
    keywords: list[str] = []  # 检测到的关键字
    module: str = "general"  # 目标模块


class PipelineStreamIn(BaseModel):
    audio_base64: str  # 完整语音的 Base64
    audio_format: str = "wav"
    module: str = "general"
    user_input_extra: str = ""  # 额外的用户输入上下文


@router.post("/voice/chunk")  # P3: 增量音频块上传
def upload_audio_chunk(body: AudioChunkIn, user: CurrentUser = Depends(get_current_user)):
    """接收录音过程中的增量音频块。

    每 2 秒一个 chunk，后端累积后逐步识别。
    最后一个 chunk（is_last=true）触发最终 ASR 并返回完整文本。
    """
    result = service.handle_audio_chunk(
        audio_base64=body.audio_chunk,
        chunk_index=body.chunk_index,
        is_last=body.is_last,
        audio_format=body.audio_format,
        session_id=body.session_id,
        user_id=user.user_id,
    )
    return ok(result)


@router.post("/voice/pre-warm")  # P3: 预热 LLM
def pre_warm_llm(body: PreWarmIn, user: CurrentUser = Depends(get_current_user)):
    """关键字命中后预热 LLM 提供商。

    客户端本地检测到关键字后发送此请求，
    服务端在 LLM 提供商处建立连接预热（connection pool keep-alive）。
    不返回结果，fire-and-forget。
    """
    service.pre_warm_llm(keywords=body.keywords, module=body.module)
    return ok({"status": "warmed"})


@router.post("/voice/pipeline/stream")  # P3: 全链路语音流水线
def voice_pipeline_stream(
    body: PipelineStreamIn,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """语音全链路流式处理：ASR → LLM + TTS 并行 → SSE 输出。

    SSE 事件类型：
    - content: 文本 token
    - audio_chunk: TTS 音频 base64 块
    - done: 完成
    - error: 错误

    流程：
    1. ASR 语音转文字
    2. 并行执行 LLM 流式生成 + TTS 首句合成
    3. SSE 流式返回文本 + 音频
    """
    def generate():
        try:
            # 1. ASR 语音转文字
            asr_result = service.recognize_speech(
                audio_base64=body.audio_base64,
                audio_format=body.audio_format,
            )
            text = asr_result.get("text", "").strip()
            if not text:
                yield sse_error("未能识别到有效语音内容")
                return

            yield sse_event(text, "stage_change")  # 发送 ASR 结果

            # 2. 构建 LLM prompt + system_prompt
            from ...engines.persona import build_persona_prompt
            system_prompt = build_persona_prompt(module=body.module)

            prompt = text
            if body.user_input_extra:
                prompt = f"{body.user_input_extra}\n\n用户语音输入：{text}"

            # 3. LLM 流式生成（并行启动 TTS 首句预取）
            from ...engines.llm_orchestrator import llm_generate_stream_with_orchestration

            full_reply = ""
            first_sentence_tts = None

            for token in llm_generate_stream_with_orchestration(
                prompt=prompt,
                system_prompt=system_prompt,
                module=body.module,
                temperature=0.7,
                user_id=user.user_id,
                db=db,
            ):
                full_reply += token
                yield sse_event(token, "content")

                # 检测首句边界（。！？\n）触发 TTS
                if first_sentence_tts is None and any(p in full_reply for p in ["。", "！", "？", "\n"]):
                    # 提取首句
                    for sep in ["。", "！", "？", "\n"]:
                        if sep in full_reply:
                            first_sentence = full_reply.split(sep)[0] + sep
                            break
                    else:
                        first_sentence = full_reply

                    if len(first_sentence.strip()) > 5:
                        # 并行启动 TTS
                        try:
                            tts_result = service.tts_speak(first_sentence.strip())
                            audio_url = tts_result.get("audio_url", "")
                            audio_base64_val = tts_result.get("audio_base64", "")
                            if audio_url or audio_base64_val:
                                first_sentence_tts = {
                                    "text": first_sentence.strip(),
                                    "audio_url": audio_url,
                                    "audio_base64": audio_base64_val,
                                }
                                yield sse_event(first_sentence_tts, "sources")
                        except Exception:
                            pass  # TTS 失败不阻断 LLM 流

            # 4. 完成
            yield sse_done({
                "model_used": "stream",
                "tts_available": first_sentence_tts is not None,
            })

            # Tier 1: 保存会话
            try:
                from ...engines.session_context import save_turn
                save_turn(user.user_id, body.module, "user", text)
                save_turn(user.user_id, body.module, "assistant", full_reply)
            except Exception:
                pass

        except Exception as e:
            logger.exception("语音流水线异常")
            yield sse_error(f"语音处理异常: {str(e)}")

    return sse_response(generate())
