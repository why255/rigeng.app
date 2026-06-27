"""①用户/权限服务 路由层（步骤3 §3：U1-U9）。"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...shared.database import get_db
from ...shared.response import ok
from ...shared.security import CurrentUser, get_current_user, require_role
from . import service
from .schemas import (
    CareModeIn, DisclaimerIn, GrantIn, LoginIn, ProfileIn, RegisterIn, TeacherAssignIn,
)

router = APIRouter(tags=["①用户/权限"])


@router.post("/auth/register")  # 基础注册（创建账号+试用会员+贡献值余额）
def register(body: RegisterIn, db: Session = Depends(get_db)):
    user = service.register(db, phone=body.phone, password=body.password,
                            nickname=body.nickname, gender=body.gender, role=body.role)
    return ok({
        "message": "注册成功",
        "user_id": user.id,
        "phone": user.phone,
        "user": {
            "user_id": user.id,
            "id": user.id,
            "phone": user.phone,
            "nickname": user.nickname,
            "care_mode": user.care_mode,
            "voice_type": user.voice_type,
        },
    })


@router.post("/auth/login")  # U1
def login(body: LoginIn, db: Session = Depends(get_db)):
    token, user = service.login(db, phone=body.phone, password=body.password)
    return ok({
        "token": token,
        "user": {
            "user_id": user.id,
            "id": user.id,  # shared auth (pc/mobile) 期望 id 字段
            "phone": user.phone,
            "nickname": user.nickname,
            "care_mode": user.care_mode,
            "voice_type": user.voice_type,
        },
        "user_id": user.id,
        "role": user.role,
    })


@router.get("/users/me")  # U2
def me(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(service.get_me(db, user.user_id))


@router.patch("/users/me/profile")  # U3
def profile(body: ProfileIn, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(service.update_profile(db, user.user_id, voice_type=body.voice_type,
                                    addressing=body.addressing, care_mode=body.care_mode))


@router.get("/users/me/quota")  # U4
def quota(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(service.get_quota(db, user.user_id))


@router.post("/admin/teacher-assignments")  # U5（运营后台）
def assign(body: TeacherAssignIn,
           operator: CurrentUser = Depends(require_role("operator", "superadmin")),
           db: Session = Depends(get_db)):
    return ok(service.assign_teacher(db, teacher_id=body.teacher_id,
                                    student_id=body.student_id, assigned_by=operator.user_id))


@router.post("/users/me/grants")  # U6（老师只读授权·须NDA）
def grant(body: GrantIn, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(service.grant_teacher_readonly(db, user.user_id, teacher_id=body.grantee_teacher_id,
                                            scope=body.scope, nda_signed=body.nda_signed))


@router.post("/users/me/disclaimers")  # U7（免责声明确认）
def disclaimer(body: DisclaimerIn, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(service.accept_disclaimer(db, user.user_id, body.disclaimer_type))


@router.get("/users/me/trial")  # U8（试用期状态·过期返回30030）
def trial(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(service.get_trial(db, user.user_id))


@router.patch("/users/me/care-mode")  # U9（主动/被动关怀模式）
def care_mode(body: CareModeIn, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(service.set_care_mode(db, user.user_id, body.care_mode))
