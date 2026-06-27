"""数据库连接与可移植 ORM 基础设施。

- 生产：PostgreSQL（+pgvector）；本地/测试：SQLite。
- 提供可移植类型 GUID / PortableJSON，使同一套 ORM 同时跑 PG 与 SQLite。
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import CHAR, DateTime, Integer, TypeDecorator, create_engine
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from sqlalchemy.types import JSON

from .config import settings

# ── 引擎 ──
_connect_args = {"check_same_thread": False} if settings.is_sqlite else {}
engine = create_engine(settings.DATABASE_URL, connect_args=_connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


# ── 可移植类型 ──
class GUID(TypeDecorator):
    """PG 用原生 UUID，SQLite 退化为 CHAR(36)。"""

    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(UUID(as_uuid=False))
        return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        return str(value)

    def process_result_value(self, value, dialect):
        return value


def PortableJSON():
    """PG 用 JSONB，其它方言用通用 JSON。"""
    return JSON().with_variant(JSONB(), "postgresql")


def new_uuid() -> str:
    return uuid.uuid4().hex


def utcnow() -> datetime:
    """返回 UTC 当前时间（naive datetime，与 ORM DateTime 列兼容）。"""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    """所有表通用：主键、创建/更新时间、schema 版本、软删除。"""

    id: Mapped[str] = mapped_column(GUID, primary_key=True, default=new_uuid)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
    schema_version: Mapped[int] = mapped_column(Integer, default=1)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


# ── FastAPI 依赖：每请求一个 Session ──
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
