"""①用户/权限服务 单元/接口测试（正常流/边界/异常/权限）。"""
from __future__ import annotations


def test_register_login_me(client):
    # 正常流：注册 → 登录 → 取当前用户
    r = client.post("/api/v1/auth/register", json={
        "phone": "13900000002", "password": "pw123456", "gender": "female",
    })
    assert r.json()["code"] == 0

    r = client.post("/api/v1/auth/login", json={"phone": "13900000002", "password": "pw123456"})
    body = r.json()
    assert body["code"] == 0
    token = body["data"]["token"]

    r = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    data = r.json()["data"]
    assert data["phone"] == "13900000002"
    assert data["addressing"] == "姐"          # 女性自动预设称呼
    assert data["trial"]["is_trial"] is True    # 注册即开通7天试用
    assert data["contribution"]["level"] == "青铜"


def test_login_wrong_password(client):
    # 异常：密码错误 → 30001
    client.post("/api/v1/auth/register", json={"phone": "13900000003", "password": "pw123456"})
    r = client.post("/api/v1/auth/login", json={"phone": "13900000003", "password": "wrong"})
    assert r.json()["code"] == 30001


def test_me_requires_auth(client):
    # 权限：未登录 → 10001
    r = client.get("/api/v1/users/me")
    assert r.json()["code"] == 10001


def test_update_profile_and_care_mode(auth, client):
    headers, _ = auth
    r = client.patch("/api/v1/users/me/profile",
                     json={"voice_type": "知性", "care_mode": "passive"}, headers=headers)
    assert r.json()["data"]["voice_type"] == "知性"

    # 边界：非法音色 → 20002
    r = client.patch("/api/v1/users/me/profile", json={"voice_type": "机械音"}, headers=headers)
    assert r.json()["code"] == 20002

    r = client.patch("/api/v1/users/me/care-mode", json={"care_mode": "active"}, headers=headers)
    assert r.json()["data"]["care_mode"] == "active"


def test_disclaimer_and_quota(auth, client):
    headers, _ = auth
    r = client.post("/api/v1/users/me/disclaimers",
                    json={"disclaimer_type": "在职风险免责"}, headers=headers)
    assert r.json()["data"]["disclaimer_type"] == "在职风险免责"

    r = client.get("/api/v1/users/me/quota", headers=headers)
    assert r.json()["code"] == 0


def test_grant_teacher_without_nda_rejected(auth, client):
    # 边界：未签 NDA 授予老师只读 → 30020
    headers, _ = auth
    r = client.post("/api/v1/users/me/grants",
                    json={"grantee_teacher_id": "ffffffffffffffffffffffffffffffff",
                          "scope": "teacher_kb_read", "nda_signed": False}, headers=headers)
    assert r.json()["code"] == 30020


def test_teacher_assignment_requires_operator(auth, client):
    # 权限：学员调用运营后台接口 → 10010
    headers, _ = auth
    r = client.post("/api/v1/admin/teacher-assignments",
                    json={"teacher_id": "a" * 32, "student_id": "b" * 32}, headers=headers)
    assert r.json()["code"] == 10010
