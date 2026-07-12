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
            "VALUES (:id, :oid, :action, :tid, CAST(:detail AS jsonb), :now, 1)",
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


# ═══════════════════════════════════════════════
# 模型降级
# ═══════════════════════════════════════════════

PROVIDERS = [
    {"key": "volcano", "name": "火山引擎 (豆包)"},
    {"key": "dashscope", "name": "阿里云 (通义千问)"},
    {"key": "hunyuan", "name": "腾讯混元"},
    {"key": "kimi", "name": "月之暗面 (Kimi)"},
    {"key": "deepseek", "name": "DeepSeek"},
    {"key": "zhipu", "name": "智谱 (GLM)"},
    {"key": "anthropic", "name": "Anthropic (Claude)"},
]

from ...shared.models.model_config import ModelConfig, ModuleModelBinding


def list_providers() -> list[dict]:
    """返回可用的模型提供商列表。"""
    return PROVIDERS


# ── ModelConfig CRUD ──

def list_model_configs(
    db: Session,
    provider_key: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> dict:
    """分页查询模型版本列表。"""
    base = db.query(ModelConfig).filter(ModelConfig.deleted_at == None)
    if provider_key:
        base = base.filter(ModelConfig.provider_key == provider_key)

    total = base.count()
    rows = base.order_by(ModelConfig.provider_key, ModelConfig.created_at.desc()).offset(
        (page - 1) * page_size,
    ).limit(page_size).all()

    items = []
    for r in rows:
        items.append({
            "id": r.id,
            "provider_key": r.provider_key,
            "model_name": r.model_name,
            "model_version": r.model_version,
            "display_name": r.display_name,
            "is_available": r.is_available,
            "created_at": r.created_at.isoformat() if r.created_at else "",
            "updated_at": r.updated_at.isoformat() if r.updated_at else "",
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


def get_model_config(db: Session, config_id: str) -> dict:
    """获取单个模型版本详情。"""
    mc = db.get(ModelConfig, config_id)
    if not mc or mc.deleted_at:
        raise errors.APIError(errors.E_PARAM_FORMAT.code, "模型版本不存在", 404)
    return {
        "id": mc.id,
        "provider_key": mc.provider_key,
        "model_name": mc.model_name,
        "model_version": mc.model_version,
        "display_name": mc.display_name,
        "is_available": mc.is_available,
        "created_at": mc.created_at.isoformat() if mc.created_at else "",
        "updated_at": mc.updated_at.isoformat() if mc.updated_at else "",
    }


def create_model_config(db: Session, operator_id: str, data) -> dict:
    """新增模型版本。"""
    mc = ModelConfig(
        provider_key=data.provider_key,
        model_name=data.model_name,
        model_version=data.model_version,
        display_name=data.display_name,
        is_available=data.is_available,
    )
    db.add(mc)
    _write_audit(db, operator_id, "create_model_config", None, {
        "provider_key": data.provider_key,
        "model_name": data.model_name,
        "model_version": data.model_version,
    })
    db.commit()
    db.refresh(mc)
    return {
        "id": mc.id,
        "provider_key": mc.provider_key,
        "model_name": mc.model_name,
        "model_version": mc.model_version,
        "display_name": mc.display_name,
        "is_available": mc.is_available,
    }


def update_model_config(db: Session, operator_id: str, config_id: str, data) -> dict:
    """更新模型版本（启禁用、改名等）。"""
    mc = db.get(ModelConfig, config_id)
    if not mc or mc.deleted_at:
        raise errors.APIError(errors.E_PARAM_FORMAT.code, "模型版本不存在", 404)

    changes = {}
    if data.provider_key is not None:
        mc.provider_key = data.provider_key
        changes["provider_key"] = data.provider_key
    if data.model_name is not None:
        mc.model_name = data.model_name
        changes["model_name"] = data.model_name
    if data.model_version is not None:
        mc.model_version = data.model_version
        changes["model_version"] = data.model_version
    if data.display_name is not None:
        mc.display_name = data.display_name
        changes["display_name"] = data.display_name
    if data.is_available is not None:
        mc.is_available = data.is_available
        changes["is_available"] = data.is_available

    if changes:
        _write_audit(db, operator_id, "update_model_config", None, {
            "model_config_id": config_id, "changes": changes,
        })

    db.commit()
    db.refresh(mc)
    return {"id": mc.id, "updated": True, "changes": changes}


def delete_model_config(db: Session, operator_id: str, config_id: str) -> dict:
    """软删除模型版本。"""
    mc = db.get(ModelConfig, config_id)
    if not mc or mc.deleted_at:
        raise errors.APIError(errors.E_PARAM_FORMAT.code, "模型版本不存在", 404)

    # 检查是否有活跃绑定
    active_bindings = db.query(ModuleModelBinding).filter(
        ModuleModelBinding.model_config_id == config_id,
        ModuleModelBinding.is_active == True,
        ModuleModelBinding.deleted_at == None,
    ).count()
    if active_bindings > 0:
        raise errors.APIError(
            errors.E_PARAM_FORMAT.code,
            f"该模型版本有 {active_bindings} 个活跃绑定，请先降级这些模块后再删除",
            400,
        )

    mc.deleted_at = utcnow()
    _write_audit(db, operator_id, "delete_model_config", None, {
        "model_config_id": config_id,
    })
    db.commit()
    return {"id": config_id, "deleted": True}


# ── ModuleModelBinding CRUD ──

def list_module_bindings(
    db: Session,
    module_key: str | None = None,
    is_active: bool | None = None,
    page: int = 1,
    page_size: int = 50,
) -> dict:
    """分页查询模块绑定列表（JOIN 模型信息）。"""
    base = db.query(
        ModuleModelBinding.id.label("binding_id"),
        ModuleModelBinding.module_key,
        ModuleModelBinding.module_display_name,
        ModuleModelBinding.model_config_id,
        ModuleModelBinding.is_active,
        ModuleModelBinding.created_at,
        ModuleModelBinding.updated_at,
        ModelConfig.model_name,
        ModelConfig.model_version,
        ModelConfig.provider_key,
        ModelConfig.display_name,
    ).join(
        ModelConfig, ModuleModelBinding.model_config_id == ModelConfig.id,
    ).filter(
        ModuleModelBinding.deleted_at == None,
    )

    if module_key:
        base = base.filter(ModuleModelBinding.module_key == module_key)
    if is_active is not None:
        base = base.filter(ModuleModelBinding.is_active == is_active)

    total = base.count()
    rows = base.order_by(
        ModuleModelBinding.module_key,
        ModuleModelBinding.created_at.desc(),
    ).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for r in rows:
        items.append({
            "id": r.binding_id,
            "module_key": r.module_key,
            "module_display_name": r.module_display_name,
            "model_config_id": r.model_config_id,
            "is_active": r.is_active,
            "model_name": r.model_name,
            "model_version": r.model_version,
            "provider_key": r.provider_key,
            "display_name": r.display_name,
            "created_at": r.created_at.isoformat() if r.created_at else "",
            "updated_at": r.updated_at.isoformat() if r.updated_at else "",
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


def get_module_binding(db: Session, binding_id: str) -> dict:
    """获取单个绑定详情。"""
    b = db.get(ModuleModelBinding, binding_id)
    if not b or b.deleted_at:
        raise errors.APIError(errors.E_PARAM_FORMAT.code, "绑定不存在", 404)

    mc = db.get(ModelConfig, b.model_config_id)
    return {
        "id": b.id,
        "module_key": b.module_key,
        "module_display_name": b.module_display_name,
        "model_config_id": b.model_config_id,
        "is_active": b.is_active,
        "model_name": mc.model_name if mc else None,
        "model_version": mc.model_version if mc else None,
        "provider_key": mc.provider_key if mc else None,
        "created_at": b.created_at.isoformat() if b.created_at else "",
        "updated_at": b.updated_at.isoformat() if b.updated_at else "",
    }


def create_module_binding(db: Session, operator_id: str, data) -> dict:
    """新增模块→模型绑定。"""
    # 验证 model_config_id 存在
    mc = db.get(ModelConfig, data.model_config_id)
    if not mc or mc.deleted_at:
        raise errors.APIError(errors.E_PARAM_FORMAT.code, "模型版本不存在", 404)

    b = ModuleModelBinding(
        module_key=data.module_key,
        module_display_name=data.module_display_name,
        model_config_id=data.model_config_id,
        is_active=data.is_active if data.is_active is not None else True,
    )
    db.add(b)
    _write_audit(db, operator_id, "create_module_binding", None, {
        "module_key": data.module_key,
        "model_config_id": data.model_config_id,
    })
    db.commit()
    db.refresh(b)
    return {
        "id": b.id,
        "module_key": b.module_key,
        "module_display_name": b.module_display_name,
        "model_config_id": b.model_config_id,
        "is_active": b.is_active,
    }


def update_module_binding(db: Session, operator_id: str, binding_id: str, data) -> dict:
    """更新绑定（降级操作入口）。"""
    b = db.get(ModuleModelBinding, binding_id)
    if not b or b.deleted_at:
        raise errors.APIError(errors.E_PARAM_FORMAT.code, "绑定不存在", 404)

    changes = {}
    if data.model_config_id is not None:
        mc = db.get(ModelConfig, data.model_config_id)
        if not mc or mc.deleted_at:
            raise errors.APIError(errors.E_PARAM_FORMAT.code, "目标模型版本不存在", 404)
        b.model_config_id = data.model_config_id
        changes["model_config_id"] = data.model_config_id
    if data.is_active is not None:
        b.is_active = data.is_active
        changes["is_active"] = data.is_active
    if data.module_display_name is not None:
        b.module_display_name = data.module_display_name
        changes["module_display_name"] = data.module_display_name

    if changes:
        _write_audit(db, operator_id, "update_module_binding", None, {
            "binding_id": binding_id, "changes": changes,
        })

    db.commit()
    db.refresh(b)
    return {"id": b.id, "updated": True, "changes": changes}


def delete_module_binding(db: Session, operator_id: str, binding_id: str) -> dict:
    """软删除绑定。"""
    b = db.get(ModuleModelBinding, binding_id)
    if not b or b.deleted_at:
        raise errors.APIError(errors.E_PARAM_FORMAT.code, "绑定不存在", 404)

    b.deleted_at = utcnow()
    _write_audit(db, operator_id, "delete_module_binding", None, {
        "binding_id": binding_id,
    })
    db.commit()
    return {"id": binding_id, "deleted": True}


def degrade_module(db: Session, operator_id: str, module_key: str,
                   new_model_config_id: str) -> dict:
    """一键降级：将指定模块切换到新模型版本。

    1. 验证目标模型存在且可用
    2. 将当前活跃绑定设为 inactive
    3. 创建新的活跃绑定
    """
    # 验证目标模型
    mc = db.get(ModelConfig, new_model_config_id)
    if not mc or mc.deleted_at:
        raise errors.APIError(errors.E_PARAM_FORMAT.code, "目标模型版本不存在", 404)
    if not mc.is_available:
        raise errors.APIError(errors.E_PARAM_FORMAT.code, "目标模型版本已被禁用", 400)

    # 查找旧模型信息（用于审计）
    old_bindings = db.query(ModuleModelBinding).filter(
        ModuleModelBinding.module_key == module_key,
        ModuleModelBinding.is_active == True,
        ModuleModelBinding.deleted_at == None,
    ).all()

    old_model = None
    # 停用所有旧活跃绑定
    for ob in old_bindings:
        ob.is_active = False
        if ob.model_config_id:
            old_mc = db.get(ModelConfig, ob.model_config_id)
            if old_mc:
                old_model = old_mc.model_name

    # 创建新绑定
    b = ModuleModelBinding(
        module_key=module_key,
        module_display_name=old_bindings[0].module_display_name if old_bindings else None,
        model_config_id=new_model_config_id,
        is_active=True,
    )
    db.add(b)

    _write_audit(db, operator_id, "degrade_module", None, {
        "module_key": module_key,
        "old_model": old_model,
        "new_model": mc.model_name,
        "new_model_config_id": new_model_config_id,
    })

    db.commit()
    db.refresh(b)
    return {
        "id": b.id,
        "module_key": module_key,
        "old_model": old_model,
        "new_model": mc.model_name,
        "new_provider": mc.provider_key,
        "degraded": True,
    }


# ═══════════════════════════════════════════════
# 携君库文档管理
# ═══════════════════════════════════════════════

from ...shared.models.knowledge import Document, FileObject

# HR八大模块（携君库分类）
XIEJUN_CATEGORIES = [
    "人力资源规划", "招聘与配置", "培训与开发", "绩效管理",
    "薪酬福利管理", "劳动关系管理", "组织发展", "员工关系",
]

# 自动归类关键词映射
CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "人力资源规划": ["人力规划", "人力资源规划", "组织架构", "岗位编制", "人力预算", "人员规划"],
    "招聘与配置": ["招聘", "面试", "配置", "入职", "人才引进", "猎头", "校招", "社招"],
    "培训与开发": ["培训", "开发", "学习", "课程", "讲师", "教练", "mentor", "培养"],
    "绩效管理": ["绩效", "KPI", "OKR", "考核", "评估", "目标管理", "BSC"],
    "薪酬福利管理": ["薪酬", "福利", "工资", "薪资", "奖金", "股权", "激励", "补贴", "公积金"],
    "劳动关系管理": ["劳动", "合同", "法务", "合规", "仲裁", "纠纷", "工伤", "社保"],
    "组织发展": ["组织发展", "OD", "变革", "文化", "价值观", "梯队", "继任", "领导力"],
    "员工关系": ["员工关系", "ER", "满意度", "敬业度", "沟通", "团建", "活动", "关怀"],
}


def _auto_categorize(title: str, filename: str = "") -> str:
    """根据标题和文件名自动归类到HR八大模块。"""
    text = f"{title} {filename}".lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw.lower() in text:
                return category
    return "人力资源规划"  # 默认归类


def list_xiejun_documents(
    db: Session,
    category: str | None = None,
    status: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """分页查询携君库（public）文档列表。"""
    base = db.query(Document).filter(
        Document.library_type == "public",
        Document.deleted_at == None,
    )

    if category:
        base = base.filter(Document.hr_category == category)
    if status:
        base = base.filter(Document.status == status)

    total = base.count()
    rows = base.order_by(Document.updated_at.desc()).offset(
        (page - 1) * page_size,
    ).limit(page_size).all()

    items = []
    for d in rows:
        items.append({
            "id": d.id,
            "title": d.title or "",
            "category": d.hr_category or "未分类",
            "author": "安老师",
            "status": d.status,
            "updated_at": d.updated_at.isoformat() if d.updated_at else "",
            "views": 0,
            "file_object_id": d.file_object_id,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


def get_xiejun_stats(db: Session) -> dict:
    """携君库文档统计。"""
    from sqlalchemy import func as F

    base = db.query(Document).filter(
        Document.library_type == "public",
        Document.deleted_at == None,
    )

    total = base.count()
    published = base.filter(Document.status == "published").count()
    draft = base.filter(Document.status == "draft").count()
    archived = base.filter(Document.status == "recycled").count()

    # 按分类统计
    cat_rows = db.execute(
        select(Document.hr_category, F.count(Document.id))
        .where(
            Document.library_type == "public",
            Document.deleted_at == None,
        )
        .group_by(Document.hr_category)
    ).all()
    by_category = {row[0] or "未分类": row[1] for row in cat_rows}

    return {
        "total": total,
        "published": published,
        "draft": draft,
        "archived": archived,
        "by_category": by_category,
    }


def upload_xiejun_document(
    db: Session,
    operator_id: str,
    file_content: bytes,
    filename: str,
    file_type: str,
    title: str | None = None,
) -> dict:
    """上传文档到携君库：存文件 + 创建Document记录 + 自动归类。

    Args:
        file_content: 文件原始字节
        filename: 原始文件名
        file_type: document / image / pdf 等
        title: 文档标题（默认取文件名）
    """
    import hashlib
    import os

    size_bytes = len(file_content)

    # 1. 计算校验和
    checksum = hashlib.sha256(file_content).hexdigest()

    # 2. 创建 FileObject 记录
    file_id = new_uuid()
    storage_dir = os.path.join(
        os.path.dirname(__file__), "..", "..", "..", "storage", "xiejun",
    )
    os.makedirs(storage_dir, exist_ok=True)
    ext = os.path.splitext(filename)[1] or ""
    storage_url = os.path.join(storage_dir, f"{file_id}{ext}")

    # 3. 写入本地磁盘
    with open(storage_url, "wb") as f:
        f.write(file_content)

    file_obj = FileObject(
        id=file_id,
        storage_url=storage_url,
        file_type=file_type,
        size_bytes=size_bytes,
        compress_status="raw",
        storage_layer="cloud",
        checksum=checksum,
    )
    db.add(file_obj)
    db.flush()

    # 4. 确定标题和自动归类
    doc_title = title or os.path.splitext(filename)[0]
    hr_category = _auto_categorize(doc_title, filename)

    # 5. 创建 Document 记录（携君库 = public，无 owner）
    doc = Document(
        owner_user_id=None,  # 携君库文档无个人归属
        library_type="public",
        doc_type="sop",  # 默认类型，后续可扩展
        source_module=None,
        hr_category=hr_category,
        title=doc_title,
        content={"filename": filename, "file_type": file_type, "size_bytes": size_bytes},
        status="published",  # 管理员上传直接发布
        audit_status="passed",
        watermark_required=True,
        copy_char_limit=500,
        file_object_id=file_id,
        vector_status="pending",
        version=1,
    )
    db.add(doc)
    db.flush()

    _write_audit(db, operator_id, "upload_xiejun_doc", None, {
        "doc_id": doc.id,
        "title": doc_title,
        "category": hr_category,
        "filename": filename,
        "size_bytes": size_bytes,
    })

    db.commit()
    db.refresh(doc)

    return {
        "id": doc.id,
        "title": doc.title,
        "category": doc.hr_category,
        "status": doc.status,
        "filename": filename,
        "size_bytes": size_bytes,
        "auto_categorized": True,
    }


def update_xiejun_document(
    db: Session,
    operator_id: str,
    doc_id: str,
    data,
) -> dict:
    """更新携君库文档（标题、分类、状态等）。"""
    d = db.get(Document, doc_id)
    if not d or d.deleted_at is not None:
        raise errors.APIError(errors.E_PARAM_FORMAT.code, "文档不存在", 404)
    if d.library_type != "public":
        raise errors.APIError(errors.E_PARAM_FORMAT.code, "非携君库文档", 400)

    changes = {}
    if data.title is not None:
        d.title = data.title
        changes["title"] = data.title
    if data.hr_category is not None:
        d.hr_category = data.hr_category
        changes["hr_category"] = data.hr_category
    if data.status is not None:
        d.status = data.status
        changes["status"] = data.status

    if changes:
        _write_audit(db, operator_id, "update_xiejun_doc", None, {
            "doc_id": doc_id, "changes": changes,
        })

    db.commit()
    db.refresh(d)
    return {
        "id": d.id,
        "title": d.title,
        "category": d.hr_category,
        "status": d.status,
        "updated": True,
    }


def delete_xiejun_document(
    db: Session,
    operator_id: str,
    doc_id: str,
) -> dict:
    """软删除携君库文档。"""
    d = db.get(Document, doc_id)
    if not d or d.deleted_at is not None:
        raise errors.APIError(errors.E_PARAM_FORMAT.code, "文档不存在", 404)
    if d.library_type != "public":
        raise errors.APIError(errors.E_PARAM_FORMAT.code, "非携君库文档", 400)

    d.status = "recycled"
    d.deleted_at = utcnow()

    _write_audit(db, operator_id, "delete_xiejun_doc", None, {
        "doc_id": doc_id, "title": d.title,
    })

    db.commit()
    return {"id": doc_id, "deleted": True}
