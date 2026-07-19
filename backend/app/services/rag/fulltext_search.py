"""RAG L2 全文检索 —— Meilisearch 客户端封装。

设计要点:
1. **懒初始化**:MEILISEARCH_ENABLED=False 或客户端未部署时,search() 直接返回 [] 不阻塞
2. **超时降级**:HTTP 请求走 MEILISEARCH_TIMEOUT_MS 超时,超时/异常 → 静默返回 [] 让上游走 pgvector
3. **结果标准化**:返回结构与 search_rag._doc_to_result 对齐(doc_id/title/snippet/score/source),便于合并去重
4. **索引契约**:索引名 = settings.MEILISEARCH_INDEX_NAME;文档 primary key = "doc_id"
   - searchableAttributes: content, title, citation_title
   - filterableAttributes: user_id, library_type, is_negative_blocked, deleted
"""
from __future__ import annotations

import logging
import time
from typing import Any

from app.shared.config import settings

logger = logging.getLogger("rag.fulltext")

_client = None            # 懒初始化的 meilisearch.Client
_index_ready = False      # 索引就绪标记(避免每次都探测)


# ═══════════════════════════════════════════════════════════
# 客户端管理
# ═══════════════════════════════════════════════════════════

def _get_client():
    """惰性获取 Meilisearch 客户端。不可用/未启用返回 None。"""
    global _client
    if not settings.MEILISEARCH_ENABLED:
        return None
    if _client is not None:
        return _client
    try:
        import meilisearch  # type: ignore
        timeout_s = max(settings.MEILISEARCH_TIMEOUT_MS / 1000.0, 0.05)
        _client = meilisearch.Client(
            settings.MEILISEARCH_URL,
            settings.MEILISEARCH_API_KEY or None,
            timeout=timeout_s,
        )
        # 健康探测:health() 快速返回 {"status": "available"}
        _client.health()
        logger.info("Meilisearch connected: %s index=%s",
                    settings.MEILISEARCH_URL, settings.MEILISEARCH_INDEX_NAME)
    except Exception as e:
        logger.warning("Meilisearch unavailable, fulltext disabled: %s", e)
        _client = None
    return _client


def _reset_client_for_tests() -> None:
    """测试专用:重置客户端和就绪标记。"""
    global _client, _index_ready
    _client = None
    _index_ready = False


# ═══════════════════════════════════════════════════════════
# 索引配置(migration 脚本与运行期共用)
# ═══════════════════════════════════════════════════════════

SEARCHABLE_ATTRS = ["content", "title", "citation_title"]
FILTERABLE_ATTRS = ["user_id", "library_type", "is_negative_blocked", "deleted"]
DISPLAYED_ATTRS = [
    "doc_id", "title", "snippet", "library_type", "doc_type",
    "hr_category", "hr_module", "citation_title", "is_wisdom",
    "updated_at", "user_id",
]


def ensure_index(client=None) -> bool:
    """确保索引存在且属性配置正确。migration 脚本首次调用。

    返回 True 表示索引已就绪。任何异常静默返回 False。
    """
    client = client or _get_client()
    if client is None:
        return False
    try:
        index = client.index(settings.MEILISEARCH_INDEX_NAME)
        # 幂等创建:若已存在会返回 202 但不报错
        try:
            client.create_index(
                settings.MEILISEARCH_INDEX_NAME,
                {"primaryKey": "doc_id"},
            )
        except Exception:
            pass  # 已存在
        index.update_searchable_attributes(SEARCHABLE_ATTRS)
        index.update_filterable_attributes(FILTERABLE_ATTRS)
        index.update_displayed_attributes(DISPLAYED_ATTRS)
        return True
    except Exception as e:
        logger.warning("Meilisearch ensure_index failed: %s", e)
        return False


# ═══════════════════════════════════════════════════════════
# 检索
# ═══════════════════════════════════════════════════════════

def _build_filter(user_id: str | None, sources: list[str] | None) -> str | None:
    """构建 Meilisearch filter 表达式。

    - 始终过滤 is_negative_blocked=false, deleted=false
    - sources=['public']:library_type='public'
    - sources=['private']:library_type='private' AND user_id=<user_id>
    - 默认(None 或包含 public+private):公有 OR (私有 AND 本人)
    """
    base = ["is_negative_blocked = false", "deleted = false"]

    if sources and "private" in sources and "public" not in sources:
        if not user_id:
            return None  # 私有必须绑定用户
        base.append("library_type = 'private'")
        base.append(f"user_id = '{user_id}'")
    elif sources and "public" in sources and "private" not in sources:
        base.append("library_type = 'public'")
    else:
        # 默认:公有 OR (私有 AND 本人)
        if user_id:
            base.append(
                f"(library_type = 'public' OR "
                f"(library_type = 'private' AND user_id = '{user_id}'))"
            )
        else:
            base.append("library_type = 'public'")
    return " AND ".join(base)


