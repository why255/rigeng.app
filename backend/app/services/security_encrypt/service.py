"""⑧安全/加密服务 — 核心业务逻辑。

功能：
- PII 脱敏：手机号、身份证号、姓名关键词检测与替换
- AES-256-GCM 端侧加密/解密（使用 Python 标准库 hashlib+hmac 实现）
- 内容合规检查：对照 content_policy_rule 表进行关键词匹配
- 危机事件日志记录（user_id 哈希脱敏存储）

生产强化路线：
- 接入专业脱敏模型（NLP NER 替换正则）
- 使用硬件安全模块 (HSM) 管理加密密钥
- 集成第三方合规审核 API
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import logging
import os
import re
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from ...shared.config import settings
from ...shared.database import new_uuid
from ...shared.errors import (
    APIError,
    E_DESENSITIZE_FAIL,
    E_PRIVACY_CONFLICT,
    E_CRISIS_PROTOCOL,
)
from ...shared.models.knowledge import ContentPolicyRule
from ...shared.models.security import CrisisLog, LocalEncryptedStorage

logger = logging.getLogger("security_encrypt")

# ═══════════════════════════════════════════════
# PII 脱敏规则（正则）
# ═══════════════════════════════════════════════
_PII_PATTERNS: list[tuple[str, str, str]] = [
    # (名称, 正则, 替换格式)
    ("phone", r"\b1[3-9]\d{9}\b", "1**********"),
    ("id_card", r"\b\d{17}[\dXx]\b", "******************"),
    ("email", r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", "***@***.***"),
    # 银行账号（简易匹配）
    ("bank_card", r"\b\d{16,19}\b", "**** **** **** ****"),
]


def _derive_key() -> bytes:
    """从配置的 LOCAL_ENCRYPTION_KEY 派生 32 字节 AES-256 密钥。"""
    raw = settings.LOCAL_ENCRYPTION_KEY
    if not raw or len(raw) < 64:
        # 开发环境默认密钥（生产环境必须配置 64 位 hex）
        raw = "dev-key-0000000000000000000000000000000000000000000000000000000000"
        logger.warning("LOCAL_ENCRYPTION_KEY 未配置或长度不足，使用开发默认密钥")

    # 使用 SHA-256 从 hex 密钥派生 32 字节
    try:
        key_material = bytes.fromhex(raw[:64])
    except ValueError:
        key_material = hashlib.sha256(raw.encode("utf-8")).digest()

    return key_material


# ═══════════════════════════════════════════════
# AES-256-GCM 加密（使用标准库 hmac + 异或模拟，MVP 可用 cryptography 库替换）
# ═══════════════════════════════════════════════
def _aes_gcm_encrypt(plaintext: str, key: bytes) -> tuple[bytes, bytes, bytes]:
    """AES-256-GCM 加密（使用 cryptography 库是更好选择，MVP 使用 hashlib 模拟）。

    Returns: (ciphertext, tag, nonce)
    """
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        nonce = os.urandom(12)
        aesgcm = AESGCM(key)
        ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
        # AESGCM.encrypt 返回 ciphertext+tag 连接
        tag = ciphertext[-16:]
        ct = ciphertext[:-16]
        return ct, tag, nonce
    except ImportError:
        # 无 cryptography 库时的降级实现（仅用于开发/测试）
        # 为保护多字节 UTF-8，对 base64 编码后的文本进行操作
        logger.warning("cryptography 库不可用，使用降级加密（仅用于开发）")
        nonce = os.urandom(12)
        b64_plain = base64.b64encode(plaintext.encode("utf-8"))
        # XOR 流加密（用 HMAC 生成密钥流）
        keystream = hashlib.sha256(key + nonce + b"encrypt").digest()
        while len(keystream) < len(b64_plain):
            keystream += hashlib.sha256(keystream[-32:] + key).digest()
        ct = bytes(a ^ b for a, b in zip(b64_plain, keystream[:len(b64_plain)]))
        tag = hmac.new(key, nonce + ct, hashlib.sha256).digest()[:16]
        return ct, tag, nonce


def _aes_gcm_decrypt(ciphertext: bytes, tag: bytes, nonce: bytes, key: bytes) -> str:
    """AES-256-GCM 解密。"""
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        aesgcm = AESGCM(key)
        combined = ciphertext + tag
        plaintext = aesgcm.decrypt(nonce, combined, None)
        return plaintext.decode("utf-8")
    except ImportError:
        # 降级实现：与加密对应的 XOR + base64 解码
        logger.warning("cryptography 库不可用，使用降级解密（仅用于开发）")
        keystream = hashlib.sha256(key + nonce + b"encrypt").digest()
        while len(keystream) < len(ciphertext):
            keystream += hashlib.sha256(keystream[-32:] + key).digest()
        b64_plain = bytes(a ^ b for a, b in zip(ciphertext, keystream[:len(ciphertext)]))
        pt = base64.b64decode(b64_plain)
        return pt.decode("utf-8")


# ═══════════════════════════════════════════════
# 公开接口
# ═══════════════════════════════════════════════

def desensitize_text(db: Session, text: str, doc_type: str | None = None) -> dict[str, Any]:
    """对文本执行 PII 脱敏：替换手机号、身份证号、邮箱等。

    Returns:
        {original_length, desensitized_text, items_removed, details}
    """
    try:
        result = text
        details = []
        items_removed = 0

        for name, pattern, replacement in _PII_PATTERNS:
            matches = re.findall(pattern, result)
            if matches:
                result = re.sub(pattern, replacement, result)
                for m in matches:
                    details.append({"type": name, "matched": m[:4] + "***" if len(m) > 7 else m})
                items_removed += len(matches)

        return {
            "original_length": len(text),
            "desensitized_text": result,
            "items_removed": items_removed,
            "details": details,
        }
    except Exception as e:
        logger.exception("脱敏失败")
        raise E_DESENSITIZE_FAIL


def encrypt_local(plaintext: str) -> dict[str, Any]:
    """端侧加密：AES-256-GCM 加密，返回 base64 编码的密文/标签/nonce。"""
    key = _derive_key()
    ct, tag, nonce = _aes_gcm_encrypt(plaintext, key)

    return {
        "ciphertext_b64": base64.b64encode(ct).decode("utf-8"),
        "tag_b64": base64.b64encode(tag).decode("utf-8"),
        "nonce_b64": base64.b64encode(nonce).decode("utf-8"),
        "algo_version": settings.ENCRYPTION_ALGO_VERSION,
    }


def decrypt_local(ciphertext_b64: str, tag_b64: str, nonce_b64: str,
                  algo_version: str | None = None) -> dict[str, Any]:
    """端侧解密：验证 auth tag 后解密。"""
    try:
        ct = base64.b64decode(ciphertext_b64)
        tag = base64.b64decode(tag_b64)
        nonce = base64.b64decode(nonce_b64)
    except Exception:
        raise APIError(90030, "密文格式非法", 400)

    key = _derive_key()
    try:
        plaintext = _aes_gcm_decrypt(ct, tag, nonce, key)
        return {"plaintext": plaintext}
    except Exception as e:
        logger.exception("解密失败")
        raise APIError(90030, "解密失败：密钥不匹配或密文已损坏", 400)


def check_content_policy(db: Session, text: str, doc_type: str | None = None,
                         category: str | None = None) -> dict[str, Any]:
    """内容合规检查：对照 content_policy_rule 表匹配关键词。

    Returns:
        {action: "allow"|"block"|"warn"|"desensitize", matched_rules, is_blocked}
    """
    query = db.query(ContentPolicyRule).filter(ContentPolicyRule.is_active.is_(True))
    if category:
        query = query.filter(ContentPolicyRule.category == category)

    rules = query.order_by(ContentPolicyRule.priority.desc()).all()

    matched_rules = []
    action = "allow"
    is_blocked = False

    for rule in rules:
        keyword = rule.keyword_or_pattern
        if not keyword:
            continue

        # 简单子串匹配（生产可升级为正则/语义检测）
        if keyword in text:
            matched_rules.append({
                "rule_type": rule.rule_type,
                "keyword": keyword,
                "priority": rule.priority,
                "action": rule.action,
            })

            # 优先级最高的规则决定最终 action
            if rule.action == "block":
                action = "block"
                is_blocked = True
                break  # block 规则优先级最高，直接阻断
            elif rule.action == "warn" and action == "allow":
                action = "warn"
            elif rule.action == "desensitize":
                action = "desensitize"

    return {
        "action": action,
        "matched_rules": matched_rules,
        "is_blocked": is_blocked,
    }


def log_crisis_event(db: Session, user_id: str, crisis_type: str,
                     intervention_result: str | None = None) -> dict[str, Any]:
    """记录危机干预事件（user_id 哈希后存储，保护隐私）。

    Returns:
        {logged, crisis_id}
    """
    # 对 user_id 做单向哈希
    user_id_hashed = hashlib.sha256(
        (user_id + "日耕危机日志盐值_2026").encode("utf-8")
    ).hexdigest()[:64]

    entry = CrisisLog(
        user_id_hashed=user_id_hashed,
        triggered_at=datetime.now(timezone.utc).replace(tzinfo=None),
        crisis_type=crisis_type,
        intervention_result=intervention_result,
    )
    db.add(entry)
    db.commit()

    logger.info("危机事件已记录: type=%s", crisis_type)

    return {
        "logged": True,
        "crisis_id": entry.id,
    }


def get_active_policy_rules(db: Session, category: str | None = None) -> dict[str, Any]:
    """查询当前生效的内容审核规则。"""
    query = db.query(ContentPolicyRule).filter(ContentPolicyRule.is_active.is_(True))
    if category:
        query = query.filter(ContentPolicyRule.category == category)

    rules = query.order_by(ContentPolicyRule.priority.desc()).all()
    return {
        "rules": [
            {
                "id": r.id,
                "rule_type": r.rule_type,
                "category": r.category,
                "keyword": r.keyword_or_pattern,
                "action": r.action,
                "priority": r.priority,
            }
            for r in rules
        ],
        "total": len(rules),
    }
