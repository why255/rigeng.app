"""⑧安全/加密服务 — 请求/响应模型。"""
from __future__ import annotations

from pydantic import BaseModel, Field


class DesensitizeRequest(BaseModel):
    """脱敏请求。"""
    text: str = Field(min_length=1, max_length=50000)
    doc_type: str | None = None


class DesensitizeResponse(BaseModel):
    """脱敏响应。"""
    original_length: int
    desensitized_text: str
    items_removed: int
    details: list[dict] = []  # [{type: "phone", matched: "138****0000"}]


class EncryptRequest(BaseModel):
    """端侧加密请求。"""
    plaintext: str = Field(min_length=1, max_length=100000)


class EncryptResponse(BaseModel):
    """端侧加密响应（返回 base64 编码的密文 + 认证标签）。"""
    ciphertext_b64: str
    tag_b64: str
    nonce_b64: str
    algo_version: str = "v1"


class DecryptRequest(BaseModel):
    """端侧解密请求。"""
    ciphertext_b64: str
    tag_b64: str
    nonce_b64: str
    algo_version: str | None = "v1"


class DecryptResponse(BaseModel):
    """端侧解密响应。"""
    plaintext: str


class PolicyCheckRequest(BaseModel):
    """内容合规检查请求。"""
    text: str = Field(min_length=1, max_length=50000)
    doc_type: str | None = None
    category: str | None = None  # 可选：限定检查某类规则


class PolicyCheckResponse(BaseModel):
    """内容合规检查响应。"""
    action: str = "allow"  # allow / block / warn / desensitize
    matched_rules: list[dict] = []  # [{rule_type, keyword, priority, action}]
    is_blocked: bool = False


class CrisisLogRequest(BaseModel):
    """危机事件记录请求。"""
    crisis_type: str = Field(..., max_length=32)
    intervention_result: str | None = None
