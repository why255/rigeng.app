"""朝有规划 · 计划域 ORM（第二阶段·V1）。
"""
from __future__ import annotations

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from ..database import GUID, Base, PortableJSON, TimestampMixin

# ── 枚举常量 ──
PLAN_STATUSES = ("draft", "active", "completed", "archived")
QUADRANTS = (
    "urgent_important",        # 重要且紧急
    "not_urgent_important",    # 重要不紧急
    "urgent_not_important",    # 紧急不重要
    "not_urgent_not_important", # 不重要不紧急
)
TASK_SOURCES = ("user_input", "yesterday_unfinished", "smart_record_sync")
TASK_STATUSES = ("pending", "completed")


class Plan(TimestampMixin, Base):
    """每日计划主表。每位用户每天最多一个活跃计划。"""

    __tablename__ = "plan"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    title: Mapped[str] = mapped_column(String(256), default="今日计划")
    status: Mapped[str] = mapped_column(String(16), default="draft")  # draft|active|completed|archived
    stats_json: Mapped[dict | None] = mapped_column(PortableJSON())  # {total, completed, rate}


class PlanTask(TimestampMixin, Base):
    """计划中的单条任务。支持四象限拖拽调整。"""

    __tablename__ = "plan_task"

    plan_id: Mapped[str] = mapped_column(GUID, ForeignKey("plan.id"), index=True)
    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    title: Mapped[str] = mapped_column(String(512))
    description: Mapped[str | None] = mapped_column(String(2048))
    quadrant: Mapped[str] = mapped_column(String(32), default="not_urgent_important")
    source: Mapped[str] = mapped_column(String(32), default="user_input")
    status: Mapped[str] = mapped_column(String(16), default="pending")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    time_estimate: Mapped[str | None] = mapped_column(String(64))  # 如 "9:00-10:30"
