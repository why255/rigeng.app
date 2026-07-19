"""WebSocket 统一实时通道 — 语音+文字双向流式端点（Phase 4）。

协议:
  Client → Server (JSON):
    {"type": "start", "module": "morning_plan"}
    {"type": "audio_frame", "data": "<base64_pcm>", "seq": 0, "format": "wav"}
    {"type": "text_input", "text": "今天想聊聊绩效", "seq": 1}
    {"type": "stop"}
    {"type": "cancel"}

  Server → Client (JSON):
    {"type": "status", "stage": "listening"|"transcribing"|"generating"|"done"}
    {"type": "transcript", "text": "今天", "is_partial": true, "source": "voice"|"text"}
    {"type": "llm_start", "trigger_reason": "sentence_end"|"text_input"}
    {"type": "llm_token", "token": "好"}
    {"type": "llm_interrupted", "reason": "..."}
    {"type": "llm_done", "model_used": "...", "token_count": N}
    {"type": "error", "message": "..."}
    {"type": "heartbeat"}
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ...shared.security import decode_token
from .smart_trigger import (
    should_trigger_llm,
    GenerationState,
    should_interrupt,
)

logger = logging.getLogger("realtime.ws")

router = APIRouter(tags=["实时语音"])

# ═══════════════════════════════════════════════
# 常量
# ═══════════════════════════════════════════════

# ASR 检查间隔（秒）— 音频帧到达后每隔此间隔调用一次 ASR
ASR_CHECK_INTERVAL = 0.8

# 最大音频缓冲帧数（超出则丢弃最旧的帧）
MAX_AUDIO_BUFFER_FRAMES = 120

# LLM token 队列容量
LLM_TOKEN_QUEUE_SIZE = 500

# WebSocket 心跳间隔（秒）
HEARTBEAT_INTERVAL = 15


# ═══════════════════════════════════════════════
# 连接会话
# ═══════════════════════════════════════════════

class RealtimeSession:
    """单次 WebSocket 实时语音会话的状态。"""

    def __init__(self, user_id: str, module: str):
        self.user_id = user_id
        self.module = module
        self.session_id = f"rt_{uuid.uuid4().hex[:12]}"

        # 音频缓冲: [(seq, base64_data, format), ...]
        self.audio_buffer: list[tuple[int, str, str]] = []
        self.last_audio_time: float | None = None
        self.audio_seq_counter = 0

        # ASR 状态
        self.partial_text = ""
        self.last_asr_text = ""
        self.asr_seq = 0
        self.is_asr_running = False

        # LLM 生成状态
        self.is_generating = False
        self.generation_trigger_text = ""
        self.generated_token_count = 0
        self.interruption_count = 0
        self.llm_task: asyncio.Task | None = None
        self.token_queue: asyncio.Queue = asyncio.Queue(LLM_TOKEN_QUEUE_SIZE)

        # 控制
        self.is_active = True
        self.is_stopped = False
        self.asr_check_task: asyncio.Task | None = None
        self.heartbeat_task: asyncio.Task | None = None

    def add_audio(self, data_b64: str, fmt: str = "wav") -> int:
        """添加音频帧到缓冲。返回当前帧序号。"""
        seq = self.audio_seq_counter
        self.audio_seq_counter += 1
        self.audio_buffer.append((seq, data_b64, fmt))
        self.last_audio_time = time.time()

        # 防止缓冲无限增长
        while len(self.audio_buffer) > MAX_AUDIO_BUFFER_FRAMES:
            self.audio_buffer.pop(0)

        return seq

    def get_accumulated_audio(self) -> tuple[str, str]:
        """获取所有已缓冲音频帧的合并 Base64 + 格式。

        对于 WAV: 不能简单拼接 Base64（WAV 有文件头），
        改为取最新的一帧作为代表（在实时场景中，最近的音频段最有信息量）。
        """
        if not self.audio_buffer:
            return "", "wav"
        # 取最后 3 秒的帧（~3-4 帧，每帧约 0.8s 的音频）
        recent = self.audio_buffer[-4:]
        # 返回最后一帧（最新的音频），格式用最常见的
        # 简单策略：最新的帧携带最新的语音内容
        _, data, fmt = recent[-1]
        return data, fmt

    def clear_audio_buffer(self):
        self.audio_buffer.clear()


# ═══════════════════════════════════════════════
# WebSocket 端点
# ═══════════════════════════════════════════════

@router.websocket("/voice/ws/realtime")
async def realtime_voice_ws(websocket: WebSocket):
    """实时语音 WebSocket 端点。

    连接: ws://host/api/v1/voice/ws/realtime?token=xxx
    """
    # ── 鉴权 ──
    token = websocket.query_params.get("token", "")
    if not token:
        await websocket.close(code=4001, reason="missing token")
        return

    try:
        payload = decode_token(token)
        user_id = payload.get("sub", "anonymous")
    except Exception:
        await websocket.close(code=4001, reason="invalid token")
        return

    await websocket.accept()
    logger.info("WebSocket 实时语音连接建立 user=%s", user_id)

    session = RealtimeSession(user_id=user_id, module="general")

    try:
        await _run_session(websocket, session)
    except WebSocketDisconnect:
        logger.info("WebSocket 断开 user=%s", user_id)
    except Exception:
        logger.exception("WebSocket 异常 user=%s", user_id)
    finally:
        await _cleanup_session(session)


async def _run_session(ws: WebSocket, sess: RealtimeSession):
    """主事件循环：接收消息 + 分发处理。"""
    # 启动心跳
    sess.heartbeat_task = asyncio.create_task(_heartbeat_loop(ws, sess))

    # 启动 ASR 定时检查
    sess.asr_check_task = asyncio.create_task(_asr_check_loop(ws, sess))

    # Token 发送循环
    token_sender = asyncio.create_task(_token_send_loop(ws, sess))

    try:
        while sess.is_active:
            # 接收消息（带超时，用于定期检查状态）
            try:
                raw = await asyncio.wait_for(ws.receive_text(), timeout=5.0)
            except asyncio.TimeoutError:
                # 超时不是错误，继续循环
                continue

            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await _ws_send(ws, {"type": "error", "message": "无效 JSON"})
                continue

            msg_type = msg.get("type", "")

            if msg_type == "start":
                sess.module = msg.get("module", "general")
                logger.info("实时会话开始 session=%s module=%s", sess.session_id, sess.module)
                await _ws_send(ws, {
                    "type": "status",
                    "stage": "listening",
                    "session_id": sess.session_id,
                })

            elif msg_type == "audio_frame":
                data_b64 = msg.get("data", "")
                fmt = msg.get("format", "wav")
                if data_b64:
                    sess.add_audio(data_b64, fmt)

            elif msg_type == "text_input":
                text = (msg.get("text") or "").strip()
                if text:
                    await _handle_text_input(ws, sess, text)

            elif msg_type == "stop":
                logger.info("用户停止录音 session=%s text_len=%d",
                            sess.session_id, len(sess.partial_text))
                sess.is_stopped = True
                # 最终 ASR
                await _final_asr_and_generate(ws, sess)

            elif msg_type == "cancel":
                logger.info("用户取消 session=%s", sess.session_id)
                sess.is_active = False
                await _ws_send(ws, {"type": "status", "stage": "done", "reason": "cancelled"})
                break

            else:
                logger.debug("未知消息类型: %s", msg_type)

    finally:
        token_sender.cancel()
        try:
            await token_sender
        except asyncio.CancelledError:
            pass


# ═══════════════════════════════════════════════
# 后台循环
# ═══════════════════════════════════════════════

async def _heartbeat_loop(ws: WebSocket, sess: RealtimeSession):
    """定期发送心跳保持连接。"""
    try:
        while sess.is_active and not sess.is_stopped:
            await asyncio.sleep(HEARTBEAT_INTERVAL)
            if sess.is_active:
                await _ws_send(ws, {"type": "heartbeat"})
    except asyncio.CancelledError:
        pass
    except Exception:
        pass


async def _asr_check_loop(ws: WebSocket, sess: RealtimeSession):
    """定期检查音频缓冲并执行增量 ASR。"""
    try:
        while sess.is_active and not sess.is_stopped:
            await asyncio.sleep(ASR_CHECK_INTERVAL)

            # 无新音频或 ASR 正在运行 → 跳过
            if not sess.audio_buffer or sess.is_asr_running:
                continue

            await _do_incremental_asr(ws, sess)
    except asyncio.CancelledError:
        pass


async def _token_send_loop(ws: WebSocket, sess: RealtimeSession):
    """从 token_queue 读取 LLM token 并发送到 WebSocket。"""
    try:
        while sess.is_active:
            try:
                item = await asyncio.wait_for(sess.token_queue.get(), timeout=1.0)
            except asyncio.TimeoutError:
                continue

            if item is None:
                break  # 结束信号

            event_type = item.get("type", "")
            if event_type == "llm_token":
                await _ws_send(ws, item)
            elif event_type == "llm_done":
                await _ws_send(ws, item)
                sess.is_generating = False
                sess.generated_token_count = 0
            elif event_type == "llm_start":
                await _ws_send(ws, item)
            elif event_type == "llm_interrupted":
                sess.is_generating = False
                sess.generated_token_count = 0
                sess.interruption_count += 1
    except asyncio.CancelledError:
        pass


# ═══════════════════════════════════════════════
# 文字输入处理（Phase 4）
# ═══════════════════════════════════════════════

async def _handle_text_input(ws: WebSocket, sess: RealtimeSession, text: str):
    """处理文字输入：立即作为"已转写"文本发送，直接检查触发条件。"""
    logger.info("文字输入 session=%s len=%d text=%.60s", sess.session_id, len(text), text)

    # 发送 transcript 事件（标记 source=text）
    sess.partial_text = text
    sess.asr_seq += 1
    await _ws_send(ws, {
        "type": "transcript",
        "text": text,
        "is_partial": True,
        "seq": sess.asr_seq,
        "source": "text",
    })

    # 如果在生成中，检查中断
    if sess.is_generating:
        gen_state = GenerationState(
            full_text=sess.partial_text,
            is_generating=True,
            generating_prompt=sess.generation_trigger_text,
            generated_tokens=sess.generated_token_count,
            interruption_count=sess.interruption_count,
        )
        do_interrupt, reason = should_interrupt(
            gen_state, text, sess.generated_token_count,
        )
        if do_interrupt:
            logger.info("文字输入中断LLM reason=%s", reason)
            await sess.token_queue.put({"type": "llm_interrupted", "reason": reason})
            if sess.llm_task and not sess.llm_task.done():
                sess.llm_task.cancel()
            sess.generation_trigger_text = text
            sess.is_generating = True
            sess.llm_task = asyncio.create_task(
                _run_llm_generation(ws, sess, text)
            )
        return

    # 文字输入总是立即触发（用户主动打字 = 意图明确）
    await _ws_send(ws, {
        "type": "llm_start",
        "trigger_reason": "text_input",
        "text": text[:80],
    })
    sess.is_generating = True
    sess.generation_trigger_text = text
    sess.llm_task = asyncio.create_task(
        _run_llm_generation(ws, sess, text)
    )


# ═══════════════════════════════════════════════
# ASR 逻辑
# ═══════════════════════════════════════════════

async def _do_incremental_asr(ws: WebSocket, sess: RealtimeSession):
    """增量 ASR：取累积音频 → 调用识别 → 检查触发条件。"""
    sess.is_asr_running = True

    try:
        audio_b64, audio_fmt = sess.get_accumulated_audio()
        if not audio_b64:
            return

        # 在 executor 中运行同步 ASR
        loop = asyncio.get_event_loop()
        asr_result = await loop.run_in_executor(
            None,
            _call_asr_sync,
            audio_b64,
            audio_fmt,
        )

        text = asr_result.get("text", "").strip() if asr_result else ""
        confidence = asr_result.get("confidence", 0.0) if asr_result else 0.0

        if not text:
            return

        # 发送部分转写结果
        sess.partial_text = text
        sess.asr_seq += 1
        await _ws_send(ws, {
            "type": "transcript",
            "text": text,
            "is_partial": True,
            "seq": sess.asr_seq,
            "confidence": confidence,
        })

        # 检查是否应触发 LLM

        # 如果已经在生成中，检查是否需要中断
        if sess.is_generating:
            gen_state = GenerationState(
                full_text=sess.partial_text,
                is_generating=True,
                generating_prompt=sess.generation_trigger_text,
                generated_tokens=sess.generated_token_count,
                interruption_count=sess.interruption_count,
            )
            do_interrupt, reason = should_interrupt(
                gen_state, text, sess.generated_token_count,
            )
            if do_interrupt:
                logger.info("中断LLM生成 reason=%s text=%s", reason, text[:50])
                # 发送中断信号（token_send_loop 处理）
                await sess.token_queue.put({"type": "llm_interrupted", "reason": reason})
                # 取消旧的 LLM 任务
                if sess.llm_task and not sess.llm_task.done():
                    sess.llm_task.cancel()
                # 稍后重新触发
                sess.generation_trigger_text = text
                sess.is_generating = True
                sess.llm_task = asyncio.create_task(
                    _run_llm_generation(ws, sess, text)
                )
            return

        # 检查触发条件
        should_trigger, reason = should_trigger_llm(
            partial_text=text,
            module=sess.module,
            last_audio_time=sess.last_audio_time,
            previous_text=sess.last_asr_text,
        )

        sess.last_asr_text = text

        if should_trigger and not sess.is_generating:
            logger.info("触发LLM预生成 reason=%s text_len=%d module=%s",
                        reason, len(text), sess.module)

            await _ws_send(ws, {
                "type": "llm_start",
                "trigger_reason": reason,
                "text": text[:80],
            })

            sess.is_generating = True
            sess.generation_trigger_text = text
            sess.llm_task = asyncio.create_task(
                _run_llm_generation(ws, sess, text)
            )

    except Exception:
        logger.exception("增量ASR异常")
    finally:
        sess.is_asr_running = False


def _call_asr_sync(audio_b64: str, audio_fmt: str) -> dict[str, Any]:
    """同步 ASR 调用（在 executor 中运行）。"""
    from ..voice_engine.service import recognize_speech

    try:
        return recognize_speech(
            audio_base64=audio_b64,
            audio_format=audio_fmt,
        )
    except Exception as e:
        logger.warning("ASR调用失败: %s", e)
        return {"text": "", "confidence": 0.0}


async def _final_asr_and_generate(ws: WebSocket, sess: RealtimeSession):
    """用户停止录音后：最终 ASR → 触发 LLM。"""
    # 如果已有 partial text 且正在生成 → 等生成完成
    if sess.is_generating and sess.partial_text:
        await _ws_send(ws, {
            "type": "status",
            "stage": "generating",
            "text": sess.partial_text,
        })
        return

    # 最终 ASR
    audio_b64, audio_fmt = sess.get_accumulated_audio()
    if not audio_b64 and not sess.partial_text:
        await _ws_send(ws, {"type": "error", "message": "未检测到有效语音"})
        await _ws_send(ws, {"type": "status", "stage": "done"})
        sess.is_active = False
        return

    if audio_b64:
        loop = asyncio.get_event_loop()
        asr_result = await loop.run_in_executor(
            None, _call_asr_sync, audio_b64, audio_fmt,
        )
        text = asr_result.get("text", "").strip() if asr_result else ""
        if text:
            sess.partial_text = text
            await _ws_send(ws, {
                "type": "transcript",
                "text": text,
                "is_partial": False,
                "confidence": asr_result.get("confidence", 0.0) if asr_result else 0.0,
            })

    final_text = sess.partial_text.strip()
    if not final_text:
        await _ws_send(ws, {"type": "error", "message": "未能识别到有效语音内容"})
        await _ws_send(ws, {"type": "status", "stage": "done"})
        sess.is_active = False
        return

    # 如果 LLM 已经生成过且 prompt 相同 → 等待完成
    if sess.is_generating and sess.generation_trigger_text == final_text:
        await _ws_send(ws, {"type": "status", "stage": "generating"})
        return

    # 启动/重启 LLM 生成
    await _ws_send(ws, {
        "type": "status",
        "stage": "generating",
        "text": final_text,
    })

    sess.is_generating = True
    sess.generation_trigger_text = final_text

    if sess.llm_task and not sess.llm_task.done():
        sess.llm_task.cancel()

    sess.llm_task = asyncio.create_task(
        _run_llm_generation(ws, sess, final_text, is_final=True)
    )


# ═══════════════════════════════════════════════
# LLM 生成
# ═══════════════════════════════════════════════

async def _run_llm_generation(
    ws: WebSocket,
    sess: RealtimeSession,
    prompt_text: str,
    is_final: bool = False,
):
    """在 executor 中运行 LLM 流式生成，token 推入队列。"""
    try:
        loop = asyncio.get_event_loop()

        # 构建 system prompt
        from ...engines.persona import build_persona_prompt
        system_prompt = build_persona_prompt(module=sess.module)

        # 在 executor 中运行同步生成器
        def _generate():
            from ...engines.llm_orchestrator import llm_generate_stream_with_orchestration
            tokens = []
            try:
                for token in llm_generate_stream_with_orchestration(
                    prompt=prompt_text,
                    system_prompt=system_prompt,
                    module=sess.module,
                    temperature=0.7,
                    user_id=sess.user_id,
                    db=None,
                ):
                    tokens.append(token)
            except Exception as e:
                logger.exception("LLM流式生成失败")
                tokens.append(f"[生成失败: {str(e)}]")
            return tokens

        tokens = await loop.run_in_executor(None, _generate)

        # 逐 token 推入队列
        model_used = "stream"
        for token in tokens:
            if not sess.is_active:
                break
            # 检查是否被中断
            if not sess.is_generating or sess.generation_trigger_text != prompt_text:
                break
            sess.generated_token_count += 1
            await sess.token_queue.put({
                "type": "llm_token",
                "token": token,
            })

        # 发送完成事件
        if sess.is_active and sess.is_generating:
            await sess.token_queue.put({
                "type": "llm_done",
                "model_used": model_used,
                "token_count": sess.generated_token_count,
            })

            if is_final:
                await _ws_send(ws, {
                    "type": "status",
                    "stage": "done",
                    "session_id": sess.session_id,
                })
                sess.is_active = False

    except asyncio.CancelledError:
        pass
    except Exception:
        logger.exception("LLM生成任务异常")
        await sess.token_queue.put({
            "type": "llm_done",
            "model_used": "error",
        })


# ═══════════════════════════════════════════════
# 工具
# ═══════════════════════════════════════════════

async def _ws_send(ws: WebSocket, data: dict):
    """安全发送 WebSocket JSON 消息。"""
    try:
        await ws.send_json(data)
    except Exception:
        pass


async def _cleanup_session(sess: RealtimeSession):
    """清理会话资源。"""
    sess.is_active = False

    for task in [sess.asr_check_task, sess.heartbeat_task, sess.llm_task]:
        if task and not task.done():
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass

    sess.audio_buffer.clear()
    logger.info("会话清理完成 session=%s", sess.session_id)
