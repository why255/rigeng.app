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
