"""情绪树洞域 — ORM 模型。

复用现有 conversation + message + emotion_score + courage_value 表，
新增 growth_record 表用于成长手册。
"""
from __future__ import annotations

from sqlalchemy import Boolean, Integer, String, Text, Float
from sqlalchemy.orm import Mapped, mapped_column

from ..database import GUID, Base, TimestampMixin, PortableJSON


class GrowthRecord(TimestampMixin, Base):
    """成长手册记录 — 情绪树洞倾诉后AI萃取生成。

    每次结束倾诉时生成一条，包含萃取内容、分类标签。
    """

    __tablename__ = "growth_record"

    user_id: Mapped[str] = mapped_column(GUID, index=True)
    session_date: Mapped[str | None] = mapped_column(String(16), index=True)
    category: Mapped[str | None] = mapped_column(
        String(32), default="情绪调节"
    )  # 自我成长 / 情绪调节 / 认知转化
    category_color: Mapped[str | None] = mapped_column(String(16))
    content: Mapped[str | None] = mapped_column(Text)
    tags: Mapped[dict | None] = mapped_column(PortableJSON())
    emotion_score: Mapped[int | None] = mapped_column(Integer)
    courage_value: Mapped[int | None] = mapped_column(Integer)
    duration_minutes: Mapped[int | None] = mapped_column(Integer)
    conv_id: Mapped[str | None] = mapped_column(GUID, index=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
