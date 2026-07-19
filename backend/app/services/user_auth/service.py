"""①用户/权限服务 业务逻辑层。

实现：注册/登录/当前用户/资料/VIP配额/试用期/免责声明/老师授权(NDA)/关怀模式/短信验证码。
"""
from __future__ import annotations

import secrets
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ...shared import errors
from ...shared.config import settings
from ...shared.database import utcnow
from ...shared.models.analytics import SmsSendLog
from ...shared.models.knowledge import Document
from ...shared.models.user import (
    AuthorizationGrant, CARE_MODES, ContributionBalance, TeacherAssignment,
    User, UserDisclaimer, VipMembership, VOICE_TYPES,
)
from ...shared.redis_client import redis_client
from ...shared.security import create_access_token, hash_password, verify_password


def _enum_guard(value, allowed, field):
    if value is not None and value not in allowed:
        raise errors.APIError(errors.E_PARAM_FORMAT.code, f"{field} 取值非法: {value}", 400)


# ═══════════════════════════════════════════════
# 短信验证码
# ═══════════════════════════════════════════════

def _generate_code() -> str:
    """生成6位密码学安全随机验证码。"""
    return str(secrets.randbelow(900000) + 100000)


def send_verification_code(db: Session, *, phone: str, purpose: str) -> dict:
    """发送短信验证码。

    控制规则：
    - SMS_ENABLED=False 时拒绝发送
    - 同一手机号60秒内只能发1条
    - 同一手机号每小时最多5条
    - 验证码5分钟有效，存储于 Redis
    """
    if purpose not in ("register", "login"):
        raise errors.APIError(errors.E_PARAM_FORMAT.code, "purpose 必须为 register 或 login", 400)

    if not settings.SMS_ENABLED:
        raise errors.E_SMS_DISABLED

    # 60s 冷却
    cooldown_key = f"verify:cooldown:{phone}"
    if redis_client.exists(cooldown_key):
        ttl = redis_client.ttl(cooldown_key)
        raise errors.APIError(
            errors.E_VERIFY_CODE_COOLDOWN.code,
            f"验证码发送过于频繁，请在{max(int(ttl), 1)}秒后重试",
            429,
        )

    # 每小时上限
    hourly_key = f"verify:hourly:{phone}"
    count = redis_client.get(hourly_key)
    if count and int(count) >= 5:
        raise errors.E_VERIFY_CODE_HOURLY_MAX

    # 生成验证码并存入 Redis（5分钟过期）
    code = _generate_code()
    code_key = f"verify:code:{purpose}:{phone}"
    redis_client.setex(code_key, 300, code)

    # 设置冷却标记（60秒）
    redis_client.setex(cooldown_key, 60, "1")

    # 小时计数器（首次设置时加 TTL）
    new_count = redis_client.incr(hourly_key)
    if new_count == 1:
        redis_client.expire(hourly_key, 3600)

    # 调用阿里云发送短信
    sms_sent = False
    sms_error = None
    if settings.ALIYUN_SMS_ACCESS_KEY_ID and settings.ALIYUN_SMS_TEMPLATE_LOGIN_VERIFY:
        try:
            from ..push_service.service import send_sms
            result = send_sms(phone, settings.ALIYUN_SMS_TEMPLATE_LOGIN_VERIFY, {"code": code}, skip_quota_check=True)
            sms_sent = result.get("sent", False)
            if not sms_sent:
                sms_error = result.get("reason") or result.get("error") or "短信发送失败"
        except Exception as e:
            sms_error = str(e)
    else:
        # 开发/测试环境：未配置短信时打日志但不报错
        import logging
        logging.getLogger("rigeng").warning(f"[DEV] 验证码未发送（短信未配置） phone={phone} code={code}")

    # 记录到 DB
    log_entry = SmsSendLog(
        phone=phone,
        purpose=purpose,
        trigger_condition=f"verify:{purpose}",
        module="auth",
        sent_at=utcnow(),
        expires_at=utcnow() + timedelta(minutes=5),
    )
    db.add(log_entry)
    db.commit()

    if not sms_sent and sms_error:
        raise errors.APIError(errors.E_SMS_DISABLED.code, f"短信发送失败: {sms_error}", 503)

    return {
        "message": "验证码已发送",
        "expires_in": 300,
    }


def _verify_code_in_redis(phone: str, code: str, purpose: str) -> None:
    """校验验证码（一次性使用，验完即删）。"""
    code_key = f"verify:code:{purpose}:{phone}"
    stored = redis_client.get(code_key)
    if stored is None:
        raise errors.E_VERIFY_CODE_EXPIRED
    if stored != code:
        raise errors.E_VERIFY_CODE_INVALID
    redis_client.delete(code_key)


def code_login(db: Session, *, phone: str, code: str) -> tuple[str, User]:
    """验证码登录：校验验证码后签发 JWT。"""
    _verify_code_in_redis(phone, code, "login")
    user = db.scalar(select(User).where(User.phone == phone))
    if not user:
        raise errors.E_USER_NOT_FOUND
    vip = db.scalar(select(VipMembership).where(VipMembership.user_id == user.id))
    trial_expire = vip.expire_at.isoformat() if vip and vip.expire_at else None
    token = create_access_token(
        user_id=user.id, role=user.role,
        vip_level=vip.level if vip else "trial", trial_expire_at=trial_expire,
    )
    # 标记短信已验证
    log = db.scalar(
        select(SmsSendLog).where(
            SmsSendLog.phone == phone,
            SmsSendLog.purpose == "login",
        ).order_by(SmsSendLog.sent_at.desc())
    )
    if log:
        log.verified_at = utcnow()
        db.commit()
    return token, user


