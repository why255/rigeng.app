"""②公私知识库服务 请求/响应模型。"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class SaveDocIn(BaseModel):
    """K1 归档 saveToKnowledgeBase。"""
    doc_type: str
    source_module: str | None = None  # M1..M13
    hr_category: str | None = None
    title: str | None = None
    content: dict[str, Any] | None = None
    file_object_id: str | None = None
    library_type: str = "private"
    is_emotion_agitated: bool = False  # 情绪激动→拒绝上云(40041)
    is_negative: bool = False          # 负面/隐私内容标记
    is_desensitized: bool = False


class EditDocIn(BaseModel):
    content: dict[str, Any] | None = None
    hr_category: str | None = None
    folder_id: str | None = None
    title: str | None = None


class ApproveIn(BaseModel):
    doc_ids: list[str] | None = None  # 批量；为空则用路径单条
    version_naming: str | None = None  # 校验禁止"基础版/标准版/高级版"


class RejectIn(BaseModel):
    """驳回文档。"""
    reason: str | None = None


class UpdateSettingsIn(BaseModel):
    """更新知识库用户设置。"""
    auto_archive: bool | None = None
    watermark_enabled: bool | None = None
    storage_alert_threshold: int | None = Field(default=None, ge=50, le=95)


class FolderIn(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    parent_id: str | None = None
    hr_category: str | None = None
