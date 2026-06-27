"""⑧安全/加密服务 单元/接口测试。"""
from __future__ import annotations


def test_desensitize_phone(auth, client):
    """脱敏：手机号 → 替换为 1**********。"""
    headers, _ = auth
    r = client.post("/api/v1/security/desensitize", json={
        "text": "请联系我：13812345678，或者拨打 13987654321",
    }, headers=headers)
    assert r.json()["code"] == 0
    data = r.json()["data"]
    assert "13812345678" not in data["desensitized_text"]
    assert "1**********" in data["desensitized_text"]
    assert data["items_removed"] >= 2


def test_desensitize_id_card(auth, client):
    """脱敏：身份证号 → 替换。"""
    headers, _ = auth
    r = client.post("/api/v1/security/desensitize", json={
        "text": "身份证号：110101199001011234，请核实",
    }, headers=headers)
    assert r.json()["code"] == 0
    data = r.json()["data"]
    assert "110101199001011234" not in data["desensitized_text"]
    assert "****" in data["desensitized_text"]


def test_desensitize_no_pii(auth, client):
    """脱敏：无敏感信息的文本原样返回。"""
    headers, _ = auth
    original = "这是一段普通的HR工作记录，没有任何敏感信息。"
    r = client.post("/api/v1/security/desensitize", json={"text": original}, headers=headers)
    assert r.json()["code"] == 0
    data = r.json()["data"]
    assert data["desensitized_text"] == original
    assert data["items_removed"] == 0


def test_encrypt_decrypt_roundtrip(auth, client):
    """加密 → 解密：端到端往返。"""
    headers, _ = auth
    plaintext = "这是一段需要端侧加密保存的敏感情绪内容"

    r = client.post("/api/v1/security/encrypt-local", json={
        "plaintext": plaintext,
    }, headers=headers)
    assert r.json()["code"] == 0
    enc = r.json()["data"]

    r = client.post("/api/v1/security/decrypt-local", json={
        "ciphertext_b64": enc["ciphertext_b64"],
        "tag_b64": enc["tag_b64"],
        "nonce_b64": enc["nonce_b64"],
    }, headers=headers)
    assert r.json()["code"] == 0
    assert r.json()["data"]["plaintext"] == plaintext


def test_decrypt_invalid_ciphertext(auth, client):
    """解密：非法密文 → 90030。"""
    headers, _ = auth
    r = client.post("/api/v1/security/decrypt-local", json={
        "ciphertext_b64": "invalid!!!",
        "tag_b64": "dGFn",
        "nonce_b64": "bm9uY2U=",
    }, headers=headers)
    assert r.json()["code"] == 90030


def test_policy_check_no_match(auth, client):
    """内容审核：普通文本 → allow。"""
    headers, _ = auth
    r = client.get("/api/v1/security/policy/check?text=正常的工作记录内容", headers=headers)
    assert r.json()["code"] == 0
    data = r.json()["data"]
    assert data["action"] == "allow"
    assert data["is_blocked"] is False


def test_crisis_log(auth, client):
    """危机事件记录：创建成功。"""
    headers, _ = auth
    r = client.post("/api/v1/security/crisis/log", json={
        "crisis_type": "suicide_risk",
        "intervention_result": "已推送心理援助热线",
    }, headers=headers)
    assert r.json()["code"] == 0
    data = r.json()["data"]
    assert data["logged"] is True
    assert data["crisis_id"]


def test_get_rules(auth, client):
    """查询内容审核规则：返回规则列表。"""
    headers, _ = auth
    r = client.get("/api/v1/security/rules", headers=headers)
    assert r.json()["code"] == 0
    assert "rules" in r.json()["data"]


def test_unauthorized_access(client):
    """权限：未登录 → 10001。"""
    r = client.get("/api/v1/security/rules")
    assert r.json()["code"] == 10001
