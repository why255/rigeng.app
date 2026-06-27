"""向量索引域 — ORM 模型（匹配 0001_init_schema 的 vector_index 表）。"""
from __future__ import annotations

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from ..database import GUID, Base, PortableJSON, TimestampMixin


class VectorIndex(TimestampMixin, Base):
    """文档向量索引（一条记录 = 一个 chunk 的向量元数据）。

    embedding 列由 PostgreSQL pgvector 扩展提供，SQLite 兼容模式跳过向量操作。
    """

    __tablename__ = "vector_index"

    doc_id: Mapped[str] = mapped_column(GUID, index=True)
    chunk_id: Mapped[int] = mapped_column(Integer, default=0)
    meta: Mapped[dict | None] = mapped_column(PortableJSON())
