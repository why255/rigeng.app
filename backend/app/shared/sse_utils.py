"""SSE 流式输出工具 — 统一 SSE 事件构建与 StreamingResponse 封装。

用法:
    from ...shared.sse_utils import sse_event, sse_done, sse_error, sse_response

    def generate_sse():
        yield sse_event("你好", "content")
        yield sse_event("greeting", "stage_change")
        yield sse_done({"model_used": "doubao-seed-2-0-pro"})

    return sse_response(generate_sse())
"""
from __future__ import annotations

import json
import logging
from typing import Any

from fastapi.responses import StreamingResponse

logger = logging.getLogger("sse_utils")


def sse_event(data: Any, event_type: str = "content") -> str:
    """构建单条 SSE 事件字符串。

    Args:
        data: 事件数据（token 文本或其他 payload）
        event_type: 事件类型 (content|stage_change|sources|done|error|time_reminder)

    Returns:
        SSE 格式字符串: "data: {...}\\n\\n"
    """
    payload = {"type": event_type}
    if event_type == "content":
        payload["token"] = data
    elif event_type == "stage_change":
        payload["stage"] = data
    elif event_type == "sources":
        payload["sources"] = data
    elif event_type == "summary":
        # 双阶段响应 Stage-1:一句话核心建议(<= 20 字)
        payload["content"] = data
    elif event_type == "done":
        payload.update(data)
    elif event_type == "error":
        payload["message"] = data if isinstance(data, str) else str(data)
    elif event_type == "time_reminder":
        payload["message"] = data
    else:
        payload["data"] = data

    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def sse_done(meta: dict[str, Any] | None = None) -> str:
    """构建 SSE done 事件 + [DONE] 终止标记。

    Args:
        meta: 附加元数据 dict (model_used, conversation_id, etc.)
    """
    parts: list[str] = []
    if meta:
        parts.append(sse_event(meta, "done"))
    parts.append("data: [DONE]\n\n")
    return "".join(parts)


def sse_error(message: str) -> str:
    """构建 SSE 错误事件。"""
    return sse_event(message, "error")


def sse_response(generator, media_type: str = "text/event-stream"):
    """包装生成器为 FastAPI StreamingResponse。

    Args:
        generator: 生成器函数，yield SSE 字符串
        media_type: Content-Type（默认 text/event-stream）
    """
    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",  # 禁用 nginx 缓冲
    }
    return StreamingResponse(
        generator,
        media_type=media_type,
        headers=headers,
    )


def stream_tokens_to_sse(tokens, meta: dict[str, Any] | None = None):
    """将 token 生成器包装为 SSE 事件流。

    用法:
        tokens = llm_generate_stream_with_orchestration(...)
        return sse_response(stream_tokens_to_sse(tokens, meta={"model_used": "..."}))
    """
    for token in tokens:
        yield sse_event(token, "content")
    yield sse_done(meta)
