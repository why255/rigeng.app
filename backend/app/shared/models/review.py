"""暮有复盘 · 复盘域 ORM（第二阶段·V1）。
"""
from __future__ import annotations

from sqlalchemy import ForeignKey, Integer, String, Float
from sqlalchemy.orm import Mapped, mapped_column

from ..database import GUID, Base, PortableJSON, TimestampMixin

# ── 枚举常量 ──
REVIEW_STATUSES = ("completed", "skipped")
REVIEW_STAGES = ("greeting", "inventory", "extraction", "improvement", "archive")


class ReviewRecord(TimestampMixin, Base):
    """每日复盘记录。每位用户每天最多一条复盘。"""

    __tablename__ = "review_record"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    plan_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("plan.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="completed")  # completed|skipped
    completion_rate: Mapped[float] = mapped_column(Float, default=0.0)
    sop_title: Mapped[str | None] = mapped_column(String(256))
    sop_steps_json: Mapped[dict | None] = mapped_column(PortableJSON())  # SOP 步骤列表
    sop_key_phrases: Mapped[str | None] = mapped_column(String(1024))
    sop_precautions: Mapped[str | None] = mapped_column(String(1024))
    sop_quality_score: Mapped[int | None] = mapped_column(Integer)
    courage_value: Mapped[int] = mapped_column(Integer, default=0)
    courage_message: Mapped[str | None] = mapped_column(String(512))
    emotion_score: Mapped[int | None] = mapped_column(Integer)  # -10 ~ +10
    diagnosis_json: Mapped[dict | None] = mapped_column(PortableJSON())  # 诊断问卷答案
    review_date: Mapped[str | None] = mapped_column(String(10))  # YYYY-MM-DD
    archived: Mapped[bool] = mapped_column(Integer, default=False)
    gentle_persistence_used: Mapped[bool] = mapped_column(Integer, default=False)  # 温柔坚持已使用
