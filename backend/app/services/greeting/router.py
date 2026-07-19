"""开场白服务 路由层。"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...shared.database import get_db
from ...shared.response import ok
from ...shared.security import CurrentUser, get_current_user
from . import service
from .schemas import GreetingRequest

router = APIRouter(tags=["开场白"])


@router.post("/greeting")
def generate_greeting(
    body: GreetingRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """生成今日开场白。

    根据模块（朝有规划/暮有复盘/高维求职）和时间段，
    由AI生成个性化的开场问候语。
    前端负责按5AM日界缓存，每天仅需调用一次。
    """
    result = service.generate_greeting(module=body.module, user_id=user.user_id, db=db)
    return ok(result)
