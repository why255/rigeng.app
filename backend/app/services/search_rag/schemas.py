"""⑤搜索/RAG服务 — 请求/响应模型。"""
from __future__ import annotations

from pydantic import BaseModel, Field


class SearchQuery(BaseModel):
    """语义/关键词搜索请求。"""
    query: str = Field(min_length=1, max_length=500)
    sources: list[str] | None = None  # ["private", "public"]，默认全部
    top_n: int = 10
    threshold: float | None = None  # 默认使用 RAG_SIMILARITY_THRESHOLD


class SearchResult(BaseModel):
    """搜索结果项。"""
    doc_id: str
    title: str | None = None
    snippet: str | None = None  # 匹配的文本片段
    score: float | None = None  # 相关度评分（语义搜索用）
    source: str = "private"
    doc_type: str | None = None
    hr_category: str | None = None


class SearchResponse(BaseModel):
    """搜索响应。"""
    items: list[SearchResult]
    total: int
    query_time_ms: int | None = None
    engine_used: str = "keyword"  # keyword / semantic / hybrid


class IndexRequest(BaseModel):
    """文档向量化请求。"""
    doc_id: str
    content_json: dict | None = None  # 文档内容 JSON，用于提取文本


class SearchHealthResponse(BaseModel):
    """搜索服务健康状态。"""
    embedding_model: str = "bge-large-zh"
    embedding_dim: int = 1024
    vector_index_method: str = "ivfflat"
    total_indexed: int = 0
    is_available: bool = True
    note: str = "MVP模式：使用SQL LIKE关键词搜索，向量语义搜索待embedding模型集成"