def search(
    query: str,
    user_id: str | None = None,
    sources: list[str] | None = None,
    top_n: int = 5,
) -> list[dict[str, Any]]:
    """Meilisearch 全文检索。

    Args:
        query: 用户提问
        user_id: 用户 ID(私有库过滤用;None 时仅返回公有库结果)
        sources: 来源过滤,同 search_rag 语义
        top_n: 每次返回的最大结果数

    Returns:
        标准化结果列表:[{doc_id, title, snippet, score, source, ...}, ...]
        任何失败/未启用/超时 → 返回 [](上游继续走 pgvector,不阻塞)
    """
    if not settings.MEILISEARCH_ENABLED:
        return []
    q = (query or "").strip()
    if not q:
        return []

    client = _get_client()
    if client is None:
        return []

    filter_expr = _build_filter(user_id, sources)
    t0 = time.time()
    try:
        index = client.index(settings.MEILISEARCH_INDEX_NAME)
        params: dict[str, Any] = {
            "limit": max(1, top_n),
            "attributesToRetrieve": DISPLAYED_ATTRS,
            "attributesToHighlight": ["content", "title"],
            "attributesToCrop": ["content"],
            "cropLength": 60,
        }
        if filter_expr:
            params["filter"] = filter_expr
        res = index.search(q, params)
    except Exception as e:
        logger.debug("Meilisearch search failed (query=%s): %s", q[:30], e)
        return []

    hits = res.get("hits", []) if isinstance(res, dict) else []
    elapsed_ms = int((time.time() - t0) * 1000)
    if elapsed_ms > settings.MEILISEARCH_TIMEOUT_MS:
        logger.debug("Meilisearch slow: %dms > %dms budget",
                     elapsed_ms, settings.MEILISEARCH_TIMEOUT_MS)

    return [_normalize_hit(h, q, idx, len(hits)) for idx, h in enumerate(hits)]


def _normalize_hit(hit: dict, query: str, idx: int, total: int) -> dict[str, Any]:
    """把 Meilisearch hit 转成与 search_rag._doc_to_result 对齐的字典。

    Meilisearch 不直接给相关性分数(除非 showRankingScore=true),
    这里用「排名反比」作为 score 保证与 pgvector 的 similarity 语义可比。
    """
    # 优先用 _formatted 里的高亮片段作为 snippet
    formatted = hit.get("_formatted", {})
    snippet = (
        formatted.get("content")
        or hit.get("snippet")
        or (hit.get("content") if isinstance(hit.get("content"), str) else None)
        or hit.get("title")
        or ""
    )
    if isinstance(snippet, str) and len(snippet) > 220:
        snippet = snippet[:220] + "..."

    # score: 若显式携带 _rankingScore 直接用,否则用 1 - idx/total 近似
    if "_rankingScore" in hit:
        try:
            score = float(hit["_rankingScore"])
        except (TypeError, ValueError):
            score = None
    else:
        score = round(1.0 - idx / max(total, 1), 4)

    return {
        "doc_id": hit.get("doc_id"),
        "title": hit.get("title") or "未命名文档",
        "snippet": snippet,
        "score": score,
        "source": hit.get("library_type") or "public",
        "doc_type": hit.get("doc_type"),
        "hr_category": hit.get("hr_category"),
        "hr_module": hit.get("hr_module"),
        "citation_title": hit.get("citation_title"),
        "is_wisdom": bool(hit.get("is_wisdom", False)),
        "updated_at": hit.get("updated_at") or "",
        "engine": "meilisearch",
    }


# ═══════════════════════════════════════════════════════════
# 索引维护(供 migration 脚本与运行期文档同步调用)
# ═══════════════════════════════════════════════════════════

def upsert_documents(docs: list[dict[str, Any]]) -> int:
    """批量写入 Meilisearch。返回入库文档数,失败静默返回 0。

    每个 doc 必含 primary key `doc_id`。
    """
    if not docs:
        return 0
    client = _get_client()
    if client is None:
        return 0
    try:
        index = client.index(settings.MEILISEARCH_INDEX_NAME)
        index.add_documents(docs, primary_key="doc_id")
        return len(docs)
    except Exception as e:
        logger.warning("Meilisearch upsert failed (n=%d): %s", len(docs), e)
        return 0


def delete_document(doc_id: str) -> bool:
    """从索引删除单个文档。任何失败静默返回 False。"""
    if not doc_id:
        return False
    client = _get_client()
    if client is None:
        return False
    try:
        index = client.index(settings.MEILISEARCH_INDEX_NAME)
        index.delete_document(doc_id)
        return True
    except Exception as e:
        logger.debug("Meilisearch delete failed doc_id=%s: %s", doc_id, e)
        return False


def get_stats() -> dict[str, Any]:
    """健康检查/管理面板用。失败返回 {enabled:False}。"""
    if not settings.MEILISEARCH_ENABLED:
        return {"enabled": False, "reason": "MEILISEARCH_ENABLED=False"}
    client = _get_client()
    if client is None:
        return {"enabled": False, "reason": "client unavailable"}
    try:
        index = client.index(settings.MEILISEARCH_INDEX_NAME)
        stats = index.get_stats()
        # SDK 有时返回对象、有时返回 dict;统一取字段
        n_docs = getattr(stats, "number_of_documents", None)
        if n_docs is None and isinstance(stats, dict):
            n_docs = stats.get("numberOfDocuments")
        return {
            "enabled": True,
            "url": settings.MEILISEARCH_URL,
            "index": settings.MEILISEARCH_INDEX_NAME,
            "document_count": n_docs,
        }
    except Exception as e:
        return {"enabled": False, "reason": str(e)}
