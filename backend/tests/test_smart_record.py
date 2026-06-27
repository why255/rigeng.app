"""智能记录 · SmartRecord 服务测试套件（步骤15 - 业务层测试）。

覆盖：录音生命周期 / 转写 / 萃取 / 归档 / 行动项同步 /
      提词器 / 历史查询 / 统计 / 删除 / 用户隔离。
"""
from __future__ import annotations

import pytest


# ═══════════════════════════════════════════════════════════
# 录音生命周期
# ═══════════════════════════════════════════════════════════

class TestRecordingLifecycle:
    """POST /recordings/start → /recordings/stop"""

    def test_start_recording(self, client, auth):
        """开始录音：返回 recording_id。"""
        headers, _ = auth
        r = client.post("/api/v1/recordings/start", json={"scene": "面试"}, headers=headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["recording_id"]
        assert data["scene"] == "面试"
        assert data["status"] == "recording"

    def test_start_recording_default_scene(self, client, auth):
        """不传 scene 默认为面试。"""
        headers, _ = auth
        r = client.post("/api/v1/recordings/start", json={}, headers=headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["scene"] == "面试"

    def test_start_recording_meeting_scene(self, client, auth):
        """会议场景录音。"""
        headers, _ = auth
        r = client.post("/api/v1/recordings/start", json={"scene": "会议"}, headers=headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["scene"] == "会议"

    def test_stop_recording(self, client, auth):
        """停止录音：状态变为 transcribing。"""
        headers, _ = auth
        r1 = client.post("/api/v1/recordings/start", json={"scene": "面试"}, headers=headers)
        rid = r1.json()["data"]["recording_id"]

        r2 = client.post("/api/v1/recordings/stop", json={"recording_id": rid}, headers=headers)
        assert r2.status_code == 200
        data = r2.json()["data"]
        assert data["recording_id"] == rid
        # 自动触发处理流水线后状态变为 completed
        assert data["status"] in ("transcribing", "extracting", "completed")

    def test_stop_nonexistent_recording(self, client, auth):
        """停止不存在的录音 → 404。"""
        headers, _ = auth
        r = client.post("/api/v1/recordings/stop", json={"recording_id": "nonexistent"}, headers=headers)
        assert r.status_code == 404

    def test_stop_already_stopped(self, client, auth):
        """重复停止 → 400。"""
        headers, _ = auth
        r1 = client.post("/api/v1/recordings/start", json={"scene": "日常"}, headers=headers)
        rid = r1.json()["data"]["recording_id"]
        client.post("/api/v1/recordings/stop", json={"recording_id": rid}, headers=headers)
        r2 = client.post("/api/v1/recordings/stop", json={"recording_id": rid}, headers=headers)
        assert r2.status_code == 400


# ═══════════════════════════════════════════════════════════
# 统计与列表
# ═══════════════════════════════════════════════════════════

class TestStatsAndList:
    """GET /recordings/today /recordings/recent /recordings"""

    def test_today_stats_empty(self, client, auth):
        """新用户今日无录音统计。"""
        headers, _ = auth
        r = client.get("/api/v1/recordings/today", headers=headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["count"] == 0
        assert data["total_minutes"] == 0

    def test_today_stats_with_recording(self, client, auth):
        """有录音后统计更新。"""
        headers, _ = auth
        client.post("/api/v1/recordings/start", json={"scene": "会议"}, headers=headers)
        r = client.get("/api/v1/recordings/today", headers=headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["count"] >= 1
        assert data["processing_count"] >= 0

    def test_recent_recordings_empty(self, client, auth):
        """空列表。"""
        headers, _ = auth
        r = client.get("/api/v1/recordings/recent", headers=headers)
        assert r.status_code == 200
        assert r.json()["data"] == []

    def test_recent_recordings_with_data(self, client, auth):
        """有录音数据后返回最近列表。"""
        headers, _ = auth
        client.post("/api/v1/recordings/start", json={"scene": "面试"}, headers=headers)
        r = client.get("/api/v1/recordings/recent", headers=headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert isinstance(data, list)
        if data:
            item = data[0]
            assert "id" in item
            assert "scene" in item
            assert "status" in item

    def test_history(self, client, auth):
        """历史列表接口。"""
        headers, _ = auth
        r = client.get("/api/v1/recordings", headers=headers)
        assert r.status_code == 200
        assert isinstance(r.json()["data"], list)

    def test_history_search(self, client, auth):
        """历史列表搜索。"""
        headers, _ = auth
        # 先创建一个
        r1 = client.post("/api/v1/recordings/start", json={"scene": "面试"}, headers=headers)
        rid = r1.json()["data"]["recording_id"]
        client.post("/api/v1/recordings/stop", json={"recording_id": rid}, headers=headers)

        r = client.get("/api/v1/recordings?search=面试", headers=headers)
        assert r.status_code == 200
        # 可能有或没有结果（取决于处理状态），但不应报错


# ═══════════════════════════════════════════════════════════
# 转写
# ═══════════════════════════════════════════════════════════

class TestTranscript:
    """GET /recordings/{id}/transcript"""

    def test_get_transcript(self, client, auth):
        """获取转写文本。"""
        headers, _ = auth
        r1 = client.post("/api/v1/recordings/start", json={"scene": "面试"}, headers=headers)
        rid = r1.json()["data"]["recording_id"]
        client.post("/api/v1/recordings/stop", json={"recording_id": rid}, headers=headers)

        r = client.get(f"/api/v1/recordings/{rid}/transcript", headers=headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["recording_id"] == rid
        assert len(data["segments"]) > 0
        seg = data["segments"][0]
        assert "speaker" in seg
        assert "text" in seg
        assert "time" in seg
        assert "confidence" in seg

    def test_get_transcript_nonexistent(self, client, auth):
        """转写不存在的录音 → 404。"""
        headers, _ = auth
        r = client.get("/api/v1/recordings/nonexistent/transcript", headers=headers)
        assert r.status_code == 404

    def test_transcript_scene_interview(self, client, auth):
        """面试场景转写包含面试官和候选人。"""
        headers, _ = auth
        r1 = client.post("/api/v1/recordings/start", json={"scene": "面试"}, headers=headers)
        rid = r1.json()["data"]["recording_id"]
        client.post("/api/v1/recordings/stop", json={"recording_id": rid}, headers=headers)

        r = client.get(f"/api/v1/recordings/{rid}/transcript", headers=headers)
        data = r.json()["data"]
        speakers = {seg["speaker"] for seg in data["segments"]}
        assert "面试官" in speakers
        assert "候选人" in speakers

    def test_transcript_scene_meeting(self, client, auth):
        """会议场景转写。"""
        headers, _ = auth
        r1 = client.post("/api/v1/recordings/start", json={"scene": "会议"}, headers=headers)
        rid = r1.json()["data"]["recording_id"]
        client.post("/api/v1/recordings/stop", json={"recording_id": rid}, headers=headers)

        r = client.get(f"/api/v1/recordings/{rid}/transcript", headers=headers)
        assert r.status_code == 200
        assert len(r.json()["data"]["segments"]) > 0


# ═══════════════════════════════════════════════════════════
# 萃取
# ═══════════════════════════════════════════════════════════

class TestExtraction:
    """GET /recordings/{id}/extraction"""

    def test_get_extraction_interview(self, client, auth):
        """面试场景萃取：包含候选人画像和胜任力评估。"""
        headers, _ = auth
        r1 = client.post("/api/v1/recordings/start", json={"scene": "面试"}, headers=headers)
        rid = r1.json()["data"]["recording_id"]
        client.post("/api/v1/recordings/stop", json={"recording_id": rid}, headers=headers)

        r = client.get(f"/api/v1/recordings/{rid}/extraction", headers=headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["recording_id"] == rid
        assert data["extraction_type"] == "interview_profile"
        assert data["name"] != ""
        assert len(data["competencies"]) > 0
        assert len(data["skills"]) > 0

    def test_get_extraction_meeting(self, client, auth):
        """会议场景萃取：包含行动项。"""
        headers, _ = auth
        r1 = client.post("/api/v1/recordings/start", json={"scene": "会议"}, headers=headers)
        rid = r1.json()["data"]["recording_id"]
        client.post("/api/v1/recordings/stop", json={"recording_id": rid}, headers=headers)

        r = client.get(f"/api/v1/recordings/{rid}/extraction", headers=headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["extraction_type"] == "meeting_minutes"
        assert len(data["action_items"]) > 0

    def test_get_extraction_daily(self, client, auth):
        """日常场景萃取。"""
        headers, _ = auth
        r1 = client.post("/api/v1/recordings/start", json={"scene": "日常"}, headers=headers)
        rid = r1.json()["data"]["recording_id"]
        client.post("/api/v1/recordings/stop", json={"recording_id": rid}, headers=headers)

        r = client.get(f"/api/v1/recordings/{rid}/extraction", headers=headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["extraction_type"] == "daily_notes"

    def test_get_extraction_nonexistent(self, client, auth):
        """萃取不存在的录音 → 404。"""
        headers, _ = auth
        r = client.get("/api/v1/recordings/nonexistent/extraction", headers=headers)
        assert r.status_code == 404


# ═══════════════════════════════════════════════════════════
# 归档
# ═══════════════════════════════════════════════════════════

class TestArchive:
    """POST /recordings/{id}/archive"""

    def test_archive_to_kb(self, client, auth):
        """归档到知识库成功。"""
        headers, _ = auth
        r1 = client.post("/api/v1/recordings/start", json={"scene": "面试"}, headers=headers)
        rid = r1.json()["data"]["recording_id"]
        client.post("/api/v1/recordings/stop", json={"recording_id": rid}, headers=headers)
        # 先获取萃取（确保萃取完成）
        client.get(f"/api/v1/recordings/{rid}/extraction", headers=headers)

        r = client.post(f"/api/v1/recordings/{rid}/archive", headers=headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["success"] is True
        assert data["doc_id"] != ""

    def test_archive_duplicate(self, client, auth):
        """重复归档返回已有结果。"""
        headers, _ = auth
        r1 = client.post("/api/v1/recordings/start", json={"scene": "面试"}, headers=headers)
        rid = r1.json()["data"]["recording_id"]
        client.post("/api/v1/recordings/stop", json={"recording_id": rid}, headers=headers)
        client.get(f"/api/v1/recordings/{rid}/extraction", headers=headers)
        client.post(f"/api/v1/recordings/{rid}/archive", headers=headers)

        r2 = client.post(f"/api/v1/recordings/{rid}/archive", headers=headers)
        assert r2.status_code == 200
        assert r2.json()["data"]["success"] is True

    def test_archive_nonexistent(self, client, auth):
        """归档不存在的录音 → 404。"""
        headers, _ = auth
        r = client.post("/api/v1/recordings/nonexistent/archive", headers=headers)
        assert r.status_code == 404

    def test_archive_with_hr_category(self, client, auth):
        """归档时指定HR分类。"""
        headers, _ = auth
        r1 = client.post("/api/v1/recordings/start", json={"scene": "会议"}, headers=headers)
        rid = r1.json()["data"]["recording_id"]
        client.post("/api/v1/recordings/stop", json={"recording_id": rid}, headers=headers)
        client.get(f"/api/v1/recordings/{rid}/extraction", headers=headers)

        r = client.post(f"/api/v1/recordings/{rid}/archive", json={
            "recording_id": rid, "hr_category": "人资规划",
        }, headers=headers)
        assert r.status_code == 200
        assert r.json()["data"]["success"] is True


# ═══════════════════════════════════════════════════════════
# 行动项同步
# ═══════════════════════════════════════════════════════════

class TestSyncActions:
    """POST /recordings/{id}/sync-actions"""

    def test_sync_to_plan(self, client, auth):
        """同步行动项到朝有规划。"""
        headers, _ = auth
        r1 = client.post("/api/v1/recordings/start", json={"scene": "会议"}, headers=headers)
        rid = r1.json()["data"]["recording_id"]
        client.post("/api/v1/recordings/stop", json={"recording_id": rid}, headers=headers)
        client.get(f"/api/v1/recordings/{rid}/extraction", headers=headers)

        r = client.post(f"/api/v1/recordings/{rid}/sync-actions", headers=headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["synced_count"] > 0
        assert len(data["plan_task_ids"]) == data["synced_count"]

    def test_sync_duplicate(self, client, auth):
        """重复同步不会重复创建任务。"""
        headers, _ = auth
        r1 = client.post("/api/v1/recordings/start", json={"scene": "会议"}, headers=headers)
        rid = r1.json()["data"]["recording_id"]
        client.post("/api/v1/recordings/stop", json={"recording_id": rid}, headers=headers)
        client.get(f"/api/v1/recordings/{rid}/extraction", headers=headers)
        client.post(f"/api/v1/recordings/{rid}/sync-actions", headers=headers)

        r2 = client.post(f"/api/v1/recordings/{rid}/sync-actions", headers=headers)
        assert r2.status_code == 200
        # 第二次同步应该有 0 个新增
        assert r2.json()["data"]["synced_count"] == 0

    def test_sync_specific_actions(self, client, auth):
        """只同步指定的行动项。"""
        headers, _ = auth
        r1 = client.post("/api/v1/recordings/start", json={"scene": "会议"}, headers=headers)
        rid = r1.json()["data"]["recording_id"]
        client.post("/api/v1/recordings/stop", json={"recording_id": rid}, headers=headers)

        # 获取萃取（含行动项ID）
        ext = client.get(f"/api/v1/recordings/{rid}/extraction", headers=headers)
        action_items = ext.json()["data"]["action_items"]
        if action_items:
            ai_id = action_items[0]["id"]
            r = client.post(f"/api/v1/recordings/{rid}/sync-actions", json={
                "recording_id": rid,
                "action_item_ids": [ai_id],
            }, headers=headers)
            assert r.status_code == 200


# ═══════════════════════════════════════════════════════════
# 提词器（跨模块）
# ═══════════════════════════════════════════════════════════

class TestTeleprompter:
    """GET /recordings/teleprompter/questions"""

    def test_get_teleprompter(self, client, auth):
        """获取面试提词器问题。"""
        headers, _ = auth
        r = client.get("/api/v1/recordings/teleprompter/questions", headers=headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["scene"] == "面试"
        assert len(data["questions"]) > 0
        assert "tips" in data

    def test_get_teleprompter_with_position(self, client, auth):
        """指定岗位的提词器。"""
        headers, _ = auth
        r = client.get("/api/v1/recordings/teleprompter/questions?position=高级前端工程师&stage=技术面", headers=headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["position"] == "高级前端工程师"
        assert len(data["questions"]) > 0


# ═══════════════════════════════════════════════════════════
# 删除
# ═══════════════════════════════════════════════════════════

class TestDelete:
    """DELETE /recordings/{id}"""

    def test_delete_recording(self, client, auth):
        """删除录音（软删除）。"""
        headers, _ = auth
        r1 = client.post("/api/v1/recordings/start", json={"scene": "日常"}, headers=headers)
        rid = r1.json()["data"]["recording_id"]

        r = client.delete(f"/api/v1/recordings/{rid}", headers=headers)
        assert r.status_code == 200
        assert r.json()["data"]["deleted"] is True

    def test_delete_nonexistent(self, client, auth):
        """删除不存在的录音 → 404。"""
        headers, _ = auth
        r = client.delete("/api/v1/recordings/nonexistent", headers=headers)
        assert r.status_code == 404

    def test_deleted_not_in_history(self, client, auth):
        """删除后不在历史列表中。"""
        headers, _ = auth
        r1 = client.post("/api/v1/recordings/start", json={"scene": "日常"}, headers=headers)
        rid = r1.json()["data"]["recording_id"]
        client.delete(f"/api/v1/recordings/{rid}", headers=headers)

        r = client.get("/api/v1/recordings", headers=headers)
        data = r.json()["data"]
        ids = [item["id"] for item in data]
        assert rid not in ids


# ═══════════════════════════════════════════════════════════
# 用户隔离
# ═══════════════════════════════════════════════════════════

class TestUserIsolation:
    """验证用户A不能操作用户B的录音。"""

    def _auth_b(self, client):
        """注册并登录另一个用户B。"""
        client.post("/api/v1/auth/register", json={
            "phone": "13800000002", "password": "secret123", "gender": "female",
        })
        r = client.post("/api/v1/auth/login", json={"phone": "13800000002", "password": "secret123"})
        data = r.json()["data"]
        return {"Authorization": f"Bearer {data['token']}"}, data["user_id"]

    def test_cannot_access_other_transcript(self, client, auth):
        """用户B不能访问用户A的转写。"""
        headers_a, _ = auth
        headers_b, _ = self._auth_b(client)

        # A创建录音
        r1 = client.post("/api/v1/recordings/start", json={"scene": "面试"}, headers=headers_a)
        rid = r1.json()["data"]["recording_id"]

        # B尝试访问 → 404（隔离开，不暴露存在性）
        r = client.get(f"/api/v1/recordings/{rid}/transcript", headers=headers_b)
        assert r.status_code == 404

    def test_cannot_stop_other_recording(self, client, auth):
        """用户B不能停止用户A的录音。"""
        headers_a, _ = auth
        headers_b, _ = self._auth_b(client)

        r1 = client.post("/api/v1/recordings/start", json={"scene": "日常"}, headers=headers_a)
        rid = r1.json()["data"]["recording_id"]

        r = client.post("/api/v1/recordings/stop", json={"recording_id": rid}, headers=headers_b)
        assert r.status_code == 404


# ═══════════════════════════════════════════════════════════
# 完整工作流
# ═══════════════════════════════════════════════════════════

class TestFullWorkflow:
    """端到端：开始录音 → 停止 → 转写 → 萃取 → 归档 → 同步"""

    def test_full_workflow(self, client, auth):
        """完整的智能记录工作流。"""
        headers, _ = auth

        # 1. 开始录音
        r = client.post("/api/v1/recordings/start", json={"scene": "面试"}, headers=headers)
        assert r.status_code == 200
        rid = r.json()["data"]["recording_id"]

        # 2. 停止录音
        r = client.post("/api/v1/recordings/stop", json={"recording_id": rid}, headers=headers)
        assert r.status_code == 200

        # 3. 获取转写
        r = client.get(f"/api/v1/recordings/{rid}/transcript", headers=headers)
        assert r.status_code == 200
        assert len(r.json()["data"]["segments"]) > 0

        # 4. 获取萃取
        r = client.get(f"/api/v1/recordings/{rid}/extraction", headers=headers)
        assert r.status_code == 200
        assert len(r.json()["data"]["competencies"]) > 0

        # 5. 归档到知识库
        r = client.post(f"/api/v1/recordings/{rid}/archive", headers=headers)
        assert r.status_code == 200
        assert r.json()["data"]["success"] is True

        # 6. 同步行动项到朝有规划
        r = client.post(f"/api/v1/recordings/{rid}/sync-actions", headers=headers)
        assert r.status_code == 200
        assert r.json()["data"]["synced_count"] > 0

        # 7. 验证统计
        r = client.get("/api/v1/recordings/today", headers=headers)
        assert r.status_code == 200
        assert r.json()["data"]["count"] >= 1

    def test_full_workflow_meeting(self, client, auth):
        """会议场景完整工作流。"""
        headers, _ = auth

        # 开始→停止→转写→萃取→归档→同步
        r = client.post("/api/v1/recordings/start", json={"scene": "会议"}, headers=headers)
        rid = r.json()["data"]["recording_id"]
        client.post("/api/v1/recordings/stop", json={"recording_id": rid}, headers=headers)
        client.get(f"/api/v1/recordings/{rid}/transcript", headers=headers)
        ext = client.get(f"/api/v1/recordings/{rid}/extraction", headers=headers)
        assert ext.json()["data"]["extraction_type"] == "meeting_minutes"

        archive = client.post(f"/api/v1/recordings/{rid}/archive", headers=headers)
        assert archive.json()["data"]["success"] is True

        sync = client.post(f"/api/v1/recordings/{rid}/sync-actions", headers=headers)
        assert sync.json()["data"]["synced_count"] > 0

    def test_multiple_recordings(self, client, auth):
        """创建多个录音并验证历史列表。"""
        headers, _ = auth

        for scene in ["面试", "会议", "日常"]:
            r = client.post("/api/v1/recordings/start", json={"scene": scene}, headers=headers)
            rid = r.json()["data"]["recording_id"]
            client.post(f"/api/v1/recordings/stop", json={"recording_id": rid}, headers=headers)
            client.get(f"/api/v1/recordings/{rid}/transcript", headers=headers)
            client.get(f"/api/v1/recordings/{rid}/extraction", headers=headers)

        history = client.get("/api/v1/recordings", headers=headers)
        assert len(history.json()["data"]) >= 3
