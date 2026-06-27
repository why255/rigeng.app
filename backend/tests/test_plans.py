"""朝有规划 · Plans 服务测试套件（步骤10 - 业务层测试）。

覆盖：计划 CRUD / 任务管理 / 四象限移动 / 统计计算 /
      离线同步 / 昨日未完成 / 智能记录同步 / 枚举校验 /
      用户隔离 / 边界条件。
"""
from __future__ import annotations

import pytest


# ═══════════════════════════════════════════════════════════
# 计划 CRUD
# ═══════════════════════════════════════════════════════════

class TestPlanCreate:
    """POST /plans — 创建计划"""

    def test_create_plan_success(self, client, auth):
        headers, _ = auth
        r = client.post("/api/v1/plans", json={
            "title": "今日计划",
            "tasks": [
                {"title": "回复客户邮件", "quadrant": "urgent_important"},
                {"title": "整理项目方案", "quadrant": "not_urgent_important"},
                {"title": "学习新框架", "quadrant": "not_urgent_important", "source": "user_input"},
            ],
        }, headers=headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["title"] == "今日计划"
        assert data["status"] == "active"
        assert len(data["tasks"]) == 3
        assert data["tasks"][0]["sort_order"] == 0
        assert data["tasks"][1]["sort_order"] == 1
        assert data["tasks"][2]["sort_order"] == 2
        assert data["stats"]["total_tasks"] == 3
        assert data["stats"]["completed_tasks"] == 0
        assert data["stats"]["completion_rate"] == 0

    def test_create_plan_empty_tasks(self, client, auth):
        """允许创建空任务计划。"""
        headers, _ = auth
        r = client.post("/api/v1/plans", json={
            "title": "今日计划",
            "tasks": [],
        }, headers=headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["stats"]["total_tasks"] == 0
        assert data["stats"]["completion_rate"] == 0

    def test_create_plan_default_title(self, client, auth):
        """title 有默认值。"""
        headers, _ = auth
        r = client.post("/api/v1/plans", json={
            "tasks": [{"title": "测试任务"}],
        }, headers=headers)
        assert r.status_code == 200
        assert r.json()["data"]["title"] == "今日计划"

    def test_create_plan_one_per_day(self, client, auth):
        """同一天不能创建两个活跃计划。"""
        headers, _ = auth
        # 创建一个
        r1 = client.post("/api/v1/plans", json={
            "title": "计划A", "tasks": [{"title": "任务1"}],
        }, headers=headers)
        assert r1.status_code == 200
        # 再创建——应冲突
        r2 = client.post("/api/v1/plans", json={
            "title": "计划B", "tasks": [{"title": "任务2"}],
        }, headers=headers)
        assert r2.status_code == 409

    def test_create_plan_after_archive(self, client, auth):
        """归档后允许创建新计划。"""
        headers, _ = auth
        r1 = client.post("/api/v1/plans", json={
            "title": "计划A", "tasks": [{"title": "任务1"}],
        }, headers=headers)
        plan_id = r1.json()["data"]["id"]
        # 归档
        client.post(f"/api/v1/plans/{plan_id}/archive", headers=headers)
        # 再创建——应成功
        r2 = client.post("/api/v1/plans", json={
            "title": "计划B", "tasks": [{"title": "任务2"}],
        }, headers=headers)
        assert r2.status_code == 200

    def test_create_plan_with_description_and_time(self, client, auth):
        """任务带描述和时间估算。"""
        headers, _ = auth
        r = client.post("/api/v1/plans", json={
            "tasks": [{
                "title": "项目汇报",
                "description": "准备Q2项目进展汇报PPT",
                "time_estimate": "9:00-10:30",
            }],
        }, headers=headers)
        assert r.status_code == 200
        task = r.json()["data"]["tasks"][0]
        assert task["description"] == "准备Q2项目进展汇报PPT"
        assert task["time_estimate"] == "9:00-10:30"

    def test_create_plan_invalid_quadrant(self, client, auth):
        """非法象限值应被拦截。"""
        headers, _ = auth
        r = client.post("/api/v1/plans", json={
            "tasks": [{"title": "测试", "quadrant": "invalid_quadrant"}],
        }, headers=headers)
        assert r.status_code == 400
        assert "quadrant" in r.json()["message"].lower() or "非法" in r.json()["message"]

    def test_create_plan_requires_auth(self, client):
        """未登录不能创建计划。"""
        r = client.post("/api/v1/plans", json={"tasks": []})
        assert r.status_code == 401


class TestPlanRead:
    """GET /plans/today /plans/stats /plans/{id}"""

    def test_get_today_empty(self, client, auth):
        """无计划时 today 返回 null。"""
        headers, _ = auth
        r = client.get("/api/v1/plans/today", headers=headers)
        assert r.status_code == 200
        assert r.json()["data"] is None

    def test_get_today_after_create(self, client, auth):
        """创建后能获取今日计划。"""
        headers, _ = auth
        client.post("/api/v1/plans", json={
            "tasks": [{"title": "任务A"}, {"title": "任务B"}],
        }, headers=headers)
        r = client.get("/api/v1/plans/today", headers=headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert data is not None
        assert len(data["tasks"]) == 2

    def test_get_plan_by_id(self, client, auth):
        """通过 ID 获取计划。"""
        headers, _ = auth
        created = client.post("/api/v1/plans", json={
            "tasks": [{"title": "任务"}],
        }, headers=headers)
        plan_id = created.json()["data"]["id"]
        r = client.get(f"/api/v1/plans/{plan_id}", headers=headers)
        assert r.status_code == 200
        assert r.json()["data"]["id"] == plan_id

    def test_get_plan_not_found(self, client, auth):
        """不存在的计划返回 404。"""
        headers, _ = auth
        r = client.get("/api/v1/plans/nonexistent-id", headers=headers)
        assert r.status_code == 404

    def test_get_stats_empty(self, client, auth):
        """无计划时统计返回 0。"""
        headers, _ = auth
        r = client.get("/api/v1/plans/stats", headers=headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["task_count"] == 0
        assert data["completion_rate"] == 0

    def test_get_stats_with_tasks(self, client, auth):
        """有计划时统计正确。"""
        headers, _ = auth
        client.post("/api/v1/plans", json={
            "tasks": [
                {"title": "已完成", "status": "pending"},
                {"title": "进行中", "status": "pending"},
                {"title": "待开始", "status": "pending"},
            ],
        }, headers=headers)
        r = client.get("/api/v1/plans/stats", headers=headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["task_count"] == 3
        assert data["pending_count"] == 3
        # 标记一个完成后再查
        plan_r = client.get("/api/v1/plans/today", headers=headers)
        plan = plan_r.json()["data"]
        task_id = plan["tasks"][0]["id"]
        client.patch(
            f"/api/v1/plans/{plan['id']}/tasks/{task_id}",
            json={"status": "completed"}, headers=headers,
        )
        r2 = client.get("/api/v1/plans/stats", headers=headers)
        assert r2.json()["data"]["completion_rate"] == 33  # 1/3 ≈ 33%

    def test_user_isolation(self, client, auth):
        """用户A不能访问用户B的计划。"""
        headers1, _ = auth
        # 创建用户B
        client.post("/api/v1/auth/register", json={
            "phone": "13900000002", "password": "secret123", "gender": "female",
        })
        r_login = client.post("/api/v1/auth/login", json={"phone": "13900000002", "password": "secret123"})
        headers2 = {"Authorization": f"Bearer {r_login.json()['data']['token']}"}

        # 用户A创建计划
        r = client.post("/api/v1/plans", json={
            "tasks": [{"title": "A的计划"}],
        }, headers=headers1)
        plan_id = r.json()["data"]["id"]

        # 用户B尝试访问用户A的计划
        r2 = client.get(f"/api/v1/plans/{plan_id}", headers=headers2)
        assert r2.status_code == 404  # 应该看不到


# ═══════════════════════════════════════════════════════════
# 任务管理
# ═══════════════════════════════════════════════════════════

class TestTaskUpdate:
    """PATCH /plans/{plan_id}/tasks/{task_id}"""

    def test_update_task_title(self, client, auth):
        headers, _ = auth
        r = client.post("/api/v1/plans", json={
            "tasks": [{"title": "原标题"}],
        }, headers=headers)
        plan_id = r.json()["data"]["id"]
        task_id = r.json()["data"]["tasks"][0]["id"]

        r2 = client.patch(
            f"/api/v1/plans/{plan_id}/tasks/{task_id}",
            json={"title": "新标题"}, headers=headers,
        )
        assert r2.status_code == 200
        assert r2.json()["data"]["title"] == "新标题"

    def test_update_task_status_toggle(self, client, auth):
        """标记任务完成/未完成。"""
        headers, _ = auth
        r = client.post("/api/v1/plans", json={
            "tasks": [{"title": "测试任务"}],
        }, headers=headers)
        plan_id = r.json()["data"]["id"]
        task_id = r.json()["data"]["tasks"][0]["id"]

        # 标记完成
        r2 = client.patch(
            f"/api/v1/plans/{plan_id}/tasks/{task_id}",
            json={"status": "completed"}, headers=headers,
        )
        assert r2.json()["data"]["status"] == "completed"

        # 标记回 pending
        r3 = client.patch(
            f"/api/v1/plans/{plan_id}/tasks/{task_id}",
            json={"status": "pending"}, headers=headers,
        )
        assert r3.json()["data"]["status"] == "pending"

    def test_update_task_statis_updates_plan_stats(self, client, auth):
        """更新任务状态后，计划统计应自动更新。"""
        headers, _ = auth
        r = client.post("/api/v1/plans", json={
            "tasks": [{"title": "T1"}, {"title": "T2"}, {"title": "T3"}],
        }, headers=headers)
        plan_id = r.json()["data"]["id"]
        task_id = r.json()["data"]["tasks"][0]["id"]

        # 完成第一个
        client.patch(
            f"/api/v1/plans/{plan_id}/tasks/{task_id}",
            json={"status": "completed"}, headers=headers,
        )
        # 检查统计（stats 只返回 task_count, completion_rate, pending_count）
        stats_r = client.get("/api/v1/plans/stats", headers=headers)
        assert stats_r.json()["data"]["completion_rate"] == 33
        assert stats_r.json()["data"]["pending_count"] == 2

    def test_update_task_not_found(self, client, auth):
        headers, _ = auth
        r = client.post("/api/v1/plans", json={
            "tasks": [{"title": "T1"}],
        }, headers=headers)
        plan_id = r.json()["data"]["id"]
        r2 = client.patch(
            f"/api/v1/plans/{plan_id}/tasks/nonexistent",
            json={"title": "test"}, headers=headers,
        )
        assert r2.status_code == 404

    def test_update_task_invalid_status(self, client, auth):
        headers, _ = auth
        r = client.post("/api/v1/plans", json={
            "tasks": [{"title": "T1"}],
        }, headers=headers)
        plan_id = r.json()["data"]["id"]
        task_id = r.json()["data"]["tasks"][0]["id"]
        r2 = client.patch(
            f"/api/v1/plans/{plan_id}/tasks/{task_id}",
            json={"status": "deleted"}, headers=headers,  # 非法状态
        )
        assert r2.status_code == 400


class TestTaskDelete:
    """DELETE /plans/{plan_id}/tasks/{task_id}"""

    def test_delete_task_success(self, client, auth):
        """删除任务后统计应更新。"""
        headers, _ = auth
        r = client.post("/api/v1/plans", json={
            "tasks": [{"title": "T1"}, {"title": "T2"}, {"title": "T3"}],
        }, headers=headers)
        plan_id = r.json()["data"]["id"]
        task_id = r.json()["data"]["tasks"][0]["id"]

        r2 = client.delete(
            f"/api/v1/plans/{plan_id}/tasks/{task_id}",
            headers=headers,
        )
        assert r2.status_code == 200
        assert r2.json()["data"]["deleted"] is True

        # 验证统计数据更新
        stats_r = client.get("/api/v1/plans/stats", headers=headers)
        assert stats_r.json()["data"]["task_count"] == 2

    def test_delete_task_not_found(self, client, auth):
        headers, _ = auth
        r = client.post("/api/v1/plans", json={
            "tasks": [{"title": "T1"}],
        }, headers=headers)
        plan_id = r.json()["data"]["id"]
        r2 = client.delete(
            f"/api/v1/plans/{plan_id}/tasks/nonexistent",
            headers=headers,
        )
        assert r2.status_code == 404

    def test_delete_task_wrong_plan(self, client, auth):
        """不能从错误的计划中删除任务。"""
        headers, _ = auth
        # 创建两个计划（先归档第一个）
        r1 = client.post("/api/v1/plans", json={
            "tasks": [{"title": "Plan A task"}],
        }, headers=headers)
        plan_a_id = r1.json()["data"]["id"]
        task_a_id = r1.json()["data"]["tasks"][0]["id"]

        client.post(f"/api/v1/plans/{plan_a_id}/archive", headers=headers)

        r2 = client.post("/api/v1/plans", json={
            "tasks": [{"title": "Plan B task"}],
        }, headers=headers)
        plan_b_id = r2.json()["data"]["id"]

        # 用 plan_b_id 删 plan_a 的任务
        r3 = client.delete(
            f"/api/v1/plans/{plan_b_id}/tasks/{task_a_id}",
            headers=headers,
        )
        assert r3.status_code == 404


class TestTaskAdd:
    """POST /plans/{plan_id}/tasks — 向已有计划添加任务"""

    def test_add_task_to_plan(self, client, auth):
        headers, _ = auth
        r = client.post("/api/v1/plans", json={
            "tasks": [{"title": "T1"}],
        }, headers=headers)
        plan_id = r.json()["data"]["id"]

        r2 = client.post(
            f"/api/v1/plans/{plan_id}/tasks",
            json={"title": "新增任务", "quadrant": "urgent_important"},
            headers=headers,
        )
        assert r2.status_code == 200
        data = r2.json()["data"]
        assert data["title"] == "新增任务"
        assert data["quadrant"] == "urgent_important"

        # 验证任务数增加
        plan_r = client.get(f"/api/v1/plans/{plan_id}", headers=headers)
        assert len(plan_r.json()["data"]["tasks"]) == 2

    def test_add_task_updates_stats(self, client, auth):
        headers, _ = auth
        r = client.post("/api/v1/plans", json={
            "tasks": [{"title": "T1"}],
        }, headers=headers)
        plan_id = r.json()["data"]["id"]

        client.post(
            f"/api/v1/plans/{plan_id}/tasks",
            json={"title": "T2"}, headers=headers,
        )
        client.post(
            f"/api/v1/plans/{plan_id}/tasks",
            json={"title": "T3"}, headers=headers,
        )

        stats_r = client.get("/api/v1/plans/stats", headers=headers)
        assert stats_r.json()["data"]["task_count"] == 3


# ═══════════════════════════════════════════════════════════
# 四象限移动
# ═══════════════════════════════════════════════════════════

class TestQuadrantMove:
    """PATCH /plans/{plan_id}/tasks/{task_id}/quadrant"""

    def test_move_to_new_quadrant(self, client, auth):
        headers, _ = auth
        r = client.post("/api/v1/plans", json={
            "tasks": [{"title": "拖拽任务", "quadrant": "not_urgent_important"}],
        }, headers=headers)
        plan_id = r.json()["data"]["id"]
        task_id = r.json()["data"]["tasks"][0]["id"]

        r2 = client.patch(
            f"/api/v1/plans/{plan_id}/tasks/{task_id}/quadrant",
            json={"new_quadrant": "urgent_important"}, headers=headers,
        )
        assert r2.status_code == 200
        assert r2.json()["data"]["quadrant"] == "urgent_important"

    def test_move_to_all_four_quadrants(self, client, auth):
        """验证四个象限都能移动。"""
        headers, _ = auth
        r = client.post("/api/v1/plans", json={
            "tasks": [{"title": "T1"}],
        }, headers=headers)
        plan_id = r.json()["data"]["id"]
        task_id = r.json()["data"]["tasks"][0]["id"]

        for q in ["urgent_important", "not_urgent_important", "urgent_not_important", "not_urgent_not_important"]:
            r2 = client.patch(
                f"/api/v1/plans/{plan_id}/tasks/{task_id}/quadrant",
                json={"new_quadrant": q}, headers=headers,
            )
            assert r2.status_code == 200, f"Failed to move to {q}"
            assert r2.json()["data"]["quadrant"] == q

    def test_move_invalid_quadrant(self, client, auth):
        headers, _ = auth
        r = client.post("/api/v1/plans", json={
            "tasks": [{"title": "T1"}],
        }, headers=headers)
        plan_id = r.json()["data"]["id"]
        task_id = r.json()["data"]["tasks"][0]["id"]

        r2 = client.patch(
            f"/api/v1/plans/{plan_id}/tasks/{task_id}/quadrant",
            json={"new_quadrant": "nonexistent"}, headers=headers,
        )
        assert r2.status_code == 400


# ═══════════════════════════════════════════════════════════
# 计划完成与归档
# ═══════════════════════════════════════════════════════════

class TestPlanComplete:
    """POST /plans/{plan_id}/complete"""

    def test_complete_plan(self, client, auth):
        headers, _ = auth
        r = client.post("/api/v1/plans", json={
            "tasks": [{"title": "T1"}, {"title": "T2"}],
        }, headers=headers)
        plan_id = r.json()["data"]["id"]
        task_id = r.json()["data"]["tasks"][0]["id"]

        # 先完成一个任务
        client.patch(
            f"/api/v1/plans/{plan_id}/tasks/{task_id}",
            json={"status": "completed"}, headers=headers,
        )

        # 完成计划
        r2 = client.post(f"/api/v1/plans/{plan_id}/complete", headers=headers)
        assert r2.status_code == 200
        data = r2.json()["data"]
        assert data["status"] == "completed"
        assert data["stats"]["completed_tasks"] == 1
        assert data["stats"]["completion_rate"] == 50

    def test_complete_already_completed(self, client, auth):
        """已完成可以再次调用（幂等）。"""
        headers, _ = auth
        r = client.post("/api/v1/plans", json={
            "tasks": [{"title": "T1"}],
        }, headers=headers)
        plan_id = r.json()["data"]["id"]
        client.post(f"/api/v1/plans/{plan_id}/complete", headers=headers)
        r2 = client.post(f"/api/v1/plans/{plan_id}/complete", headers=headers)
        assert r2.status_code == 200


class TestPlanArchive:
    """POST /plans/{plan_id}/archive"""

    def test_archive_plan(self, client, auth):
        headers, _ = auth
        r = client.post("/api/v1/plans", json={
            "tasks": [{"title": "T1"}],
        }, headers=headers)
        plan_id = r.json()["data"]["id"]

        r2 = client.post(f"/api/v1/plans/{plan_id}/archive", headers=headers)
        assert r2.status_code == 200
        assert r2.json()["data"]["archived"] is True

        # 归档后 today 返回 null
        r3 = client.get("/api/v1/plans/today", headers=headers)
        assert r3.json()["data"] is None

    def test_archive_not_found(self, client, auth):
        headers, _ = auth
        r = client.post("/api/v1/plans/nonexistent/archive", headers=headers)
        assert r.status_code == 404


# ═══════════════════════════════════════════════════════════
# 离线同步
# ═══════════════════════════════════════════════════════════

class TestOfflineSync:
    """POST /plans/sync"""

    def test_sync_create_plan(self, client, auth):
        headers, _ = auth
        r = client.post("/api/v1/plans/sync", json={
            "items": [{
                "action": "create_plan",
                "payload": {"title": "离线计划", "tasks": [{"title": "离线任务"}]},
                "timestamp": 1700000000.0,
            }],
        }, headers=headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["synced"] == 1
        assert data["results"][0]["status"] == "ok"

        # 验证已创建 — 今天应有活跃计划
        r2 = client.get("/api/v1/plans/today", headers=headers)
        today_data = r2.json()["data"]
        assert today_data is not None
        assert today_data["title"] == "离线计划"

    def test_sync_multiple_actions(self, client, auth):
        headers, _ = auth
        # 先归档确保可以创建
        r = client.post("/api/v1/plans/sync", json={
            "items": [
                {"action": "create_plan", "payload": {"tasks": [{"title": "T1"}, {"title": "T2"}]}, "timestamp": 1},
            ],
        }, headers=headers)
        plan_id = r.json()["data"]["results"][0]["plan_id"]

        # 获取 task IDs
        plan_r = client.get(f"/api/v1/plans/{plan_id}", headers=headers)
        tasks = plan_r.json()["data"]["tasks"]
        task_id = tasks[0]["id"]

        # 同步更新 + 完成
        r2 = client.post("/api/v1/plans/sync", json={
            "items": [
                {"action": "update_task", "payload": {"plan_id": plan_id, "task_id": task_id, "status": "completed"}, "timestamp": 2},
                {"action": "complete_plan", "payload": {"plan_id": plan_id}, "timestamp": 3},
            ],
        }, headers=headers)
        assert r2.json()["data"]["synced"] == 2

    def test_sync_unknown_action(self, client, auth):
        headers, _ = auth
        r = client.post("/api/v1/plans/sync", json={
            "items": [{"action": "unknown_op", "payload": {}, "timestamp": 1}],
        }, headers=headers)
        assert r.json()["data"]["synced"] == 0
        assert r.json()["data"]["results"][0]["status"] == "skipped"

    def test_sync_duplicate_plan(self, client, auth):
        """重复创建——第二个应冲突。"""
        headers, _ = auth
        r = client.post("/api/v1/plans/sync", json={
            "items": [
                {"action": "create_plan", "payload": {"tasks": [{"title": "A"}]}, "timestamp": 1},
                {"action": "create_plan", "payload": {"tasks": [{"title": "B"}]}, "timestamp": 2},
            ],
        }, headers=headers)
        results = r.json()["data"]["results"]
        statuses = [r_["status"] for r_ in results]
        assert "ok" in statuses
        # 第二个应冲突（今天已有计划）
        assert "conflict" in statuses


# ═══════════════════════════════════════════════════════════
# 昨日未完成 & 智能记录同步
# ═══════════════════════════════════════════════════════════

class TestYesterdayUnfinished:
    """GET /plans/yesterday-unfinished"""

    def test_no_yesterday_plan(self, client, auth):
        headers, _ = auth
        r = client.get("/api/v1/plans/yesterday-unfinished", headers=headers)
        assert r.status_code == 200
        assert r.json()["data"]["tasks"] == []

    def test_promote_yesterday_task(self, client, auth):
        """将昨日未完成任务转入今日计划（通过 /promote 直接提升）。"""
        headers, _ = auth
        # 先创建今日计划
        r = client.post("/api/v1/plans", json={
            "tasks": [{"title": "今日任务"}],
        }, headers=headers)
        plan_id = r.json()["data"]["id"]

        # 用 /promote 把空列表提升（边界测试）
        r2 = client.post(
            f"/api/v1/plans/{plan_id}/promote",
            json={"task_ids": [], "source": "yesterday_unfinished"},
            headers=headers,
        )
        assert r2.status_code == 200
        assert r2.json()["data"]["promoted"] == 0

    def test_promote_yesterday_task_no_active_plan(self, client, auth):
        """没有活跃计划时 promote-from-yesterday 应报错。"""
        headers, _ = auth
        r = client.post(
            "/api/v1/plans/promote-from-yesterday",
            json={"task_ids": ["some_id"]},
            headers=headers,
        )
        assert r.status_code in (400, 404)


class TestSmartRecordSync:
    """GET /plans/smart-record-sync"""

    def test_no_smart_record_tasks(self, client, auth):
        headers, _ = auth
        r = client.get("/api/v1/plans/smart-record-sync", headers=headers)
        assert r.status_code == 200
        assert r.json()["data"]["tasks"] == []


# ═══════════════════════════════════════════════════════════
# 边界条件
# ═══════════════════════════════════════════════════════════

class TestEdgeCases:
    """边界和异常情况。"""

    def test_title_too_long(self, client, auth):
        headers, _ = auth
        r = client.post("/api/v1/plans", json={
            "tasks": [{"title": "A" * 600}],  # 超过 512 限制
        }, headers=headers)
        assert r.status_code == 422  # Pydantic validation

    def test_empty_title(self, client, auth):
        headers, _ = auth
        r = client.post("/api/v1/plans", json={
            "tasks": [{"title": ""}],
        }, headers=headers)
        assert r.status_code == 422  # min_length=1

    def test_many_tasks(self, client, auth):
        """创建大量任务不应出错。"""
        headers, _ = auth
        tasks = [{"title": f"任务{i}"} for i in range(50)]
        r = client.post("/api/v1/plans", json={"tasks": tasks}, headers=headers)
        assert r.status_code == 200
        assert r.json()["data"]["stats"]["total_tasks"] == 50

    def test_completion_rate_rounding(self, client, auth):
        """完成率四舍五入。"""
        headers, _ = auth
        r = client.post("/api/v1/plans", json={
            "tasks": [{"title": f"T{i}"} for i in range(7)],
        }, headers=headers)
        plan_id = r.json()["data"]["id"]
        tasks = r.json()["data"]["tasks"]

        # 完成 2/7 = 28.57% → 29%
        for i in range(2):
            client.patch(
                f"/api/v1/plans/{plan_id}/tasks/{tasks[i]['id']}",
                json={"status": "completed"}, headers=headers,
            )
        stats_r = client.get("/api/v1/plans/stats", headers=headers)
        assert stats_r.json()["data"]["completion_rate"] == 29

    def test_update_plan_title(self, client, auth):
        """PATCH /plans/{id} 更新计划标题。"""
        headers, _ = auth
        r = client.post("/api/v1/plans", json={
            "tasks": [{"title": "T1"}],
        }, headers=headers)
        plan_id = r.json()["data"]["id"]

        r2 = client.patch(
            f"/api/v1/plans/{plan_id}",
            json={"title": "新标题"}, headers=headers,
        )
        assert r2.status_code == 200
        assert r2.json()["data"]["title"] == "新标题"

    def test_update_task_sort_order(self, client, auth):
        """可以更新任务的排序。"""
        headers, _ = auth
        r = client.post("/api/v1/plans", json={
            "tasks": [{"title": "T1"}, {"title": "T2"}],
        }, headers=headers)
        plan_id = r.json()["data"]["id"]
        task_id = r.json()["data"]["tasks"][0]["id"]

        r2 = client.patch(
            f"/api/v1/plans/{plan_id}/tasks/{task_id}",
            json={"sort_order": 99}, headers=headers,
        )
        assert r2.status_code == 200
        assert r2.json()["data"]["sort_order"] == 99

    def test_sync_empty_items(self, client, auth):
        headers, _ = auth
        r = client.post("/api/v1/plans/sync", json={"items": []}, headers=headers)
        assert r.status_code == 200
        assert r.json()["data"]["synced"] == 0


# ═══════════════════════════════════════════════════════════
# Promote 功能（步骤10 新增）
# ═══════════════════════════════════════════════════════════

class TestPromoteTasks:
    """任务提升到今日计划。"""

    def test_promote_from_yesterday_to_today(self, client, auth):
        """直接使用 /promote 端点提升任务到今日计划。"""
        headers, _ = auth

        # 1. 创建"源"计划（模拟昨日计划）
        r1 = client.post("/api/v1/plans", json={
            "tasks": [
                {"title": "源任务1"},
                {"title": "源任务2"},
                {"title": "源任务3(已完成)"},
            ],
        }, headers=headers)
        plan_id_src = r1.json()["data"]["id"]

        # 标记第三个为已完成
        tasks_src = r1.json()["data"]["tasks"]
        client.patch(
            f"/api/v1/plans/{plan_id_src}/tasks/{tasks_src[2]['id']}",
            json={"status": "completed"}, headers=headers,
        )

        # 重新获取以取得更新后的状态
        r1b = client.get(f"/api/v1/plans/{plan_id_src}", headers=headers)
        tasks_refreshed = r1b.json()["data"]["tasks"]
        pending_ids = [t["id"] for t in tasks_refreshed if t["status"] == "pending"]
        assert len(pending_ids) == 2

        # 2. 归档源计划
        client.post(f"/api/v1/plans/{plan_id_src}/archive", headers=headers)

        # 3. 创建今日计划
        r2 = client.post("/api/v1/plans", json={
            "tasks": [{"title": "今日新任务"}],
        }, headers=headers)
        plan_id_today = r2.json()["data"]["id"]

        # 4. 直接提升任务（模拟 yesterday_unfinished 来源）
        r3 = client.post(
            f"/api/v1/plans/{plan_id_today}/promote",
            json={"task_ids": pending_ids, "source": "yesterday_unfinished"},
            headers=headers,
        )
        assert r3.status_code == 200
        assert r3.json()["data"]["promoted"] == 2

        # 5. 验证今日计划现在有 1 + 2 = 3 个任务
        r5 = client.get(f"/api/v1/plans/{plan_id_today}", headers=headers)
        tasks_today = r5.json()["data"]["tasks"]
        assert len(tasks_today) == 3
        # 提升的任务 source 应为 yesterday_unfinished
        promoted = [t for t in tasks_today if t["source"] == "yesterday_unfinished"]
        assert len(promoted) == 2

    def test_promote_no_active_plan(self, client, auth):
        """没有活跃计划时 promote 报错。"""
        headers, _ = auth
        r = client.post(
            "/api/v1/plans/promote-from-yesterday",
            json={"task_ids": ["some_id"]},
            headers=headers,
        )
        assert r.status_code >= 400
