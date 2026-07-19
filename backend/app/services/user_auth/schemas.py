"""①用户/权限服务 请求/响应模型。"""
from __future__ import annotations

from pydantic import BaseModel, Field


class RegisterIn(BaseModel):
    phone: str = Field(min_length=5, max_length=32)
    code: str = Field(min_length=6, max_length=6)  # 短信验证码（必填）
    password: str = Field(min_length=6, max_length=64)
    nickname: str | None = None
    gender: str | None = None  # male/female
    role: str = "student"


class LoginIn(BaseModel):
    phone: str
    password: str


class SendCodeIn(BaseModel):
    phone: str = Field(min_length=5, max_length=32)
    purpose: str = "register"  # register / login


class CodeLoginIn(BaseModel):
    phone: str
    code: str = Field(min_length=6, max_length=6)


class ProfileIn(BaseModel):
    nickname: str | None = None
    gender: str | None = None  # male/female
    voice_type: str | None = None
    addressing: str | None = None
    care_mode: str | None = None


class CareModeIn(BaseModel):
    care_mode: str  # active/passive


class DisclaimerIn(BaseModel):
    disclaimer_type: str  # 在职风险免责 / 情绪树洞安全承诺


class GrantIn(BaseModel):
    grantee_teacher_id: str
    scope: str = "teacher_kb_read"
    nda_signed: bool = False


class TeacherAssignIn(BaseModel):
    teacher_id: str
    student_id: str


class ModelPreferenceIn(BaseModel):
    model: str = Field(min_length=1, max_length=64)


class PasswordChangeIn(BaseModel):
    old_password: str = Field(min_length=1)
    new_password: str = Field(min_length=6, max_length=64)


# ── 设置同步（Phase 5 全模块数据互通）──

class UserSettingsPatchIn(BaseModel):
    """合并式更新设置。仅传入要更新的 key。"""
    settings: dict = Field(default_factory=dict, description="要合并的设置键值对")


class UserSettingsResponse(BaseModel):
    """用户全部跨设备设置。"""
    user_id: str
    settings: dict = {}

