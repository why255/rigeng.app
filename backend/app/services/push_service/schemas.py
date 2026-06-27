"""⑥消息/推送服务 请求/响应模型。"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ═══════ App推送 ═══════
class PushRequest(BaseModel):
    """发送App推送通知。"""
    user_id: str
    title: str = Field(..., min_length=1, max_length=64)
    body: str = Field(..., min_length=1, max_length=256)
    target_type: str = Field(default="ACCOUNT")  # ACCOUNT / DEVICE / ALIAS / TAG / ALL
    target_value: str | None = None  # 设备ID/别名等
    extras: dict[str, str] | None = None  # 透传参数：如跳转页面、模块名


class PushBatchRequest(BaseModel):
    """批量推送。"""
    user_ids: list[str] = Field(..., min_length=1, max_length=1000)
    title: str
    body: str
    extras: dict[str, str] | None = None


# ═══════ 短信 ═══════
class SMSRequest(BaseModel):
    """发送短信。"""
    phone: str = Field(..., min_length=11, max_length=11)
    template_code: str  # 短信模板ID
    template_params: dict[str, str] | None = None  # 模板变量 {code, name, ...}


# ═══════ 提醒触发（内部调用）═══
class ReminderTrigger(BaseModel):
    """触发提醒检查（由定时任务调用）。"""
    trigger_type: str = Field(...)  # "inactive_check" / "crisis_followup" / "morning_reminder"
    target_date: str | None = None  # YYYY-MM-DD


# ═══════ 推送记录 ↔ API响应 ═══
class PushLogEntry(BaseModel):
    id: str
    user_id: str
    channel: str  # "push" / "sms"
    title: str | None
    body: str
    status: str  # "sent" / "failed" / "rate_limited"
    created_at: str


class PushQuota(BaseModel):
    """推送配额查询响应。"""
    user_id: str
    push_sent_this_week: int
    push_max_per_week: int
    sms_enabled: bool
    can_push_now: bool
    block_reason: str | None = None
