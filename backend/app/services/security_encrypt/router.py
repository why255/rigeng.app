"""⑧安全/加密服务 — 路由层。"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...shared.database import get_db
from ...shared.response import ok
from ...shared.security import CurrentUser, get_current_user
from . import service
from .schemas import (
    CrisisLogRequest,
    DecryptRequest,
    DesensitizeRequest,
    EncryptRequest,
    PolicyCheckRequest,
)

router = APIRouter(prefix="/security", tags=["⑧安全/加密"])


@router.post("/desensitize")
def desensitize(
    body: DesensitizeRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """PII 脱敏：替换手机号、身份证号、邮箱等敏感信息。"""
    return ok(service.desensitize_text(db, body.text, body.doc_type))


@router.post("/encrypt-local")
def encrypt(
    body: EncryptRequest,
    user: CurrentUser = Depends(get_current_user),
):
    """端侧本地加密：AES-256-GCM 加密，返回 base64 编码的密文。"""
    return ok(service.encrypt_local(body.plaintext))


@router.post("/decrypt-local")
def decrypt(
    body: DecryptRequest,
    user: CurrentUser = Depends(get_current_user),
):
    """端侧本地解密：验证 auth tag 后解密。"""
    return ok(service.decrypt_local(
        body.ciphertext_b64, body.tag_b64, body.nonce_b64, body.algo_version,
    ))


@router.get("/policy/check")
def check_policy(
    text: str,
    doc_type: str | None = None,
    category: str | None = None,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """内容合规检查：对照 content_policy_rule 表匹配关键词。"""
    return ok(service.check_content_policy(db, text, doc_type, category))


@router.post("/crisis/log")
def log_crisis(
    body: CrisisLogRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """记录危机干预事件（user_id 哈希后存储）。"""
    return ok(service.log_crisis_event(
        db, user.user_id, body.crisis_type, body.intervention_result,
    ))


@router.get("/rules")
def get_rules(
    category: str | None = None,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """查询当前生效的内容审核规则。"""
    return ok(service.get_active_policy_rules(db, category))
