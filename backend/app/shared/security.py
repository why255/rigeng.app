"""JWT 鉴权 + 密码哈希 + 鉴权依赖（步骤3 §1.2）。

- 密码：passlib pbkdf2_sha256（纯 Python，无原生依赖，测试友好）。
- JWT 载荷：user_id / role / vip_level / trial_expire_at。
- 依赖：get_current_user / require_role。
"""
from __future__ import annotations

from datetime import timedelta

import jwt
from fastapi import Depends, Request
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from . import errors
from .config import settings
from .database import get_db, utcnow

_pwd = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_password(raw: str) -> str:
    return _pwd.hash(raw)


def verify_password(raw: str, hashed: str) -> bool:
    return _pwd.verify(raw, hashed)


def create_access_token(*, user_id: str, role: str, vip_level: str,
                        trial_expire_at: str | None = None) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "vip_level": vip_level,
        "trial_expire_at": trial_expire_at,
        "exp": utcnow() + timedelta(minutes=settings.JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise errors.E_TOKEN_EXPIRED
    except jwt.PyJWTError:
        raise errors.E_UNAUTHENTICATED


class CurrentUser:
    def __init__(self, payload: dict):
        self.user_id: str = payload["sub"]
        self.role: str = payload.get("role", "student")
        self.vip_level: str = payload.get("vip_level", "trial")


def get_current_user(request: Request) -> CurrentUser:
    # 优先从 Authorization header 读取，降级到 query 参数 ?token=xxx
    # （用于 <audio>/<video> 等浏览器自动发起的请求，无法设置自定义 header）
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return CurrentUser(decode_token(auth[7:]))
    # 降级：query 参数
    token = request.query_params.get("token", "")
    if token:
        return CurrentUser(decode_token(token))
    raise errors.E_UNAUTHENTICATED


def require_role(*roles: str):
    """运营后台接口：仅 operator/superadmin 等指定角色可用。"""

    def _dep(user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
        if user.role not in roles:
            raise errors.E_NO_PERMISSION
        return user

    return _dep


# 便捷 DB 依赖再导出
__all__ = [
    "hash_password", "verify_password", "create_access_token", "decode_token",
    "CurrentUser", "get_current_user", "require_role", "get_db",
]
