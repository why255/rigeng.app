"""Redis 客户端单例（同步，匹配 FastAPI 同步 endpoint）。"""
from __future__ import annotations

import redis

from .config import settings

redis_client = redis.Redis.from_url(
    settings.REDIS_URL,
    decode_responses=True,       # 自动 str 解码，避免 b'xxx'
    socket_connect_timeout=3,
    socket_timeout=3,
    retry_on_timeout=True,
)
