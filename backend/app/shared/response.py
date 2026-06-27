"""统一响应信封（步骤3 §1.3）。

成功：{ code:0, message:"ok", data:{...}, trace_id }
失败：{ code:业务码, message:..., data:null, trace_id }
分页：data = { items, total, page, page_size }
"""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse

from .errors import APIError


def _trace_id() -> str:
    return uuid.uuid4().hex


def ok(data: Any = None, message: str = "ok") -> dict:
    return {"code": 0, "message": message, "data": data, "trace_id": _trace_id()}


def page(items: list, total: int, page_no: int = 1, page_size: int = 20) -> dict:
    return ok({"items": items, "total": total, "page": page_no, "page_size": page_size})


def fail(err: APIError) -> dict:
    return {"code": err.code, "message": err.message, "data": None, "trace_id": _trace_id()}


# ── 全局异常处理器（注册到 FastAPI app）──
async def api_error_handler(request: Request, exc: APIError) -> JSONResponse:
    return JSONResponse(status_code=exc.http_status, content=fail(exc))


async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    from .errors import E_INTERNAL

    return JSONResponse(status_code=500, content=fail(E_INTERNAL))
