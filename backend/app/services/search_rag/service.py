"""⑤搜索/RAG服务 — 核心业务逻辑。

功能（2026-07-15 升级）：
- 关键词搜索：SQL ILIKE 在文档标题和内容中匹配
- 语义搜索：pgvector余弦相似度检索（生产），SQLite降级到关键词搜索
- 文档索引：标记文档向量状态
- 搜索结果过滤：排除负面内容、按知识库来源和权限过滤
- 健康检查：embedding模型状态、索引统计

生产集成路线：
- 使用 bge-large-zh embedding 模型生成 1024 维向量（API-based）
- 使用 pgvector 的 IVFFlat 索引进行余弦相似度检索
- 混合检索：语义检索 + 关键词补充 → 重排序
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any

from sqlalchemy import and_, or_, String, Text, text
from sqlalchemy.orm import Session

from ...shared.config import settings
from ...shared.database import new_uuid, utcnow
from ...shared.errors import E_SEARCH_EMPTY, E_SOURCE_DISABLED
from ...shared.models.knowledge import Document
from ...shared.models.vector_index import VectorIndex

logger = logging.getLogger("search_rag")

# 尝试导入向量化器（用于语义搜索）
try:
    from ..knowledge_base.vectorizer import get_vectorizer
    _VECTORIZER_AVAILABLE = True
except ImportError:
    _VECTORIZER_AVAILABLE = False


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


def _doc_to_result(doc: Document, query: str, score: float | None = None,
                   source: str | None = None) -> dict[str, Any]:
    """将 Document ORM 对象转为搜索结果字典。"""
    return {
        "doc_id": doc.id,
        "title": doc.title,
        "snippet": _extract_text_snippet(doc.content, query),
        "score": score,
        "source": source or doc.library_type,
        "doc_type": doc.doc_type,
        "hr_category": doc.hr_category,
        "hr_module": doc.hr_module,
        "citation_title": doc.citation_title,
        "is_wisdom": doc.is_wisdom,
        "updated_at": doc.updated_at.isoformat() if doc.updated_at else "",
    }


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
    docs = base_query.filter(
        Document.title.ilike(like_pattern),
    ).order_by(Document.updated_at.desc()).limit(top_n).all()

    if not docs:
        raise E_SEARCH_EMPTY

    items = [_doc_to_result(d, query, source=d.library_type) for d in docs]

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
    """语义搜索：优先使用 pgvector 余弦相似度检索，降级到关键词搜索。

    Args:
        db: 数据库会话。
        user_id: 当前用户ID。
        query: 搜索查询文本。
        sources: 知识来源过滤。
        top_n: 返回结果数。
        threshold: 相似度阈值（默认使用配置值）。

    Returns:
        搜索结果字典，包含 items、total、query_time_ms、engine_used。
    """
    t0 = time.time()
    top_n = top_n or settings.RAG_TOP_N
    threshold = threshold or settings.RAG_SIMILARITY_THRESHOLD

    bind = db.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    # 尝试 pgvector 语义检索
    if is_pg:
        try:
            return _pgvector_semantic_search(db, user_id, query, sources, top_n, threshold, t0)
        except Exception as e:
            logger.warning("pgvector语义检索失败，降级到关键词搜索: %s", e)

    # 降级：关键词搜索
    logger.info("语义搜索降级到关键词搜索: query=%s", query[:50])
    result = keyword_search(db, user_id, query, sources, top_n)
    result["engine_used"] = "keyword(fallback)"
    return result


def _pgvector_semantic_search(
    db: Session, user_id: str, query: str,
    sources: list[str] | None, top_n: int, threshold: float, t0: float,
) -> dict[str, Any]:
    """使用 pgvector 进行语义搜索。

    1. 生成查询向量（API-based embedding 或模拟向量）
    2. 执行 pgvector 余弦相似度检索
    3. 关联 Document 表并过滤权限
    """
    # 生成查询向量
    if _VECTORIZER_AVAILABLE:
        vectorizer = get_vectorizer()
        query_vecs = vectorizer.embed_chunks([query])
        query_vec = query_vecs[0] if query_vecs else []
    else:
        # 模拟向量（确定性，用于开发测试）
        import hashlib
        seed = int(hashlib.md5(query.encode()).hexdigest()[:16], 16)
        dim = settings.EMBEDDING_DIM
        query_vec = [((seed * (j + 1) * 2654435761) % (2**32)) / (2**32) * 2 - 1 for j in range(dim)]
        # L2归一化
        import math
        norm = math.sqrt(sum(v * v for v in query_vec))
        if norm > 0:
            query_vec = [v / norm for v in query_vec]

    vec_str = f"[{', '.join(str(v) for v in query_vec)}]"

    # 构建来源过滤
    source_condition = "1=1"
    if sources:
        if "private" in sources and "public" not in sources:
            source_condition = f"d.library_type = 'private' AND d.owner_user_id = '{user_id}'"
        elif "public" in sources and "private" not in sources:
            source_condition = "d.library_type = 'public'"
        else:
            source_condition = (
                f"(d.library_type = 'public' OR "
                f"(d.library_type = 'private' AND d.owner_user_id = '{user_id}'))"
            )

    # pgvector 余弦相似度检索
    sql = text(f"""
        SELECT d.id, d.title, d.content, d.library_type, d.doc_type,
               d.hr_category, d.hr_module, d.citation_title, d.is_wisdom,
               d.updated_at,
               1 - (vi.embedding <=> :vec::vector) AS similarity
        FROM vector_index vi
        JOIN document d ON vi.doc_id = d.id
        WHERE d.deleted_at IS NULL
          AND d.is_negative_blocked = FALSE
          AND {source_condition}
          AND 1 - (vi.embedding <=> :vec2::vector) > :threshold
        ORDER BY similarity DESC
        LIMIT :top_n
    """)

    try:
        rows = db.execute(
            sql.bindparams(vec=vec_str, vec2=vec_str, threshold=threshold, top_n=top_n),
        ).fetchall()
    except Exception as e:
        logger.error("pgvector查询失败: %s", e)
        raise

    if not rows:
        raise E_SEARCH_EMPTY

    items = []
    for row in rows:
        items.append({
            "doc_id": row.id,
            "title": row.title,
            "snippet": _extract_text_snippet(
                json.loads(row.content) if isinstance(row.content, str) else row.content,
                query,
            ) if row.content else None,
            "score": round(float(row.similarity), 4),
            "source": row.library_type,
            "doc_type": row.doc_type,
            "hr_category": row.hr_category,
            "hr_module": row.hr_module,
            "citation_title": row.citation_title,
            "is_wisdom": row.is_wisdom,
            "updated_at": row.updated_at.isoformat() if row.updated_at else "",
        })

    elapsed_ms = int((time.time() - t0) * 1000)
    return {
        "items": items,
        "total": len(items),
        "query_time_ms": elapsed_ms,
        "engine_used": "pgvector+cosine",
        "threshold": threshold,
        "embedding_dim": settings.EMBEDDING_DIM,
    }


def _l2_hybrid_search(
    db: Session, user_id: str, query: str, top_n: int = 5,
) -> dict[str, Any]:
    """L2 携君库混合检索:Meilisearch 全文 + pgvector 语义 → 合并去重排序。

    合并策略(简化 RRF, Reciprocal Rank Fusion):
    - 每条 item 的融合分 = sum(1 / (60 + rank_in_engine))
    - 同 doc_id 的两路命中相加,天然实现 boost
    - 未启用/未命中的引擎不参与,不影响另一路
    """
    t0 = time.time()
    from ..rag import fulltext_search as _ft

    # 并行(顺序调用,两者都是快操作;避免引入 async 只为并发)
    ft_items = _ft.search(query, user_id=user_id, sources=["public"], top_n=top_n * 2)
    try:
        pg_result = semantic_search(db, user_id, query, sources=["public"], top_n=top_n * 2)
        pg_items = pg_result.get("items", [])
    except Exception as e:
        logger.debug("L2 pgvector 检索失败: %s", e)
        pg_items = []

    # RRF 融合
    K = 60
    fused: dict[str, dict[str, Any]] = {}
    for rank, item in enumerate(ft_items):
        doc_id = item.get("doc_id")
        if not doc_id:
            continue
        fused[doc_id] = dict(item)
        fused[doc_id]["_rrf"] = 1.0 / (K + rank + 1)
        fused[doc_id]["engines"] = ["meilisearch"]

    for rank, item in enumerate(pg_items):
        doc_id = item.get("doc_id")
        if not doc_id:
            continue
        contrib = 1.0 / (K + rank + 1)
        if doc_id in fused:
            fused[doc_id]["_rrf"] += contrib
            fused[doc_id]["engines"].append("pgvector")
            # 保留更长的 snippet
            if len(item.get("snippet", "") or "") > len(fused[doc_id].get("snippet", "") or ""):
                fused[doc_id]["snippet"] = item.get("snippet")
        else:
            fused[doc_id] = dict(item)
            fused[doc_id]["_rrf"] = contrib
            fused[doc_id]["engines"] = ["pgvector"]

    ranked = sorted(fused.values(), key=lambda x: x["_rrf"], reverse=True)[:top_n]
    for item in ranked:
        # 用 RRF 融合分归一化为 [0,1] 便于均值比较 L3 触发阈值
        # 单引擎命中 rank=0 → 1/61 ≈ 0.0164;双引擎命中 rank=0/0 → 2/61 ≈ 0.0328
        # 归一到接近 pgvector similarity 尺度:× 30 后 clip 到 1.0
        item["score"] = min(1.0, round(item.pop("_rrf") * 30, 4))

    elapsed_ms = int((time.time() - t0) * 1000)
    engines_used = []
    if ft_items:
        engines_used.append("meilisearch")
    if pg_items:
        engines_used.append("pgvector")
    return {
        "items": ranked,
        "total": len(ranked),
        "query_time_ms": elapsed_ms,
        "engine_used": "+".join(engines_used) if engines_used else "empty",
    }


def search_layered(
    db: Session,
    user_id: str,
    query: str,
    enabled_sources: list[str] | None = None,
    top_n: int = 5,
) -> dict[str, Any]:
    """A6 三层检索编排:L1(私有库) → L2(携君库) → L3(互联网)。

    L2 层现融合两种引擎:
    - Meilisearch 全文检索(BM25 类相关性,擅长关键词命中)
    - pgvector 余弦相似度(语义相似,擅长同义/近义)
    未启用 Meilisearch 时自动降级为仅 pgvector。
    """
    threshold = getattr(settings, "A6_L3_TRIGGER_THRESHOLD", 0.60)
    if enabled_sources is None:
        enabled_sources = ["private", "public", "internet"]

    result: dict[str, Any] = {
        "layers": {},
        "scores": {"private": 0.0, "public": 0.0, "internet": 0.0},
        "triggered_l3": False,
    }

    # L1: 私有库
    if "private" in enabled_sources:
        try:
            l1 = semantic_search(db, user_id, query, sources=["private"], top_n=top_n)
            result["layers"]["private"] = l1
            scores = [item.get("score", 0) or 0 for item in l1.get("items", [])]
            result["scores"]["private"] = sum(scores) / len(scores) if scores else 0.0
        except Exception as e:
            logger.warning("L1私有库检索失败: %s", e)
            result["layers"]["private"] = {"items": [], "total": 0}

    # L2: 携君智库 — Meilisearch 全文检索 + pgvector 语义,结果合并去重
    if "public" in enabled_sources:
        try:
            l2 = _l2_hybrid_search(db, user_id, query, top_n=top_n)
            result["layers"]["public"] = l2
            scores = [item.get("score", 0) or 0 for item in l2.get("items", [])]
            result["scores"]["public"] = sum(scores) / len(scores) if scores else 0.0
        except Exception as e:
            logger.warning("L2携君库检索失败: %s", e)
            result["layers"]["public"] = {"items": [], "total": 0}

    # L3: 互联网（条件触发）
    max_score = max(result["scores"]["private"], result["scores"]["public"])
    if max_score < threshold and "internet" in enabled_sources:
        result["triggered_l3"] = True
        result["layers"]["internet"] = {
            "items": [],
            "total": 0,
            "note": "L3互联网搜索已触发，实际搜索引擎接入待定",
        }
        result["scores"]["internet"] = 0.0
    else:
        result["layers"]["internet"] = {"items": [], "total": 0}

    return result


def get_search_health(db: Session) -> dict[str, Any]:
    """查询搜索服务健康状态。"""
    total_indexed = db.query(VectorIndex).filter(
        VectorIndex.deleted_at.is_(None),
    ).count()

    bind = db.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    # 检测 pgvector 扩展是否可用
    pgvector_available = False
    if is_pg:
        try:
            db.execute(text("SELECT 1 FROM pg_extension WHERE extname = 'vector'"))
            pgvector_available = True
        except Exception:
            pass

    return {
        "embedding_model": settings.EMBEDDING_MODEL,
        "embedding_dim": settings.EMBEDDING_DIM,
        "vector_index_method": settings.VECTOR_INDEX_METHOD,
        "total_indexed": total_indexed,
        "pgvector_available": pgvector_available,
        "is_available": True,
        "search_mode": "pgvector+cosine" if (is_pg and pgvector_available) else "keyword(fallback)",
        "l3_threshold": getattr(settings, "A6_L3_TRIGGER_THRESHOLD", 0.60),
        "note": "pgvector语义搜索已启用" if (is_pg and pgvector_available)
                else "使用SQL LIKE关键词检索，向量语义搜索待pgvector扩展安装",
    }


def index_document(db: Session, doc_id: str, content_json: dict | None = None) -> dict[str, Any]:
    """为文档创建向量索引条目（生产实现）。

    委托给 knowledge_base.vectorizer 执行实际的切块+向量化+存储。
    """
    doc = db.query(Document).filter(
        Document.id == doc_id,
        Document.deleted_at.is_(None),
    ).first()
    if not doc:
        from ...shared.errors import E_DOC_NOT_FOUND
        raise E_DOC_NOT_FOUND

    if _VECTORIZER_AVAILABLE:
        vectorizer = get_vectorizer()
        # 从 content JSON 中提取文本
        content_text = ""
        if doc.content:
            if isinstance(doc.content, dict):
                content_text = doc.content.get("markdown", "") or json.dumps(doc.content, ensure_ascii=False)
            else:
                content_text = str(doc.content)
        success = vectorizer.index_document(db, doc_id, content_text)
        return {
            "doc_id": doc_id,
            "indexed": success,
            "vector_status": "ready" if success else "failed",
            "mode": "production",
        }
    else:
        # 降级：创建占位记录
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

    doc = db.query(Document).filter(Document.id == doc_id).first()
    if doc:
        doc.vector_status = "pending"

    db.commit()
    return {"doc_id": doc_id, "deleted": True}


# ═══════════════════════════════════════════════
# Phase 5: RAG 注入工具 — 供各对话模块复用
# ═══════════════════════════════════════════════

def search_rag_for_prompt(
    db: Session,
    user_id: str,
    query: str,
    module: str = "general",
    top_k: int = 3,
) -> tuple[str, list[dict[str, Any]]]:
    """为 Prompt 注入检索 RAG 知识片段。

    调用语义搜索，将匹配片段格式化为可注入 LLM prompt 的文本块。
    同时返回结构化来源信息供前端 SourceChip 渲染。

    Args:
        db: 数据库会话
        user_id: 用户 ID
        query: 用户原始提问
        module: 当前模块（用于优化检索策略）
        top_k: 检索结果数

    Returns:
        (prompt_injection_text, sources_list)
        - prompt_injection_text: 可直接注入 prompt 的格式化文本
        - sources_list: 来源列表 [{title, source, doc_id}]
    """
    # ─── L1 Redis 缓存查询 ───
    from ..rag import redis_cache as _rag_cache
    cached = _rag_cache.get_cached(user_id, module, query, top_k)
    if cached is not None:
        logger.debug("RAG L1 cache hit: user=%s module=%s query=%s", user_id, module, query[:30])
        return cached

    try:
        result = semantic_search(db, user_id, query, top_n=top_k)
        items = result.get("items", [])
        if not items:
            return "", []

        # 构建 Prompt 注入文本
        lines = ["\n\n【相关知识片段】（来自你的知识库）："]
        sources = []
        for item in items:
            title = item.get("title", "未命名文档")
            snippet = item.get("snippet", "")
            source_label = item.get("source", "private")
            source_name = "私有库" if source_label == "private" else "携君库"
            doc_id = item.get("doc_id", "")

            lines.append(
                f"- [📋 来源：{title}（{source_name}）] {snippet}"
            )
            sources.append({
                "title": title,
                "source": source_label,
                "source_name": source_name,
                "doc_id": doc_id,
                "snippet": snippet[:100] if snippet else "",
            })

        prompt_text = "\n".join(lines)
        # ─── 写入 L1 缓存（空结果不缓存） ───
        _rag_cache.set_cached(user_id, module, query, top_k, prompt_text, sources)
        return prompt_text, sources

    except Exception as e:
        logger.debug("RAG检索跳过（不阻塞主流程）: %s", e)
        return "", []

