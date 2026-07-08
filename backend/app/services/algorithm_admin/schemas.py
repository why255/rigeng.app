"""算法管理服务 — 请求/响应模型。"""
from __future__ import annotations

from pydantic import BaseModel, Field


# ── 支持的模块定义 ──
ALGORITHM_MODULES: list[dict[str, str]] = [
    {"key": "morning_plan", "name": "朝有规划", "icon": "mingcute:sun-line"},
    {"key": "evening_review", "name": "暮有复盘", "icon": "mingcute:moon-line"},
    {"key": "emotion_treehole", "name": "情绪树洞", "icon": "mingcute:heart-line"},
    {"key": "smart_qa", "name": "智能问答", "icon": "mingcute:comment-line"},
    {"key": "smart_office", "name": "智能办公", "icon": "mingcute:briefcase-line"},
    {"key": "smart_job", "name": "智能求职", "icon": "mingcute:search-line"},
]


class AlgorithmFileItem(BaseModel):
    """算法文件列表项。"""
    id: str
    module_key: str
    original_filename: str
    file_size: int = 0
    content_preview: str = ""
    uploaded_by: str | None = None
    created_at: str = ""
    updated_at: str = ""


class AlgorithmModuleInfo(BaseModel):
    """模块信息。"""
    key: str
    name: str
    icon: str = ""
    file_count: int = 0


class AlgorithmUploadResponse(BaseModel):
    """上传响应。"""
    id: str
    module_key: str
    original_filename: str
    file_size: int = 0
    created_at: str = ""
