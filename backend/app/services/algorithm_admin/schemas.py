"""算法管理服务 — 请求/响应模型。"""
from __future__ import annotations

from pydantic import BaseModel, Field

from ...engines.module_registry import MODULE_REGISTRY


# ── 支持的模块定义（从统一注册表动态构建）──
ALGORITHM_MODULES: list[dict[str, str]] = [
    {
        "key": k,
        "name": v["name"],
        "icon": v["icon"],
        "color": v.get("color", ""),
    }
    for k, v in MODULE_REGISTRY.items()
]


# ═══════════════════════════════════════════════
# 算法文件
# ═══════════════════════════════════════════════

class AlgorithmFileItem(BaseModel):
    """算法文件列表项（含内容预览）。"""
    id: str
    module_key: str
    original_filename: str
    file_size: int = 0
    content_preview: str = ""
    uploaded_by: str | None = None
    created_at: str = ""
    updated_at: str = ""


class AlgorithmFileUpdateRequest(BaseModel):
    """编辑算法文件请求。"""
    original_filename: str | None = Field(None, description="新的文件名")
    content: str | None = Field(None, description="新的文件内容")


class AlgorithmFileDetailResponse(BaseModel):
    """算法文件完整内容（供预览/编辑）。"""
    id: str
    module_key: str
    original_filename: str
    content: str
    file_size: int = 0
    uploaded_by: str | None = None
    created_at: str = ""
    updated_at: str = ""


class AlgorithmUploadResponse(BaseModel):
    """上传响应。"""
    id: str
    module_key: str
    original_filename: str
    file_size: int = 0
    created_at: str = ""


# ═══════════════════════════════════════════════
# AI 配置中心
# ═══════════════════════════════════════════════

class AIModuleSummary(BaseModel):
    """模块摘要（用于卡片网格）。"""
    key: str
    name: str
    icon: str = ""
    color: str = ""
    file_count: int = 0
    current_model: str | None = None
    current_provider: str | None = None
    current_model_version: str | None = None
    model_display_name: str | None = None
    has_active_binding: bool = False


class AIModuleFullInfo(BaseModel):
    """单模块完整信息（用于详情面板）。"""
    key: str
    name: str
    icon: str = ""
    color: str = ""
    description: str = ""
    ai_capabilities: list[str] = []
    # 算法文件
    file_count: int = 0
    files: list[AlgorithmFileItem] = []
    # 模型绑定
    current_model: str | None = None
    current_provider: str | None = None
    current_model_version: str | None = None
    model_display_name: str | None = None
    has_active_binding: bool = False
    binding_id: str | None = None
    # 默认配置（来自注册表）
    default_model: str = ""
    default_provider: str = ""
    temperature: float = 0.5
    fallback_chain: list[str] = []
    template_fallback: str | None = None
