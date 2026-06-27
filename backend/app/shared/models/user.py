"""用户域 + 权限域 ORM（步骤2 V1.1 §3.1 / §3.2）。"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from ..database import GUID, Base, PortableJSON, TimestampMixin

# ── 枚举常量（固定枚举用字符串约定；后台可配置项用自由 VARCHAR）──
ROLES = ("student", "teacher", "operator", "superadmin")
VIP_LEVELS = ("trial", "junior", "mid", "senior")
VOICE_TYPES = ("温婉", "知性", "亲切")
CARE_MODES = ("active", "passive")


class User(TimestampMixin, Base):
    __tablename__ = "user_account"  # 避开 PG 保留字 user

    phone: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    nickname: Mapped[str | None] = mapped_column(String(64))
    gender: Mapped[str | None] = mapped_column(String(16))  # male/female
    addressing: Mapped[str | None] = mapped_column(String(32))  # 姐/亲爱的…
    role: Mapped[str] = mapped_column(String(16), default="student")
    voice_type: Mapped[str | None] = mapped_column(String(16))
    care_mode: Mapped[str] = mapped_column(String(16), default="active")
    trial_start_at: Mapped[datetime | None] = mapped_column(DateTime)
    push_timezone: Mapped[str] = mapped_column(String(32), default="Asia/Shanghai")
    status: Mapped[str] = mapped_column(String(16), default="active")


class UserDisclaimer(TimestampMixin, Base):
    """免责声明确认（M8在职风险 / M3安全承诺）。"""

    __tablename__ = "user_disclaimer"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    disclaimer_type: Mapped[str] = mapped_column(String(32))
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime)
    accepted_version: Mapped[str] = mapped_column(String(32), default="1.0")


class VipMembership(TimestampMixin, Base):
    __tablename__ = "vip_membership"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    level: Mapped[str] = mapped_column(String(16), default="trial")
    storage_quota_mb: Mapped[int | None] = mapped_column(Integer)  # NULL=不限
    storage_used_mb: Mapped[int] = mapped_column(Integer, default=0)
    record_quota_min_monthly: Mapped[int | None] = mapped_column(Integer)
    record_used_min_monthly: Mapped[int] = mapped_column(Integer, default=0)
    video_quota_min_monthly: Mapped[int | None] = mapped_column(Integer)
    video_used_min_monthly: Mapped[int] = mapped_column(Integer, default=0)
    space_full_blocked: Mapped[bool] = mapped_column(Boolean, default=False)
    start_at: Mapped[datetime | None] = mapped_column(DateTime)
    expire_at: Mapped[datetime | None] = mapped_column(DateTime)


class TeacherProfile(TimestampMixin, Base):
    __tablename__ = "teacher_profile"

    teacher_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    bio: Mapped[str | None] = mapped_column(String(1024))
    expertise_tags: Mapped[dict | None] = mapped_column(PortableJSON())
    service_status: Mapped[str] = mapped_column(String(16), default="可接单")
    rating: Mapped[float | None] = mapped_column(Numeric(3, 2))


class TeacherAssignment(TimestampMixin, Base):
    __tablename__ = "teacher_assignment"

    teacher_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    student_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    assigned_by: Mapped[str | None] = mapped_column(GUID)
    nda_signed: Mapped[bool] = mapped_column(Boolean, default=False)
    private_kb_readonly: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(16), default="active")


class ContributionBalance(TimestampMixin, Base):
    """校友贡献值余额（永久有效·不可提现）。"""

    __tablename__ = "contribution_balance"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), unique=True, index=True)
    balance: Mapped[int] = mapped_column(Integer, default=0)
    level: Mapped[str] = mapped_column(String(16), default="青铜")


class ContributionLog(TimestampMixin, Base):
    __tablename__ = "contribution_log"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    change: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str | None] = mapped_column(String(128))
    ref_id: Mapped[str | None] = mapped_column(String(64))


class Referral(TimestampMixin, Base):
    """校友引荐（一级分销·荣誉制）。"""

    __tablename__ = "referral"

    referrer_user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    referee_user_id: Mapped[str | None] = mapped_column(GUID)
    qr_code: Mapped[str | None] = mapped_column(String(255))
    registered_at: Mapped[datetime | None] = mapped_column(DateTime)
    contribution_awarded: Mapped[bool] = mapped_column(Boolean, default=False)


class AuthorizationGrant(TimestampMixin, Base):
    """横切授权（品牌中心调私有库 / 老师只读 / 运营脱敏抽检）。"""

    __tablename__ = "authorization_grant"

    grantor_user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    grantee: Mapped[str] = mapped_column(String(64))
    scope: Mapped[str] = mapped_column(String(32))  # brand_kb_read/teacher_kb_read/ops_desensitized
    granted_at: Mapped[datetime | None] = mapped_column(DateTime)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime)
