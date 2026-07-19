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


# ═══════════════════════════════════════════════
# 携君智库接入 — 入库流水线请求/响应模型（2026-07-15）
# ═══════════════════════════════════════════════

class UploadResponse(BaseModel):
    """A1 zip上传响应。"""
    success: bool = True
    upload_id: str
    message: str = "文件已接收,开始解析"


class IngestionStatusResponse(BaseModel):
    """A1→A5 处理状态查询响应。"""
    upload_id: str
    package_id: str | None = None
    status: str  # uploaded / parsing / processing / completed / completed_with_warnings / failed
    total_files: int = 0
    processed_files: int = 0
    success_count: int = 0
    failed_count: int = 0
    pending_review_count: int = 0
    report_id: str | None = None
    error_message: str | None = None
    created_at: str = ""
    updated_at: str = ""


class IngestionReportResponse(BaseModel):
    """A5 入库报告响应。"""
    upload_id: str
    package_id: str | None = None
    process_time: str = ""
    status: str | None = None
    counts: dict | None = None
    failures: list[dict] = []
    pending_review: list[dict] = []


class IngestionTaskItem(BaseModel):
    """入库任务列表项。"""
    upload_id: str
    package_id: str | None = None
    filename: str | None = None
    file_size_bytes: int | None = None
    status: str
    total_files: int = 0
    success_count: int = 0
    failed_count: int = 0
    created_at: str = ""
    updated_at: str = ""
