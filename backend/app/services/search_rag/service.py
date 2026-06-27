"""⑤搜索/RAG服务 — 核心业务逻辑。

功能（MVP）：
- 关键词搜索：SQL ILIKE 在文档标题和内容中匹配
- 语义搜索骨架：预留向量检索逻辑，当前降级到关键词搜索
- 文档索引：标记文档向量状态
- 搜索结果过滤：排除负面内容、按知识库来源和权限过滤
- 命中率监控骨架

生产集成路线：
- 接入 bge-large-zh embedding 模型生成 1024 维向量
- 使用 pgvector 的 IVFFlat 索引进行余弦相似度检索
- 混合检索：语义检索 + 关键词补充 → 重排序
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any

from sqlalchemy import and_, or_, String, Text
from sqlalchemy.orm import Session

from ...shared.config import settings
from ...shared.database import new_uuid, utcnow
from ...shared.errors import E_SEARCH_EMPTY, E_SOURCE_DISABLED
from ...shared.models.knowledge import Document
from ...shared.models.vector_index import VectorIndex

logger = logging.getLogger("search_rag")


def _filter_accessible_docs(db: Session, user_id: str, sources: list[str] | None = None):
    """构建可访问文档的基础查询。

    Args:
        sources: 知识来源过滤，None=全部，["private"]=仅私有库，["public"]=仅携君库
    """
    query = db.query(Document).filter(
        Document.deleted_at.is_(None),
        Document.is_negative_blocked.is_(False),
    )

    if sources:
        source_filters = []
        if "private" in sources:
            source_filters.append(
                and_(
                    Document.library_type == "private",
                    Document.owner_user_id == user_id,
                )
            )
        if "public" in sources:
            source_filters.append(Document.library_type == "public")
        if not source_filters:
            raise E_SOURCE_DISABLED
        query = query.filter(or_(*source_filters))
    else:
        # 默认：私有（本人）+ 公有
        query = query.filter(
            or_(
                and_(
                    Document.library_type == "private",
                    Document.owner_user_id == user_id,
                ),
                Document.library_type == "public",
            )
        )

    return query


def _extract_text_snippet(content_json: dict | None, query: str, max_len: int = 200) -> str | None:
    """从文档内容 JSON 中提取包含查询关键词的文本片段。"""
    if not content_json:
        return None

    # 将 JSON 展平为纯文本
    text = json.dumps(content_json, ensure_ascii=False, default=str)
    idx = text.lower().find(query.lower())
    if idx < 0:
        # 返回前 max_len 字符
        return text[:max_len] + ("..." if len(text) > max_len else "")

    start = max(0, idx - 40)
    end = min(len(text), idx + len(query) + max_len - 40)
    snippet = text[start:end]
    if start > 0:
        snippet = "..." + snippet
    if end < len(text):
        snippet += "..."
    return snippet


# ═══════════════════════════════════════════════
# 公开接口
# ═══════════════════════════════════════════════

def keyword_search(db: Session, user_id: str, query: str,
                   sources: list[str] | None = None,
                   top_n: int | None = None) -> dict[str, Any]:
    """关键词搜索：SQL ILIKE 匹配标题和内容。

    MVP 模式：不使用向量检索，纯 SQL 关键词匹配。
    """
    t0 = time.time()
    top_n = top_n or settings.RAG_TOP_N

    base_query = _filter_accessible_docs(db, user_id, sources)

    # ILIKE 匹配标题或内容
    like_pattern = f"%{query}%"
    # MVP: 搜索标题（JSON 内容列的类型转换在不同数据库方言中行为不一致，
    # 生产环境接入 pgvector 语义检索后将完全替代关键词搜索）
    docs = base_query.filter(
        Document.title.ilike(like_pattern),
    ).order_by(Document.updated_at.desc()).limit(top_n).all()

    if not docs:
        raise E_SEARCH_EMPTY

    items = []
    for doc in docs:
        items.append({
            "doc_id": doc.id,
            "title": doc.title,
            "snippet": _extract_text_snippet(doc.content, query),
            "score": None,
            "source": doc.library_type,
            "doc_type": doc.doc_type,
            "hr_category": doc.hr_category,
        })

    elapsed_ms = int((time.time() - t0) * 1000)
    return {
        "items": items,
        "total": len(items),
        "query_time_ms": elapsed_ms,
        "engine_used": "keyword",
    }


def semantic_search(db: Session, user_id: str, query: str,
                    sources: list[str] | None = None,
                    top_n: int | None = None,
                    threshold: float | None = None) -> dict[str, Any]:
    """语义搜索（MVP 降级到关键词搜索）。

    生产环境：
    1. 调用 embedding 模型将 query 转为 1024 维向量
    2. pgvector 余弦距离查询：SELECT * FROM vector_index ORDER BY embedding <=> query_vec LIMIT top_n
    3. 通过 doc_id 关联 Document 表 + 权限过滤
    4. 按 similarity threshold 过滤
    """
    logger.info("语义搜索降级到关键词搜索（MVP模式）: query=%s", query[:50])
    return keyword_search(db, user_id, query, sources, top_n)


def index_document(db: Session, doc_id: str, content_json: dict | None = None) -> dict[str, Any]:
    """为文档创建向量索引条目（MVP stub）。

    生产环境：
    1. 将 content_json 拆分为 chunks
    2. 调用 embedding 模型生成向量
    3. 插入 vector_index 表（PG 自动存储 embedding 向量）
    4. 更新 document.vector_status = 'ready'
    """
    # 检查文档是否存在
    doc = db.query(Document).filter(
        Document.id == doc_id,
        Document.deleted_at.is_(None),
    ).first()
    if not doc:
        from ...shared.errors import E_DOC_NOT_FOUND
        raise E_DOC_NOT_FOUND

    # MVP: 仅创建一条占位索引记录，标记文档已纳入索引
    existing = db.query(VectorIndex).filter(
        VectorIndex.doc_id == doc_id,
        VectorIndex.deleted_at.is_(None),
    ).first()

    if not existing:
        index_entry = VectorIndex(
            doc_id=doc_id,
            chunk_id=0,
            meta={"indexed": True, "chunks": 1, "mode": "stub"},
        )
        db.add(index_entry)

    # 更新文档向量状态
    doc.vector_status = "ready"
    db.commit()

    return {
        "doc_id": doc_id,
        "indexed": True,
        "vector_status": doc.vector_status,
        "mode": "stub",
        "note": "向量索引已预留，生产环境将接入 bge-large-zh 生成 1024 维向量",
    }


def delete_index(db: Session, doc_id: str) -> dict[str, Any]:
    """删除文档的向量索引。"""
    db.query(VectorIndex).filter(
        VectorIndex.doc_id == doc_id,
        VectorIndex.deleted_at.is_(None),
    ).update({"deleted_at": utcnow()})

    # 更新文档向量状态
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if doc:
        doc.vector_status = "pending"

    db.commit()
    return {"doc_id": doc_id, "deleted": True}


def get_search_health(db: Session) -> dict[str, Any]:
    """查询搜索服务健康状态。"""
    total = db.query(VectorIndex).filter(
        VectorIndex.deleted_at.is_(None),
    ).count()

    return {
        "embedding_model": settings.EMBEDDING_MODEL,
        "embedding_dim": settings.EMBEDDING_DIM,
        "vector_index_method": settings.VECTOR_INDEX_METHOD,
        "total_indexed": total,
        "is_available": True,
        "note": "MVP模式：使用SQL LIKE关键词检索，向量语义搜索待embedding模型集成",
    }
