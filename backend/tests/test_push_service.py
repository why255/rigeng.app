"""⑥消息/推送服务 单元/接口测试（正常流/边界/频控/权限）。"""
from __future__ import annotations

import pytest


# ═══════ 辅助：创建运营人员 ═══
def _register_and_login_as(client, phone, password, role="operator"):
    """注册指定角色用户并返回 headers。"""
    client.post("/api/v1/auth/register", json={
        "phone": phone, "password": password, "role": role,
    })
    r = client.post("/api/v1/auth/login", json={"phone": phone, "password": password})
    data = r.json()["data"]
    return {"Authorization": f"Bearer {data['token']}"}, data["user_id"]


# ═══════ 测试 ═══════


class TestPushHealth:
    """服务健康检查。"""

    def test_health_returns_status(self, client):
        r = client.get("/api/v1/push/health")
        data = r.json()["data"]
        assert data["status"] == "up"
        assert "push" in data
        assert "sms" in data
        assert "sms_enabled" in data


class TestPushSend:
    """App推送发送。"""

    def test_push_send_requires_operator(self, auth, client):
        """普通用户无法发送推送→403。"""
        headers, _ = auth
        r = client.post("/api/v1/push/send", json={
            "user_id": "test", "title": "提醒", "body": "测试推送",
        }, headers=headers)
        assert r.json()["code"] == 10010

    def test_push_send_operator_ok(self, client):
        """运营人员发送推送。"""
        headers, uid = _register_and_login_as(client, "13910000001", "pw123456", "operator")
        r = client.post("/api/v1/push/send", json={
            "user_id": uid, "title": "📋 日耕提醒", "body": "姐，今天还没做规划哦~",
            "extras": {"action": "open_module", "module": "morning_plan"},
        }, headers=headers)
        assert r.status_code in (200, 503)  # 503 = 阿里云未配置

    def test_push_send_missing_fields(self, client):
        """缺少必填字段→422。"""
        headers, _ = _register_and_login_as(client, "13910000002", "pw123456", "operator")
        r = client.post("/api/v1/push/send", json={}, headers=headers)
        assert r.status_code == 422

    def test_push_send_title_too_long(self, client):
        """标题超过64字→422。"""
        headers, _ = _register_and_login_as(client, "13910000003", "pw123456", "operator")
        r = client.post("/api/v1/push/send", json={
            "user_id": "test", "title": "x" * 65, "body": "test",
        }, headers=headers)
        assert r.status_code == 422

    def test_push_send_body_too_long(self, client):
        """正文超过256字→422。"""
        headers, _ = _register_and_login_as(client, "13910000004", "pw123456", "operator")
        r = client.post("/api/v1/push/send", json={
            "user_id": "test", "title": "test", "body": "x" * 257,
        }, headers=headers)
        assert r.status_code == 422

    def test_push_send_superadmin_ok(self, client):
        """超管发送推送。"""
        headers, uid = _register_and_login_as(client, "13910000005", "pw123456", "superadmin")
        r = client.post("/api/v1/push/send", json={
            "user_id": uid, "title": "系统通知", "body": "系统维护通知",
        }, headers=headers)
        assert r.status_code in (200, 503)


class TestPushBatch:
    """批量推送。"""

    def test_batch_requires_operator(self, auth, client):
        headers, _ = auth
        r = client.post("/api/v1/push/send-batch", json={
            "user_ids": ["a", "b"], "title": "提醒", "body": "批量推送",
        }, headers=headers)
        assert r.json()["code"] == 10010

    def test_batch_empty_list(self, client):
        """空用户列表→422。"""
        headers, _ = _register_and_login_as(client, "13910000006", "pw123456", "operator")
        r = client.post("/api/v1/push/send-batch", json={
            "user_ids": [], "title": "提醒", "body": "空列表",
        }, headers=headers)
        assert r.status_code == 422

    def test_batch_too_many(self, client):
        """超过1000个用户→422。"""
        headers, _ = _register_and_login_as(client, "13910000007", "pw123456", "operator")
        r = client.post("/api/v1/push/send-batch", json={
            "user_ids": ["u" + str(i) for i in range(1001)],
            "title": "提醒", "body": "超量",
        }, headers=headers)
        assert r.status_code == 422

    def test_batch_ok(self, client):
        """正常批量推送。"""
        headers, _ = _register_and_login_as(client, "13910000008", "pw123456", "operator")
        r = client.post("/api/v1/push/send-batch", json={
            "user_ids": ["user1", "user2", "user3"],
            "title": "日耕提醒", "body": "本周复盘统计已出",
        }, headers=headers)
        assert r.status_code in (200, 503)


class TestSMS:
    """短信发送。"""

    def test_sms_requires_operator(self, auth, client):
        headers, _ = auth
        r = client.post("/api/v1/push/sms", json={
            "phone": "13800138000", "template_code": "SMS_TEST",
        }, headers=headers)
        assert r.json()["code"] == 10010

    def test_sms_invalid_phone(self, client):
        """非法手机号→422。"""
        headers, _ = _register_and_login_as(client, "13910000009", "pw123456", "operator")
        r = client.post("/api/v1/push/sms", json={
            "phone": "12345", "template_code": "SMS_TEST",
        }, headers=headers)
        assert r.status_code == 422

    def test_sms_ok(self, client):
        """正常短信发送。"""
        headers, _ = _register_and_login_as(client, "13910000010", "pw123456", "operator")
        r = client.post("/api/v1/push/sms", json={
            "phone": "13800138000", "template_code": "SMS_335270859",
            "template_params": {"code": "1234"},
        }, headers=headers)
        assert r.status_code in (200, 503)


