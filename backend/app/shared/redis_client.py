"""Redis 客户端单例（同步，匹配 FastAPI 同步 endpoint）。

延迟连接：首次使用时才建立连接，避免启动时 Redis 不可用或 redis-py 未安装导致崩溃。
"""
from __future__ import annotations

from .config import settings

_redis_client = None


def _get_client():
    global _redis_client
    if _redis_client is None:
        import redis
        _redis_client = redis.Redis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=3,
            socket_timeout=3,
            retry_on_timeout=True,
        )
    return _redis_client


class _RedisProxy:
    """代理对象，惰性转发所有调用到真正的 Redis 客户端。"""

    def __getattr__(self, name):
        return getattr(_get_client(), name)


redis_client: any = _RedisProxy()  # type: ignore[assignment]
