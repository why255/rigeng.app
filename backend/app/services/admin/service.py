"""管理后台 — 业务逻辑层。

实现：用户列表/详情/角色变更、老师授/撤权、学员分配、审计日志。
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from ...shared import errors
from ...shared.database import new_uuid, utcnow
from ...shared.models.user import (
    ROLES, TeacherAssignment, TeacherProfile, User, VipMembership,
)


# ── 审计日志表（DDL 由 migration 0007 创建）──

class AdminAuditLog:
    """管理操作审计日志 — 纯 SQL 表，无 ORM 映射。"""
    pass


# ── 用户管理 ──

def list_users(
    db: Session,
    role: str | None = None,
    phone: str | None = None,
    status: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """分页查询用户列表，联表查询 VIP 信息。"""
    base = db.query(
        User.id.label("user_id"),
        User.phone,
        User.nickname,
        User.role,
        User.status,
        User.created_at,
        VipMembership.level.label("vip_level"),
        VipMembership.expire_at.label("trial_expire_at"),
    ).outerjoin(
        VipMembership, VipMembership.user_id == User.id,
    )

    if role:
        base = base.filter(User.role == role)
    if phone:
        base = base.filter(User.phone.ilike(f"%{phone}%"))
    if status:
        base = base.filter(User.status == status)

    total = base.count()
    rows = base.order_by(User.created_at.desc()).offset(
        (page - 1) * page_size,
    ).limit(page_size).all()

    items = []
    for r in rows:
        items.append({
            "user_id": r.user_id,
            "phone": r.phone,
            "nickname": r.nickname,
            "role": r.role,
            "vip_level": r.vip_level or "trial",
            "status": r.status or "active",
            "trial_expire_at": r.trial_expire_at.isoformat() if r.trial_expire_at else None,
            "created_at": r.created_at.isoformat() if r.created_at else "",
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


def get_user_detail(db: Session, user_id: str) -> dict:
    """获取用户完整详情。"""
    user = db.get(User, user_id)
    if not user:
        raise errors.E_USER_NOT_FOUND

    vip = db.execute(
        select(VipMembership).where(VipMembership.user_id == user_id),
    ).scalar_one_or_none()

    teacher_profile = db.execute(
        select(TeacherProfile).where(TeacherProfile.teacher_id == user_id),
    ).scalar_one_or_none()

    # 查分配的老师
    assignment = db.execute(
        select(TeacherAssignment).where(
            TeacherAssignment.student_id == user_id,
            TeacherAssignment.status == "active",
        ),
    ).scalar_one_or_none()

    assigned_teacher = None
    if assignment:
        t = db.get(User, assignment.teacher_id)
        if t:
            assigned_teacher = {
                "teacher_id": t.id,
                "phone": t.phone,
                "nickname": t.nickname,
                "nda_signed": assignment.nda_signed,
                "assigned_at": assignment.created_at.isoformat() if assignment.created_at else "",
            }

    # 如果是老师，查名下学员数
    student_count = 0
    if user.role == "teacher":
        student_count = db.execute(
            select(func.count()).select_from(TeacherAssignment).where(
                TeacherAssignment.teacher_id == user_id,
                TeacherAssignment.status == "active",
            ),
        ).scalar() or 0

    return {
        "user_id": user.id,
        "phone": user.phone,
        "nickname": user.nickname,
        "gender": user.gender,
        "role": user.role,
        "status": user.status,
        "vip": _vip(vip),
        "trial": _trial(vip),
        "teacher_profile": _teacher_profile_dict(teacher_profile),
        "assigned_teacher": assigned_teacher,
        "student_count": student_count,
        "created_at": user.created_at.isoformat() if user.created_at else "",
    }


def change_role(db: Session, operator_id: str, user_id: str, new_role: str) -> dict:
    """变更用户角色，写审计日志。"""
    if new_role not in ROLES:
        raise errors.APIError(errors.E_PARAM_FORMAT.code, f"非法角色: {new_role}", 400)

    user = db.get(User, user_id)
    if not user:
        raise errors.E_USER_NOT_FOUND

    old_role = user.role
    if old_role == new_role:
        return {"user_id": user_id, "role": new_role, "changed": False}

    user.role = new_role
    _write_audit(db, operator_id, "change_role", user_id, {
        "before_role": old_role, "after_role": new_role,
    })

    # role 切换为 teacher → 创建 TeacherProfile
    if new_role == "teacher":
        existing = db.execute(
            select(TeacherProfile).where(TeacherProfile.teacher_id == user_id),
        ).scalar_one_or_none()
        if not existing:
            db.add(TeacherProfile(teacher_id=user_id, service_status="可接单"))

    # role 从 teacher 切走 → 软删除 TeacherProfile + 清理学员分配
    if old_role == "teacher" and new_role != "teacher":
        tp = db.execute(
            select(TeacherProfile).where(TeacherProfile.teacher_id == user_id),
        ).scalar_one_or_none()
        if tp:
            tp.service_status = "已停用"
        db.execute(
            text(
                "UPDATE teacher_assignment SET status='inactive' "
                "WHERE teacher_id=:tid AND status='active'",
            ).bindparams(tid=user_id),
        )

    db.commit()
    return {"user_id": user_id, "role": new_role, "changed": True, "before_role": old_role}


def grant_teacher(db: Session, operator_id: str, user_id: str, bio: str = "",
                  expertise_tags: list | None = None) -> dict:
    """授予老师角色。"""
    return change_role(db, operator_id, user_id, "teacher")


def revoke_teacher(db: Session, operator_id: str, user_id: str) -> dict:
    """撤销老师角色，返回学员身份。"""
    return change_role(db, operator_id, user_id, "student")


# ── 老师管理 ──

def list_teachers(db: Session, page: int = 1, page_size: int = 20) -> dict:
    """老师列表，含档案和学员数。"""
    base = db.query(
        User.id.label("user_id"),
        User.phone,
        User.nickname,
        User.created_at,
        TeacherProfile.bio,
        TeacherProfile.expertise_tags,
        TeacherProfile.service_status,
        TeacherProfile.rating,
    ).join(
        TeacherProfile, TeacherProfile.teacher_id == User.id,
    ).filter(
        User.role == "teacher",
    )

    total = base.count()
    rows = base.order_by(User.created_at.desc()).offset(
        (page - 1) * page_size,
    ).limit(page_size).all()

    items = []
    for r in rows:
        count = db.execute(
            select(func.count()).select_from(TeacherAssignment).where(
                TeacherAssignment.teacher_id == r.user_id,
                TeacherAssignment.status == "active",
            ),
        ).scalar() or 0
        items.append({
            "user_id": r.user_id,
            "phone": r.phone,
            "nickname": r.nickname,
            "bio": r.bio,
            "expertise_tags": r.expertise_tags or [],
            "service_status": r.service_status or "可接单",
            "rating": float(r.rating) if r.rating else None,
            "student_count": count,
            "created_at": r.created_at.isoformat() if r.created_at else "",
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


def get_teacher_students(db: Session, teacher_id: str,
                         page: int = 1, page_size: int = 50) -> dict:
    """某老师名下的学员列表。"""
    base = db.query(
        User.id.label("user_id"),
        User.phone,
        User.nickname,
        VipMembership.level.label("vip_level"),
        TeacherAssignment.created_at.label("assigned_at"),
        TeacherAssignment.nda_signed,
    ).join(
        TeacherAssignment, TeacherAssignment.student_id == User.id,
    ).outerjoin(
        VipMembership, VipMembership.user_id == User.id,
    ).filter(
        TeacherAssignment.teacher_id == teacher_id,
        TeacherAssignment.status == "active",
    )

    total = base.count()
    rows = base.order_by(TeacherAssignment.created_at.desc()).offset(
        (page - 1) * page_size,
    ).limit(page_size).all()

    items = []
    for r in rows:
        items.append({
            "user_id": r.user_id,
            "phone": r.phone,
            "nickname": r.nickname,
            "vip_level": r.vip_level or "trial",
            "assigned_at": r.assigned_at.isoformat() if r.assigned_at else "",
            "nda_signed": r.nda_signed or False,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


# ── 学员分配 ──

def assign_student(db: Session, operator_id: str, teacher_id: str,
                   student_id: str) -> dict:
    """分配学员给老师（运营后台操作）。"""
    if not db.get(User, teacher_id) or not db.get(User, student_id):
        raise errors.E_USER_NOT_FOUND

    # 检查是否已有活跃分配
    existing = db.execute(
        select(TeacherAssignment).where(
            TeacherAssignment.student_id == student_id,
            TeacherAssignment.status == "active",
        ),
    ).scalar_one_or_none()
    if existing:
        raise errors.APIError(errors.E_PARAM_FORMAT.code, "该学员已有分配的老师", 400)

    a_id = new_uuid()
    db.execute(
        text(
            "INSERT INTO teacher_assignment "
            "(id, teacher_id, student_id, assigned_by, status, created_at, updated_at, schema_version) "
            "VALUES (:id, :tid, :sid, :by, 'active', :now, :now, 1)",
        ).bindparams(id=a_id, tid=teacher_id, sid=student_id, by=operator_id, now=utcnow()),
    )
    _write_audit(db, operator_id, "assign_student", student_id, {"teacher_id": teacher_id})
    db.commit()
    return {"assignment_id": a_id, "teacher_id": teacher_id, "student_id": student_id}


def unassign_student(db: Session, operator_id: str,
                     assignment_id: str) -> dict:
    """解除学员与老师的分配关系。"""
    db.execute(
        text(
            "UPDATE teacher_assignment SET status='inactive', updated_at=:now "
            "WHERE id=:aid AND status='active'",
        ).bindparams(aid=assignment_id, now=utcnow()),
    )
    _write_audit(db, operator_id, "unassign_student", None, {"assignment_id": assignment_id})
    db.commit()
    return {"assignment_id": assignment_id, "status": "inactive"}


# ── 审计日志 ──

def get_audit_logs(db: Session, target_user_id: str | None = None,
                   action: str | None = None, page: int = 1,
                   page_size: int = 20) -> dict:
    """查询管理操作审计日志。"""
    wheres = []
    params: dict = {}
    if target_user_id:
        wheres.append("target_user_id = :uid")
        params["uid"] = target_user_id
    if action:
        wheres.append("action = :action")
        params["action"] = action
    where_clause = " AND ".join(wheres) if wheres else "1=1"

    total_sql = f"SELECT COUNT(*) FROM admin_audit_log WHERE {where_clause}"
    total = db.execute(text(total_sql).bindparams(**params)).scalar() or 0

    rows = db.execute(
        text(
            f"SELECT * FROM admin_audit_log WHERE {where_clause} "
            "ORDER BY created_at DESC LIMIT :limit OFFSET :offset",
        ).bindparams(**params, limit=page_size, offset=(page - 1) * page_size),
    ).fetchall()

    items = []
    for r in rows:
        items.append({
            "id": r.id,
            "operator_id": r.operator_id,
            "action": r.action,
            "target_user_id": r.target_user_id,
            "detail": r.detail if r.detail else None,
            "created_at": r.created_at.isoformat() if r.created_at else "",
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


# ── 内部辅助 ──

def _write_audit(db: Session, operator_id: str, action: str,
                 target_user_id: str | None, detail: dict) -> None:
    """写入审计日志。"""
    a_id = new_uuid()
    import json
    detail_json = json.dumps(detail, ensure_ascii=False) if detail else None
    db.execute(
        text(
            "INSERT INTO admin_audit_log "
            "(id, operator_id, action, target_user_id, detail, created_at, schema_version) "
            "VALUES (:id, :oid, :action, :tid, :detail::jsonb, :now, 1)",
        ).bindparams(id=a_id, oid=operator_id, action=action, tid=target_user_id,
                     detail=detail_json, now=utcnow()),
    )


def _vip(vip: VipMembership | None) -> dict | None:
    if not vip:
        return None
    return {
        "level": vip.level,
        "storage_quota_mb": vip.storage_quota_mb,
        "storage_used_mb": vip.storage_used_mb,
        "start_at": vip.start_at.isoformat() if vip.start_at else None,
        "expire_at": vip.expire_at.isoformat() if vip.expire_at else None,
    }


def _trial(vip: VipMembership | None) -> dict | None:
    if not vip or vip.level != "trial" or not vip.expire_at:
        return {"is_trial": False}
    remaining = (vip.expire_at - utcnow()).days if vip.expire_at > utcnow() else 0
    return {
        "is_trial": True,
        "expire_at": vip.expire_at.isoformat(),
        "days_remaining": max(remaining, 0),
        "is_expired": vip.expire_at < utcnow(),
    }


def _teacher_profile_dict(tp: TeacherProfile | None) -> dict | None:
    if not tp:
        return None
    return {
        "bio": tp.bio,
        "expertise_tags": tp.expertise_tags or [],
        "service_status": tp.service_status,
        "rating": float(tp.rating) if tp.rating else None,
    }