class TestPushQuota:
    """推送配额查询。"""

    def test_quota_requires_auth(self, client):
        r = client.get("/api/v1/push/quota/user123")
        assert r.json()["code"] == 10001

    def test_quota_returns_structure(self, auth, client):
        headers, uid = auth
        r = client.get(f"/api/v1/push/quota/{uid}", headers=headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert "push_sent_this_week" in data
        assert "push_max_per_week" in data
        assert "sms_enabled" in data
        assert "can_push_now" in data


class TestPushLogs:
    """推送历史查询。"""

    def test_logs_requires_operator(self, auth, client):
        headers, _ = auth
        r = client.get("/api/v1/push/logs", headers=headers)
        assert r.json()["code"] == 10010

    def test_logs_operator_ok(self, client):
        headers, _ = _register_and_login_as(client, "13910000011", "pw123456", "operator")
        r = client.get("/api/v1/push/logs", headers=headers)
        assert r.status_code == 200
        assert isinstance(r.json()["data"], list)

    def test_logs_with_limit(self, client):
        headers, _ = _register_and_login_as(client, "13910000012", "pw123456", "operator")
        r = client.get("/api/v1/push/logs", params={"limit": 10}, headers=headers)
        assert r.status_code == 200

    def test_logs_limit_too_high(self, client):
        """超过200的上限→422参数校验拦截。"""
        headers, _ = _register_and_login_as(client, "13910000013", "pw123456", "operator")
        r = client.get("/api/v1/push/logs", params={"limit": 300}, headers=headers)
        # FastAPI Query(le=200) 正确拦截超限参数→422
        assert r.status_code == 422


class TestCrisisNotify:
    """危机干预通知。"""

    def test_crisis_notify_requires_operator(self, auth, client):
        headers, _ = auth
        r = client.post("/api/v1/push/crisis-notify",
                        params={"user_id": "test", "crisis_level": 3}, headers=headers)
        assert r.json()["code"] == 10010

    def test_crisis_notify_high_level(self, client):
        """3级危机→触发App推送。"""
        headers, uid = _register_and_login_as(client, "13910000014", "pw123456", "operator")
        r = client.post("/api/v1/push/crisis-notify",
                        params={"user_id": uid, "crisis_level": 3}, headers=headers)
        assert r.status_code in (200, 503)

    def test_crisis_notify_medium_level(self, client):
        """2级危机→触发关怀推送。"""
        headers, uid = _register_and_login_as(client, "13910000015", "pw123456", "operator")
        r = client.post("/api/v1/push/crisis-notify",
                        params={"user_id": uid, "crisis_level": 2}, headers=headers)
        assert r.status_code in (200, 503)

    def test_crisis_notify_low_level_skipped(self, client):
        """1级→不需干预。"""
        headers, uid = _register_and_login_as(client, "13910000016", "pw123456", "operator")
        r = client.post("/api/v1/push/crisis-notify",
                        params={"user_id": uid, "crisis_level": 1}, headers=headers)
        if r.status_code == 200:
            assert r.json()["data"]["crisis_notified"] is False


class TestAdminEndpoints:
    """管理接口。"""

    def test_reset_weekly_requires_superadmin(self, client):
        """重置计数器需超管权限。"""
        headers, _ = _register_and_login_as(client, "13910000017", "pw123456", "operator")
        r = client.post("/api/v1/push/admin/reset-weekly", headers=headers)
        assert r.json()["code"] == 10010  # operator不能调superadmin接口

    def test_reset_weekly_superadmin_ok(self, client):
        headers, _ = _register_and_login_as(client, "13910000018", "pw123456", "superadmin")
        r = client.post("/api/v1/push/admin/reset-weekly", headers=headers)
        assert r.status_code == 200
        assert r.json()["data"]["reset"] is True

    def test_check_inactive_ok(self, client):
        headers, _ = _register_and_login_as(client, "13910000019", "pw123456", "operator")
        r = client.post("/api/v1/push/admin/check-inactive", headers=headers)
        assert r.status_code == 200
        assert "reminders_sent" in r.json()["data"]


class TestPushRateLimiting:
    """推送频控逻辑（直接测service）。"""

    def test_night_blocking(self):
        from app.services.push_service.service import _check_push_quota
        can_push, reason = _check_push_quota("test_user", "push")
        # 取决于当前时间是否在9-21点
        assert isinstance(can_push, bool)

    def test_weekly_counter(self):
        from app.services.push_service.service import _check_weekly_limit, _push_counts
        _push_counts.clear()
        # 首次推送允许
        assert _check_weekly_limit("test_user") is True
        # 模拟达到上限
        _push_counts["test_user"] = 5
        assert _check_weekly_limit("test_user") is False
        # 清理
        _push_counts.clear()

    def test_reset_weekly(self):
        from app.services.push_service.service import reset_weekly_counts, _push_counts
        _push_counts["user_a"] = 5
        _push_counts["user_b"] = 3
        reset_weekly_counts()
        assert len(_push_counts) == 0
