"""聊天消息服务 — 请求/响应模型。"""
from __future__ import annotations

from pydantic import BaseModel, Field


# ═══════ 消息同步 ═══════

class ChatMessageItem(BaseModel):
    """单条消息（从前端同步到后端）。"""
    role: str = Field(..., pattern="^(user|assistant)$")
    text: str = Field(..., min_length=0, max_length=50000)
    type: str = Field(default="text", pattern="^(text|voice)$")


class ChatSyncRequest(BaseModel):
    """上传今日消息（全量覆盖）。"""
    module: str = Field(..., pattern="^(mp|er|mh|sq|so|cm)$")
    messages: list[ChatMessageItem] = Field(default_factory=list)


class ChatSyncResponse(BaseModel):
    """消息同步结果。"""
    saved: int
    chat_date: str


# ═══════ 消息拉取 ═══════

class ChatMessageResponse(BaseModel):
    """单条消息响应（从后端到前端）。"""
    id: str
    role: str
    text: str
    type: str = "text"
    seq: int = 0
    created_at: str = ""


class ChatLoadResponse(BaseModel):
    """按日期拉取消息的响应。"""
    module: str
    chat_date: str
    messages: list[ChatMessageResponse] = []


# ═══════ 日期列表 ═══════

class ChatDatesResponse(BaseModel):
    """有消息的日期列表。"""
    module: str
    dates: list[str] = []


# ═══════ 模块元数据 ═══════

class ChatMetaGetResponse(BaseModel):
    """获取模块元数据。"""
    module: str
    chat_date: str
    meta: dict = {}


class ChatMetaSaveRequest(BaseModel):
    """保存模块元数据。"""
    meta: dict = Field(default_factory=dict)


class ChatMetaSaveResponse(BaseModel):
    """保存元数据结果。"""
    saved: bool


# ═══════ 迁移 ═══════

class ChatMigrateItem(BaseModel):
    """迁移用消息条目。"""
    chat_date: str
    messages: list[ChatMessageItem]


class ChatMigrateRequest(BaseModel):
    """一次性迁移：上传 localStorage 全部历史消息。"""
    module: str = Field(..., pattern="^(mp|er|mh|sq|so|cm)$")
    data: list[ChatMigrateItem] = Field(default_factory=list)


class ChatMigrateResponse(BaseModel):
    """迁移结果。"""
    migrated_days: int
    migrated_messages: int
