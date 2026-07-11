"""分析域 — ORM 模型（匹配 0001_init_schema 的分析相关表）。"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import GUID, Base, PortableJSON, TimestampMixin


class EventLog(TimestampMixin, Base):
    """用户行为事件埋点日志。"""

    __tablename__ = "event_log"

    user_id: Mapped[str] = mapped_column(GUID, index=True)
    module: Mapped[str | None] = mapped_column(String(8))
    event_type: Mapped[str | None] = mapped_column(String(64))
    properties: Mapped[dict | None] = mapped_column(PortableJSON())
    ts: Mapped[datetime | None] = mapped_column(DateTime)


class MetricDaily(TimestampMixin, Base):
    """每日预计算指标（定时任务产出）。"""

    __tablename__ = "metric_daily"

    user_id: Mapped[str] = mapped_column(GUID, index=True)
    mdate: Mapped[str | None] = mapped_column(String(16))
    metric_type: Mapped[str | None] = mapped_column(String(64))
    value: Mapped[float | None] = mapped_column(Numeric(5, 2))


class CarePushLog(TimestampMixin, Base):
    """关怀推送日志。"""

    __tablename__ = "care_push_log"

    user_id: Mapped[str] = mapped_column(GUID, index=True)
    type: Mapped[str | None] = mapped_column(String(16))
    trigger_condition: Mapped[str | None] = mapped_column(String(64))
    pushed_at: Mapped[datetime | None] = mapped_column(DateTime)
    intercepted_reason: Mapped[str | None] = mapped_column(String(64))


class SmsSendLog(TimestampMixin, Base):
    """短信发送日志（含验证码审计）。"""

    __tablename__ = "sms_send_log"

    user_id: Mapped[str | None] = mapped_column(GUID, index=True, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    purpose: Mapped[str | None] = mapped_column(String(32), nullable=True)  # register / login
    trigger_condition: Mapped[str | None] = mapped_column(String(64))
    module: Mapped[str | None] = mapped_column(String(8))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class AuditLog(TimestampMixin, Base):
    """全链路审计日志（不可删除，保留90天）。

    每个模块的 execute() 调用记录:
    - 输入内容(脱敏后)
    - 输出内容
    - SOP步骤执行状态
    - 自检结果
    - 耗时
    - 使用的模型和Token数
    """

    __tablename__ = "audit_log"

    user_id: Mapped[str] = mapped_column(GUID, index=True)
    module: Mapped[str | None] = mapped_column(String(32))
    action: Mapped[str | None] = mapped_column(String(64))
    detail: Mapped[dict | None] = mapped_column(PortableJSON())
    # detail 结构:
    # {
    #   "input_preview": str,      # 脱敏后输入(截断500字)
    #   "output_preview": str,     # 输出(截断1000字)
    #   "model_used": str,
    #   "tokens": int,
    #   "duration_ms": int,
    #   "sop_step": str,           # SOP步骤
    #   "self_check_passed": bool, # 自检结果
    # }


class PushRuleTemplate(TimestampMixin, Base):
    """推送规则模板。"""

    __tablename__ = "push_rule_template"

    trigger_condition: Mapped[str | None] = mapped_column(String(64))
    module: Mapped[str | None] = mapped_column(String(8))
    push_type: Mapped[str | None] = mapped_column(String(16))
    priority: Mapped[int | None] = mapped_column(Integer)
    max_per_week: Mapped[int | None] = mapped_column(Integer)
    push_window_start: Mapped[int | None] = mapped_column(Integer)
    push_window_end: Mapped[int | None] = mapped_column(Integer)
    new_user_quiet_days: Mapped[int] = mapped_column(Integer, default=7)
    template_text: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
