"""
轻量级速率限制（Redis 主 · 内存回退）。

用法:
    from .shared.rate_limit import RateLimiter

    limiter = RateLimiter(max_requests=30, window=60)  # 每分钟30次

    @app.get("/api/v1/version/check")
    def check_version(apk_version_code: int = 0, _rate: None = Depends(limiter)):
        ...
"""
from __future__ import annotations

import time
import threading
from typing import Optional

from fastapi import Request, HTTPException

from .config import settings

# ── 内存回退（Redis 不可用时使用） ──
_mem_store: dict[str, tuple[int, float]] = {}       # key → (count, window_start)
_mem_lock = threading.Lock()


def _try_redis(key: str, max_requests: int, window: int) -> bool:
    """Redis 令牌桶 / 固定窗口。Redis 不可用时返回 None（触发回退）。"""
    try:
        from .redis_client import redis_client
        now = time.time()
        # 固定窗口：key + window 序号
        bucket = f"rl:{key}:{int(now // window)}"
        current = redis_client.incr(bucket)
        if current == 1:
            redis_client.expire(bucket, window + 1)
        return current <= max_requests
    except Exception:
        return None  # Redis 不可用 → 回退到内存


def _try_memory(key: str, max_requests: int, window: int) -> bool:
    """内存固定窗口。"""
    now = time.time()
    with _mem_lock:
        if key in _mem_store:
            count, start = _mem_store[key]
            if now - start > window:
                _mem_store[key] = (1, now)
                return True
            if count >= max_requests:
                return False
            _mem_store[key] = (count + 1, start)
            return True
        else:
            _mem_store[key] = (1, now)
            return True

    # 清理过期条目（低频）
    if len(_mem_store) > 10000:
        with _mem_lock:
            expired = [k for k, (_, s) in _mem_store.items() if now - s > 300]
            for k in expired:
                del _mem_store[k]


def _get_client_ip(request: Request) -> str:
    """从请求中提取客户端 IP（处理代理头）。"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()
    # 回退到直连 IP
    if request.client:
        return request.client.host
    return "unknown"


class RateLimiter:
    """FastAPI 依赖注入式速率限制器。"""

    def __init__(self, max_requests: int = 30, window: int = 60,
                 key_prefix: str = "global"):
        """
        Args:
            max_requests: 窗口内最大请求数
            window: 时间窗口（秒）
            key_prefix: Redis key 前缀
        """
        self.max_requests = max_requests
        self.window = window
        self.key_prefix = key_prefix

    async def __call__(self, request: Request):
        ip = _get_client_ip(request)
        key = f"{self.key_prefix}:{ip}"

        # 优先 Redis，不可用时降级到内存
        result = _try_redis(key, self.max_requests, self.window)
        if result is None:
            result = _try_memory(key, self.max_requests, self.window)

        if not result:
            raise HTTPException(
                status_code=429,
                detail={
                    "code": 429,
                    "message": f"请求过于频繁，请 {self.window} 秒后重试",
                    "data": None,
                },
            )

        return True
