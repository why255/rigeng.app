"""情绪评分域 — ORM 模型（匹配 0001_init_schema 的 emotion_score 表）。"""
from __future__ import annotations

from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from ..database import GUID, Base, TimestampMixin


class EmotionScore(TimestampMixin, Base):
    """每日情绪评分记录。"""

    __tablename__ = "emotion_score"

    user_id: Mapped[str] = mapped_column(GUID, index=True)
    score_date: Mapped[str | None] = mapped_column(String(16))
    score: Mapped[int | None] = mapped_column(Integer)
    source: Mapped[str | None] = mapped_column(String(32))
    user_reported_score: Mapped[int | None] = mapped_column(Integer)
    model_extracted_score: Mapped[int | None] = mapped_column(Integer)
    is_corrected: Mapped[bool] = mapped_column(Boolean, default=False)
    corrected_score: Mapped[int | None] = mapped_column(Integer)
