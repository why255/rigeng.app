"""管理后台 — Pydantic 请求/响应模型。"""
from __future__ import annotations

from pydantic import BaseModel, Field


# ── 用户 ──

class UserListItem(BaseModel):
    """用户列表项。"""
    user_id: str
    phone: str
    nickname: str | None = None
    role: str = "student"
    vip_level: str = "trial"
    status: str = "active"
    trial_expire_at: str | None = None
    created_at: str = ""


class UserDetailResponse(BaseModel):
    """用户详情。"""
    user_id: str
    phone: str
    nickname: str | None = None
    gender: str | None = None
    role: str = "student"
    status: str = "active"
    vip: dict | None = None
    trial: dict | None = None
    teacher_profile: dict | None = None
    assigned_teacher: dict | None = None
    student_count: int = 0
    created_at: str = ""


class ChangeRoleRequest(BaseModel):
    """变更角色请求。"""
    role: str = Field(..., description="目标角色: student / teacher / superadmin")


class GrantTeacherRequest(BaseModel):
    """授予老师请求。"""
    user_id: str = Field(..., description="被授权用户的ID")
    bio: str = ""
    expertise_tags: list[str] = []


class RevokeTeacherRequest(BaseModel):
    """撤销老师请求。"""
    user_id: str = Field(..., description="被撤销老师的用户ID")


# ── 老师 ──

class TeacherListItem(BaseModel):
    """老师列表项。"""
    user_id: str
    phone: str
    nickname: str | None = None
    bio: str | None = None
    expertise_tags: list[str] = []
    service_status: str = "可接单"
    rating: float | None = None
    student_count: int = 0
    created_at: str = ""


class TeacherStudentItem(BaseModel):
    """老师名下的学员。"""
    user_id: str
    phone: str
    nickname: str | None = None
    vip_level: str = "trial"
    assigned_at: str = ""
    nda_signed: bool = False


# ── 分配 ──

class AssignStudentRequest(BaseModel):
    """分配学员给老师。"""
    teacher_id: str = Field(..., description="老师用户ID")
    student_id: str = Field(..., description="学员用户ID")


# ── 审计 ──

class AdminAuditLogItem(BaseModel):
    """审计日志项。"""
    id: str
    operator_id: str
    action: str
    target_user_id: str | None = None
    detail: dict | None = None
    created_at: str = ""


# ═══════════════════════════════════════════════
# 模型降级
# ═══════════════════════════════════════════════

class ModelConfigCreate(BaseModel):
    """新增模型版本。"""
    provider_key: str = Field(..., description="提供商: volcano|dashscope|hunyuan|kimi|deepseek|zhipu|anthropic")
    model_name: str = Field(..., description="API模型标识符")
    model_version: str = Field(..., description="版本号")
    display_name: str | None = None
    is_available: bool = True


class ModelConfigUpdate(BaseModel):
    """更新模型版本（所有字段可选）。"""
    provider_key: str | None = None
    model_name: str | None = None
    model_version: str | None = None
    display_name: str | None = None
    is_available: bool | None = None


class ModuleModelBindingCreate(BaseModel):
    """新增模块→模型绑定。"""
    module_key: str = Field(..., description="模块标识")
    module_display_name: str | None = None
    model_config_id: str = Field(..., description="绑定的模型版本ID")
    is_active: bool = True


class ModuleModelBindingUpdate(BaseModel):
    """更新绑定（降级时使用）。"""
    model_config_id: str | None = None
    is_active: bool | None = None
    module_display_name: str | None = None


class ModelDegradeRequest(BaseModel):
    """一键降级：将模块切换到新的模型版本。"""
    module_key: str = Field(..., description="模块标识")
    new_model_config_id: str = Field(..., description="目标模型版本的ID")


# ═══════════════════════════════════════════════
# 携君库文档管理
# ═══════════════════════════════════════════════

class XiejunDocumentUpdate(BaseModel):
    """更新携君库文档。"""
    title: str | None = None
    hr_category: str | None = None
    status: str | None = None  # published / draft / archived
    author: str | None = None
