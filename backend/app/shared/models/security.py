"""安全域 — ORM 模型（匹配 0001_init_schema 的安全相关表）。"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from ..database import GUID, Base, PortableJSON, TimestampMixin


class CrisisLog(TimestampMixin, Base):
    """危机干预日志（user_id 已哈希脱敏，不可反推）。"""

    __tablename__ = "crisis_log"

    user_id_hashed: Mapped[str] = mapped_column(String(64))
    triggered_at: Mapped[datetime | None] = mapped_column(DateTime)
    crisis_type: Mapped[str | None] = mapped_column(String(32))
    intervention_result: Mapped[str | None] = mapped_column(String(64))


class LocalEncryptedStorage(TimestampMixin, Base):
    """端侧加密存储占位表（云端不存实体内容，仅存元数据）。"""

    __tablename__ = "local_encrypted_storage"

    user_id: Mapped[str] = mapped_column(GUID, index=True)
    note: Mapped[str | None] = mapped_column(String(255))


class CourageValue(TimestampMixin, Base):
    """勇气值追踪（情绪树洞·成长可见化）。"""

    __tablename__ = "courage_value"

    user_id: Mapped[str] = mapped_column(GUID, index=True)
    value: Mapped[int | None] = mapped_column(Integer, default=0)
    milestones: Mapped[dict | None] = mapped_column(PortableJSON())
    last_publish_at: Mapped[datetime | None] = mapped_column(DateTime)
    last_negotiation_fail_at: Mapped[datetime | None] = mapped_column(DateTime)