def register(db: Session, *, phone: str, code: str, password: str, nickname: str | None,
             gender: str | None, role: str) -> User:
    """注册：先校验验证码，再创建用户。"""
    _verify_code_in_redis(phone, code, "register")
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

    # 日耕天数：从注册日到今天（注册当天算第1天）
    farming_days = 1
    if user.created_at:
        delta = date.today() - user.created_at.date()
        farming_days = max(1, delta.days + 1)

    # 累计完成计划数（永久计数器，每次完成一个计划项 +1）
    completed_plans = user.completed_plans_count or 0

    # 沉淀文档数（不含已回收/软删除）
    total_docs = db.scalar(
        select(func.count(Document.id)).where(
            Document.owner_user_id == user_id,
            Document.status != "recycled",
            Document.deleted_at.is_(None),
        )
    ) or 0

    return {
        "user_id": user.id, "phone": user.phone, "nickname": user.nickname,
        "gender": user.gender, "addressing": user.addressing,
        "avatar": user.avatar,
        "role": user.role, "voice_type": user.voice_type,
        "care_mode": user.care_mode,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "trial_start_at": user.trial_start_at.isoformat() if user.trial_start_at else None,
        "preferred_model": user.preferred_model,
        "vip": _vip_dict(vip), "trial": _trial_dict(vip),
        "contribution": {"balance": bal.balance if bal else 0, "level": bal.level if bal else "青铜"},
        "farming_days": farming_days,
        "completed_plans": completed_plans,
        "total_docs": total_docs,
    }


def increment_completed_plans(db: Session, user_id: str) -> dict:
    """完成计划计数 +1（永久累加）。"""
    user = db.get(User, user_id)
    if not user:
        raise errors.E_USER_NOT_FOUND
    user.completed_plans_count = (user.completed_plans_count or 0) + 1
    db.commit()
    return {"completed_plans": user.completed_plans_count}


def update_profile(db: Session, user_id: str, *, nickname, gender, voice_type, addressing, care_mode) -> dict:
    _enum_guard(voice_type, VOICE_TYPES, "voice_type")
    _enum_guard(care_mode, CARE_MODES, "care_mode")
    user = db.get(User, user_id)
    if not user:
        raise errors.E_USER_NOT_FOUND
    if nickname is not None:
        user.nickname = nickname
    if gender is not None:
        user.gender = gender
    if voice_type is not None:
        user.voice_type = voice_type
    if addressing is not None:
        user.addressing = addressing
    if care_mode is not None:
        user.care_mode = care_mode
    db.commit()
    return {"nickname": user.nickname, "gender": user.gender,
            "voice_type": user.voice_type, "addressing": user.addressing,
            "care_mode": user.care_mode}


def set_care_mode(db: Session, user_id: str, care_mode: str) -> dict:
    _enum_guard(care_mode, CARE_MODES, "care_mode")
    user = db.get(User, user_id)
    if not user:
        raise errors.E_USER_NOT_FOUND
    user.care_mode = care_mode
    db.commit()
    return {"care_mode": user.care_mode}


def change_password(db: Session, user_id: str, old_password: str, new_password: str) -> dict:
    """修改密码：验证旧密码后更新为新密码。"""
    user = db.get(User, user_id)
    if not user:
        raise errors.E_USER_NOT_FOUND
    if not verify_password(old_password, user.password_hash):
        raise errors.APIError(errors.E_PARAM_FORMAT.code, "旧密码错误", 400)
    user.password_hash = hash_password(new_password)
    db.commit()
    return {"message": "密码已更新"}


# ── 设置同步（Phase 5 全模块数据互通）──

def get_user_settings(db: Session, user_id: str) -> dict:
    """读取用户全部跨设备设置。"""
    user = db.get(User, user_id)
    if not user:
        raise errors.E_USER_NOT_FOUND
    return {
        "user_id": user_id,
        "settings": user.settings_json or {},
    }


def patch_user_settings(db: Session, user_id: str, updates: dict) -> dict:
    """合并式更新用户设置。仅更新传入的 key，保留未传入的 key。"""
    user = db.get(User, user_id)
    if not user:
        raise errors.E_USER_NOT_FOUND

    current = dict(user.settings_json or {})
    current.update(updates)
    user.settings_json = current
    db.commit()

    return {
        "user_id": user_id,
        "settings": current,
    }


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


def get_preferred_model(db: Session, user_id: str) -> dict:
    """获取用户模型偏好，未设置时返回全局默认。"""
    user = db.get(User, user_id)
    if not user:
        raise errors.E_USER_NOT_FOUND
    from ...shared.config import settings
    model = user.preferred_model or settings.ZHIPUAI_MODEL
    return {"model": model, "is_custom": user.preferred_model is not None}


def set_preferred_model(db: Session, user_id: str, model: str) -> dict:
    """设置用户模型偏好。"""
    user = db.get(User, user_id)
    if not user:
        raise errors.E_USER_NOT_FOUND
    user.preferred_model = model
    db.commit()
    return {"model": model}


def upload_avatar(db: Session, user_id: str, content: bytes, filename: str) -> dict:
    """上传用户头像：存入文件存储并更新 user.avatar。"""
    from ..file_storage.service import upload_file as storage_upload
    result = storage_upload(db, user_id, content, file_type="image", filename=filename)
    user = db.get(User, user_id)
    if user:
        user.avatar = result.get("file_id") or result.get("path", "")
        db.commit()
    return {"avatar": user.avatar if user else "", "file": result}
