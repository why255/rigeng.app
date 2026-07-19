"""RAG L1 Redis 缓存 —— 高频查询结果缓存,命中时跳过 pgvector 向量检索。

设计要点:
1. **专用 DB**:使用 settings.REDIS_RAG_DB(默认 DB1),与全局 REDIS_URL(DB0)隔离
2. **错误容忍**:Redis 不可用/超时 → 静默降级(get 返回 None,set 忽略),不影响主流程
3. **Key 隔离**:以 user_id + module + top_k + query_hash 为组合键,避免不同用户/模块串扰
4. **TTL**:默认 REDIS_RAG_TTL_SECONDS=3600 秒
5. **可关闭**:RAG_CACHE_ENABLED=False 时全部旁路

缓存值格式:JSON `{"prompt": str, "sources": list, "cached_at": float}`
"""
from __future__ import annotations

import hashlib
import json
import logging
import time
from typing import Any
from urllib.parse import urlparse, urlunparse

from app.shared.config import settings

logger = logging.getLogger("rag.cache")

_CACHE_VERSION = "v1"       # 结构版本,变更时递增可强制失效旧数据
_KEY_PREFIX = f"rag:{_CACHE_VERSION}"

_redis_client = None        # 懒初始化


def _build_rag_redis_url() -> str:
    """将 REDIS_URL 的 DB 段替换为 REDIS_RAG_DB。

    例如: redis://localhost:6379/0 → redis://localhost:6379/1
    """
    parsed = urlparse(settings.REDIS_URL)
    return urlunparse(parsed._replace(path=f"/{settings.REDIS_RAG_DB}"))


def _get_client():
    """惰性获取 Redis 客户端。任何异常返回 None,让调用方走降级。"""
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        import redis
        _redis_client = redis.Redis.from_url(
            _build_rag_redis_url(),
            decode_responses=True,
            socket_connect_timeout=1,
            socket_timeout=1,
            retry_on_timeout=False,
        )
        # 首次连通性探测(失败时保留 client 以便后续单条调用继续尝试)
        _redis_client.ping()
        logger.info("RAG cache Redis connected: %s (db=%d)",
                    settings.REDIS_URL, settings.REDIS_RAG_DB)
    except Exception as e:
        logger.warning("RAG cache Redis unavailable, cache disabled: %s", e)
        _redis_client = None
    return _redis_client


def _reset_client_for_tests() -> None:
    """测试专用:重置客户端单例。"""
    global _redis_client
    _redis_client = None


def make_cache_key(user_id: str, module: str, query: str, top_k: int) -> str:
    """生成缓存键。

    key = rag:v1:{user_id}:{module}:{top_k}:{sha256(normalized_query)[:16]}
    """
    normalized = " ".join(query.strip().lower().split())
    query_hash = hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:16]
    return f"{_KEY_PREFIX}:{user_id}:{module}:{top_k}:{query_hash}"


def get_cached(user_id: str, module: str, query: str, top_k: int
               ) -> tuple[str, list[dict[str, Any]]] | None:
    """读缓存。命中返回 (prompt_text, sources_list),未命中/失败返回 None。"""
    if not settings.RAG_CACHE_ENABLED:
        return None
    client = _get_client()
    if client is None:
        return None
    key = make_cache_key(user_id, module, query, top_k)
    try:
        raw = client.get(key)
        if raw is None:
            return None
        data = json.loads(raw)
        return data.get("prompt", ""), data.get("sources", [])
    except Exception as e:
        logger.debug("RAG cache get failed for key=%s: %s", key, e)
        return None


def set_cached(user_id: str, module: str, query: str, top_k: int,
               prompt: str, sources: list[dict[str, Any]],
               ttl: int | None = None) -> bool:
    """写缓存。空结果不写(避免负缓存放大风暴)。返回是否写入成功。"""
    if not settings.RAG_CACHE_ENABLED:
        return False
    # 空结果不缓存 —— 检索失败/超时/无匹配时,下次请求应重新走检索
    if not prompt and not sources:
        return False
    client = _get_client()
    if client is None:
        return False
    key = make_cache_key(user_id, module, query, top_k)
    payload = json.dumps(
        {"prompt": prompt, "sources": sources, "cached_at": time.time()},
        ensure_ascii=False,
    )
    try:
        client.setex(key, ttl or settings.REDIS_RAG_TTL_SECONDS, payload)
        return True
    except Exception as e:
        logger.debug("RAG cache set failed for key=%s: %s", key, e)
        return False


def invalidate_user(user_id: str) -> int:
    """清除某用户全部 RAG 缓存(如私有库文档变更时调用)。返回删除的 key 数。"""
    client = _get_client()
    if client is None:
        return 0
    pattern = f"{_KEY_PREFIX}:{user_id}:*"
    try:
        deleted = 0
        for key in client.scan_iter(match=pattern, count=200):
            client.delete(key)
            deleted += 1
        return deleted
    except Exception as e:
        logger.debug("RAG cache invalidate_user(%s) failed: %s", user_id, e)
        return 0
