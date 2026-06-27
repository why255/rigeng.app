"""①用户/权限服务 业务逻辑层。

实现：注册/登录/当前用户/资料/VIP配额/试用期/免责声明/老师授权(NDA)/关怀模式。
"""
from __future__ import annotations

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from ...shared import errors
from ...shared.config import settings
from ...shared.database import utcnow
from ...shared.models.user import (
    AuthorizationGrant, CARE_MODES, ContributionBalance, TeacherAssignment,
    User, UserDisclaimer, VipMembership, VOICE_TYPES,
)
from ...shared.security import create_access_token, hash_password, verify_password


def _enum_guard(value, allowed, field):
    if value is not None and value not in allowed:
        raise errors.APIError(errors.E_PARAM_FORMAT.code, f"{field} 取值非法: {value}", 400)


def register(db: Session, *, phone: str, password: str, nickname: str | None,
             gender: str | None, role: str) -> User:
    if db.scalar(select(User).where(User.phone == phone)):
        raise errors.APIError(errors.E_PARAM_FORMAT.code, "手机号已注册", 400)
    now = utcnow()
    user = User(
        phone=phone, password_hash=hash_password(password), nickname=nickname,
        gender=gender, addressing="姐" if gender == "female" else ("哥" if gender == "male" else None),
        role=role, trial_start_at=now, status="active",
    )
    db.add(user)
    db.flush()  # 取 user.id

    # 注册即开通 7 天试用会员
    db.add(VipMembership(
        user_id=user.id, level="trial",
        start_at=now, expire_at=now + timedelta(days=settings.TRIAL_DAYS),
    ))
    # 初始化贡献值余额
    db.add(ContributionBalance(user_id=user.id, balance=0, level="青铜"))
    db.commit()
    db.refresh(user)
    return user


def login(db: Session, *, phone: str, password: str) -> tuple[str, User]:
    user = db.scalar(select(User).where(User.phone == phone))
    if not user or not verify_password(password, user.password_hash):
        raise errors.E_USER_NOT_FOUND
    vip = db.scalar(select(VipMembership).where(VipMembership.user_id == user.id))
    trial_expire = vip.expire_at.isoformat() if vip and vip.expire_at else None
    token = create_access_token(
        user_id=user.id, role=user.role,
        vip_level=vip.level if vip else "trial", trial_expire_at=trial_expire,
    )
    return token, user


def get_me(db: Session, user_id: str) -> dict:
    user = db.get(User, user_id)
    if not user:
        raise errors.E_USER_NOT_FOUND
    vip = db.scalar(select(VipMembership).where(VipMembership.user_id == user_id))
    bal = db.scalar(select(ContributionBalance).where(ContributionBalance.user_id == user_id))
    return {
        "user_id": user.id, "phone": user.phone, "nickname": user.nickname,
        "role": user.role, "voice_type": user.voice_type, "addressing": user.addressing,
        "care_mode": user.care_mode,
        "vip": _vip_dict(vip), "trial": _trial_dict(vip),
        "contribution": {"balance": bal.balance if bal else 0, "level": bal.level if bal else "青铜"},
    }


def update_profile(db: Session, user_id: str, *, voice_type, addressing, care_mode) -> dict:
    _enum_guard(voice_type, VOICE_TYPES, "voice_type")
    _enum_guard(care_mode, CARE_MODES, "care_mode")
    user = db.get(User, user_id)
    if not user:
        raise errors.E_USER_NOT_FOUND
    if voice_type is not None:
        user.voice_type = voice_type
    if addressing is not None:
        user.addressing = addressing
    if care_mode is not None:
        user.care_mode = care_mode
    db.commit()
    return {"voice_type": user.voice_type, "addressing": user.addressing, "care_mode": user.care_mode}


def set_care_mode(db: Session, user_id: str, care_mode: str) -> dict:
    _enum_guard(care_mode, CARE_MODES, "care_mode")
    user = db.get(User, user_id)
    if not user:
        raise errors.E_USER_NOT_FOUND
    user.care_mode = care_mode
    db.commit()
    return {"care_mode": user.care_mode}


def _vip_dict(vip: VipMembership | None) -> dict:
    if not vip:
        return {}
    return {
        "level": vip.level,
        "storage_quota_mb": vip.storage_quota_mb, "storage_used_mb": vip.storage_used_mb,
        "record_quota_min_monthly": vip.record_quota_min_monthly, "record_used_min_monthly": vip.record_used_min_monthly,
        "video_quota_min_monthly": vip.video_quota_min_monthly, "video_used_min_monthly": vip.video_used_min_monthly,
        "space_full_blocked": vip.space_full_blocked,
    }


def get_quota(db: Session, user_id: str) -> dict:
    vip = db.scalar(select(VipMembership).where(VipMembership.user_id == user_id))
    if not vip:
        raise errors.E_USER_NOT_FOUND
    return _vip_dict(vip)


def _trial_dict(vip: VipMembership | None) -> dict:
    if not vip or vip.level != "trial" or not vip.expire_at:
        return {"is_trial": False}
    remaining = (vip.expire_at - utcnow()).days
    return {
        "is_trial": True, "trial_start_at": vip.start_at.isoformat() if vip.start_at else None,
        "expire_at": vip.expire_at.isoformat(), "days_remaining": max(remaining, 0),
        "is_expired": vip.expire_at < utcnow(),
    }


def get_trial(db: Session, user_id: str) -> dict:
    vip = db.scalar(select(VipMembership).where(VipMembership.user_id == user_id))
    info = _trial_dict(vip)
    if info.get("is_expired"):
        # 试用过期返回业务码（U8 → 30030），但仍带数据供前端引导升级
        raise errors.E_TRIAL_EXPIRED
    return info


def accept_disclaimer(db: Session, user_id: str, disclaimer_type: str) -> dict:
    rec = UserDisclaimer(
        user_id=user_id, disclaimer_type=disclaimer_type,
        accepted_at=utcnow(), accepted_version="1.0",
    )
    db.add(rec)
    db.commit()
    return {"disclaimer_type": disclaimer_type, "accepted_at": rec.accepted_at.isoformat(), "version": "1.0"}


def grant_teacher_readonly(db: Session, user_id: str, *, teacher_id: str, scope: str, nda_signed: bool) -> dict:
    """U6：授予老师私有库只读——必须已签 NDA，否则 30020。"""
    assignment = db.scalar(
        select(TeacherAssignment).where(
            TeacherAssignment.teacher_id == teacher_id,
            TeacherAssignment.student_id == user_id,
        )
    )
    if not nda_signed and not (assignment and assignment.nda_signed):
        raise errors.E_TEACHER_NDA
    if assignment:
        assignment.nda_signed = True
        assignment.private_kb_readonly = True
    grant = AuthorizationGrant(
        grantor_user_id=user_id, grantee=teacher_id, scope=scope, granted_at=utcnow(),
    )
    db.add(grant)
    db.commit()
    return {"grant_id": grant.id, "grantee": teacher_id, "scope": scope, "granted_at": grant.granted_at.isoformat()}


def assign_teacher(db: Session, *, teacher_id: str, student_id: str, assigned_by: str) -> dict:
    """U5：运营后台分配老师给学员（用户不可自选）。"""
    if not db.get(User, teacher_id) or not db.get(User, student_id):
        raise errors.E_USER_NOT_FOUND
    a = TeacherAssignment(
        teacher_id=teacher_id, student_id=student_id, assigned_by=assigned_by, status="active",
    )
    db.add(a)
    db.commit()
    return {"assignment_id": a.id, "teacher_id": teacher_id, "student_id": student_id}
