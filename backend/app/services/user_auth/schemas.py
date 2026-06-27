"""①用户/权限服务 请求/响应模型。"""
from __future__ import annotations

from pydantic import BaseModel, Field


class RegisterIn(BaseModel):
    phone: str = Field(min_length=5, max_length=32)
    password: str = Field(min_length=6, max_length=64)
    nickname: str | None = None
    gender: str | None = None  # male/female
    role: str = "student"


class LoginIn(BaseModel):
    phone: str
    password: str


class ProfileIn(BaseModel):
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
