"""⑤搜索/RAG服务 — 路由层。"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ...shared.database import get_db
from ...shared.response import ok
from ...shared.security import CurrentUser, get_current_user
from . import service

router = APIRouter(prefix="/search", tags=["⑤搜索/RAG"])


@router.get("/keyword")
def keyword_search(
    q: str = Query(..., min_length=1, max_length=500, description="搜索关键词"),
    sources: str | None = Query(None, description="知识来源，逗号分隔: private,public"),
    top_n: int = Query(10, ge=1, le=100),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """关键词搜索：SQL ILIKE 匹配文档标题和内容。"""
    source_list = [s.strip() for s in sources.split(",")] if sources else None
    return ok(service.keyword_search(db, user.user_id, q, source_list, top_n))


@router.get("/semantic")
def semantic_search(
    q: str = Query(..., min_length=1, max_length=500),
    sources: str | None = Query(None),
    top_n: int = Query(10, ge=1, le=100),
    threshold: float | None = Query(None, ge=0.0, le=1.0),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """语义搜索（MVP降级到关键词搜索）。"""
    source_list = [s.strip() for s in sources.split(",")] if sources else None
    return ok(service.semantic_search(db, user.user_id, q, source_list, top_n, threshold))


@router.post("/index/{doc_id}")
def index_doc(
    doc_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """对文档执行向量索引（MVP stub）。"""
    return ok(service.index_document(db, doc_id))


@router.get("/health")
def search_health(
    db: Session = Depends(get_db),
):
    """搜索服务健康状态（无需认证）。"""
    return ok(service.get_search_health(db))


@router.get("/layered")
def layered_search(
    q: str = Query(..., min_length=1, max_length=500, description="搜索查询文本"),
    sources: str = Query("private,public,internet", description="启用的知识来源，逗号分隔"),
    top_n: int = Query(5, ge=1, le=50),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """A6 三层检索编排：L1(私有库) → L2(携君库) → L3(互联网)。

    按合同约定：先检索L1/L2，计算相关度均值，若低于阈值则触发L3。
    """
    source_list = [s.strip() for s in sources.split(",") if s.strip()]
    return ok(service.search_layered(db, user.user_id, q, source_list, top_n))
