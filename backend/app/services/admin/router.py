"""管理后台 — 路由层。
全部接口仅 superadmin 可访问。
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ...shared.database import get_db
from ...shared.response import ok, page
from ...shared.security import CurrentUser, require_role
from . import service
from .schemas import (
    AssignStudentRequest,
    ChangeRoleRequest,
)

router = APIRouter(tags=["管理后台"], prefix="/admin")

_admin = require_role("superadmin")


# ═══════════════════════════════════════════════
# 用户管理
# ═══════════════════════════════════════════════

@router.get("/users")
def list_users(
    role: str | None = Query(None, description="按角色筛选: student/teacher/superadmin"),
    phone: str | None = Query(None, description="按手机号模糊搜索"),
    status: str | None = Query(None, description="按状态筛选: active/inactive"),
    page_no: int = Query(1, alias="page", ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _op: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """用户列表（分页+筛选）。"""
    return ok(service.list_users(db, role=role, phone=phone, status=status,
                                 page=page_no, page_size=page_size))


@router.get("/users/{user_id}")
def get_user_detail(
    user_id: str,
    _op: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """用户详情（含 VIP、老师档案、分配关系）。"""
    return ok(service.get_user_detail(db, user_id))


@router.patch("/users/{user_id}/role")
def change_role(
    user_id: str,
    body: ChangeRoleRequest,
    operator: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """变更用户角色（自动创建/清理 TeacherProfile）。"""
    return ok(service.change_role(db, operator.user_id, user_id, body.role))


# ═══════════════════════════════════════════════
# 老师管理
# ═══════════════════════════════════════════════

@router.post("/teachers/grant")
def grant_teacher(
    body: dict,
    operator: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """授予老师角色 → 改 role + 创建 TeacherProfile。"""
    return ok(service.grant_teacher(
        db, operator.user_id, body.get("user_id", ""),
        bio=body.get("bio", ""),
        expertise_tags=body.get("expertise_tags", []),
    ))


@router.post("/teachers/revoke")
def revoke_teacher(
    body: dict,
    operator: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """撤销老师角色 → 清理档案 + 解绑学员。"""
    return ok(service.revoke_teacher(db, operator.user_id, body.get("user_id", "")))


@router.get("/teachers")
def list_teachers(
    page_no: int = Query(1, alias="page", ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _op: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """老师列表（含档案、学员数）。"""
    return ok(service.list_teachers(db, page=page_no, page_size=page_size))


@router.get("/teachers/{teacher_id}/students")
def get_teacher_students(
    teacher_id: str,
    page_no: int = Query(1, alias="page", ge=1),
    page_size: int = Query(50, ge=1, le=200),
    _op: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """某老师名下的学员列表。"""
    return ok(service.get_teacher_students(db, teacher_id, page=page_no, page_size=page_size))


# ═══════════════════════════════════════════════
# 学员分配
# ═══════════════════════════════════════════════

@router.post("/teacher-assignments")
def assign_student(
    body: AssignStudentRequest,
    operator: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """分配学员给老师。"""
    return ok(service.assign_student(
        db, operator.user_id, body.teacher_id, body.student_id,
    ))


@router.delete("/teacher-assignments/{assignment_id}")
def unassign_student(
    assignment_id: str,
    operator: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """解除学员-老师分配。"""
    return ok(service.unassign_student(db, operator.user_id, assignment_id))


# ═══════════════════════════════════════════════
# 审计日志
# ═══════════════════════════════════════════════

@router.get("/audit-logs")
def get_audit_logs(
    target_user_id: str | None = Query(None),
    action: str | None = Query(None),
    page_no: int = Query(1, alias="page", ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _op: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """审计日志列表。"""
    return ok(service.get_audit_logs(
        db, target_user_id=target_user_id, action=action,
        page=page_no, page_size=page_size,
    ))
