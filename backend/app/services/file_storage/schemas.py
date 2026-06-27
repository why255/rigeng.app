"""④文件存储服务 — 请求/响应模型。"""
from __future__ import annotations

from pydantic import BaseModel, Field


class FileOut(BaseModel):
    """文件信息响应。"""
    file_id: str
    storage_url: str | None = None
    file_type: str
    size_bytes: int | None = None
    duration_sec: int | None = None
    compress_status: str = "raw"
    storage_layer: str = "cloud"
    checksum: str | None = None
    created_at: str | None = None


class UploadResponse(BaseModel):
    """上传成功响应。"""
    file_id: str
    storage_url: str
    size_bytes: int


class QuotaResponse(BaseModel):
    """存储配额响应。"""
    used_mb: int
    quota_mb: int | None = None  # NULL = 不限
    remaining_mb: int | None = None  # NULL = 不限
    is_full: bool = False


class CompressRequest(BaseModel):
    """压缩请求（预留）。"""
    file_id: str
    target_bitrate: str | None = None  # 默认使用 AUDIO_COMPRESS_BITRATE 配置
