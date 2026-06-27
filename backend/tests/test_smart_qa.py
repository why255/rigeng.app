"""智能问答 · SmartQA 服务测试套件（步骤16 - 业务层测试）。

覆盖：提问 / 追问澄清 / 四要素答案 / 来源标注 / 纠错反馈 /
      有帮助反馈 / SOP归档 / 热门问题 / 对话管理 / 用户隔离。
"""
from __future__ import annotations

import pytest


# ═══════════════════════════════════════════════════════════
# 提问 & 四要素答案生成
# ═══════════════════════════════════════════════════════════

class TestAskQuestion:
    """POST /qa/ask — 发起提问"""

    def test_ask_simple_question(self, client, auth):
        """简单HR问题应直接返回四要素答案。"""
        headers, _ = auth
        r = client.post("/api/v1/qa/ask", json={
            "question": "试用期员工不符合录用条件，如何合规解除？",
        }, headers=headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["conversation_id"]
        assert data["is_clarification"] is False
        assert data["answer"] is not None
        assert data["answer"]["elements"]
        assert len(data["answer"]["elements"]) == 4

    def test_ask_short_question_triggers_clarification(self, client, auth):
        """过短问题触发追问澄清。"""
        headers, _ = auth
        r = client.post("/api/v1/qa/ask", json={
            "question": "裁员？",
        }, headers=headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["is_clarification"] is True
        assert data["clarification_question"]
        assert len(data["suggestions"]) > 0

    def test_followup_after_clarification(self, client, auth):
        """追问后获得最终答案。"""
        headers, _ = auth
        # 第一轮：触发追问
        r1 = client.post("/api/v1/qa/ask", json={
            "question": "裁员？",
        }, headers=headers)
        conv_id = r1.json()["data"]["conversation_id"]
        assert r1.json()["data"]["is_clarification"]

        # 第二轮：带具体信息追问
        r2 = client.post("/api/v1/qa/ask", json={
            "question": "公司因经营困难需要裁员30人，想问补偿金怎么计算？",
            "conversation_id": conv_id,
        }, headers=headers)
        assert r2.status_code == 200
        data2 = r2.json()["data"]
        assert data2["answer"] is not None

    def test_ask_with_source_engines(self, client, auth):
        """指定三源引擎配置提问。"""
        headers, _ = auth
        r = client.post("/api/v1/qa/ask", json={
            "question": "薪酬宽带如何设计才能激励老员工？",
            "source_engines": [
                {"key": "private", "enabled": True},
                {"key": "xiejun", "enabled": False},
                {"key": "internet", "enabled": True},
            ],
        }, headers=headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert data["answer"] is not None


# ═══════════════════════════════════════════════════════════
# 四要素答案结构
# ═══════════════════════════════════════════════════════════

class TestFourElementAnswer:
    """答案四要素结构验证"""

    def test_answer_has_four_elements(self, client, auth):
        """答案必须包含四个要素。"""
        headers, _ = auth
        r = client.post("/api/v1/qa/ask", json={
            "question": "试用期员工不符合录用条件，如何合规解除？",
        }, headers=headers)
        answer = r.json()["data"]["answer"]
        element_keys = {el["key"] for el in answer["elements"]}
        assert element_keys == {"key-points", "cautions", "script", "standard"}

    def test_each_element_has_required_fields(self, client, auth):
        """每个要素必须包含 title/icon/color/summary/detail。"""
        headers, _ = auth
        r = client.post("/api/v1/qa/ask", json={
            "question": "年底绩效面谈怎么引导员工说出真实想法？",
        }, headers=headers)
        answer = r.json()["data"]["answer"]
        for el in answer["elements"]:
            assert el["key"]
            assert el["title"]
            assert el["icon"]
            assert el["color"]
            assert el["summary"]
            assert isinstance(el["detail"], list)
            assert len(el["detail"]) > 0

    def test_different_questions_get_different_answers(self, client, auth):
        """不同问题得到不同的四要素答案。"""
        headers, _ = auth
        r1 = client.post("/api/v1/qa/ask", json={
            "question": "薪酬宽带如何设计才能激励老员工？",
        }, headers=headers)
        r2 = client.post("/api/v1/qa/ask", json={
            "question": "年底绩效面谈怎么引导员工说出真实想法？",
        }, headers=headers)
        # 两个答案的摘要应该不同
        ans1_summary = r1.json()["data"]["answer"]["elements"][0]["summary"]
        ans2_summary = r2.json()["data"]["answer"]["elements"][0]["summary"]
        assert ans1_summary != ans2_summary

    def test_source_reference_present(self, client, auth):
        """答案必须包含来源引用（L1防幻觉）。"""
        headers, _ = auth
        r = client.post("/api/v1/qa/ask", json={
            "question": "试用期员工不符合录用条件，如何合规解除？",
            "source_engines": [
                {"key": "private", "enabled": True},
                {"key": "xiejun", "enabled": True},
                {"key": "internet", "enabled": True},
            ],
        }, headers=headers)
        answer = r.json()["data"]["answer"]
        # 至少应有来源信息
        assert answer["source"] is not None


# ═══════════════════════════════════════════════════════════
# 对话管理
# ═══════════════════════════════════════════════════════════

class TestConversation:
    """GET/DELETE /qa/conversations/{id}"""

    def test_get_conversation(self, client, auth):
        """获取对话历史。"""
        headers, _ = auth
        r1 = client.post("/api/v1/qa/ask", json={
            "question": "试用期员工不符合录用条件，如何合规解除？",
        }, headers=headers)
        conv_id = r1.json()["data"]["conversation_id"]

        r2 = client.get(f"/api/v1/qa/conversations/{conv_id}", headers=headers)
        assert r2.status_code == 200
        conv = r2.json()["data"]
        assert conv["conversation_id"] == conv_id
        assert len(conv["messages"]) >= 2  # 至少欢迎 + 用户提问

    def test_delete_conversation(self, client, auth):
        """删除对话。"""
        headers, _ = auth
        r1 = client.post("/api/v1/qa/ask", json={
            "question": "薪酬宽带如何设计？",
        }, headers=headers)
        conv_id = r1.json()["data"]["conversation_id"]

        r2 = client.delete(f"/api/v1/qa/conversations/{conv_id}", headers=headers)
        assert r2.status_code == 200
        assert r2.json()["data"]["deleted"] is True

        # 再次获取应404
        r3 = client.get(f"/api/v1/qa/conversations/{conv_id}", headers=headers)
        assert r3.json()["code"] != 0

    def test_get_nonexistent_conversation(self, client, auth):
        """获取不存在的对话返回错误。"""
        headers, _ = auth
        r = client.get("/api/v1/qa/conversations/nonexistent-id", headers=headers)
        assert r.json()["code"] != 0

    def test_ask_with_nonexistent_conversation(self, client, auth):
        """向不存在的对话追问返回错误。"""
        headers, _ = auth
        r = client.post("/api/v1/qa/ask", json={
            "question": "追问",
            "conversation_id": "nonexistent-id",
        }, headers=headers)
        assert r.json()["code"] != 0


# ═══════════════════════════════════════════════════════════
# 纠错反馈（防幻觉L3）
# ═══════════════════════════════════════════════════════════

class TestFeedback:
    """POST /qa/answers/{id}/feedback"""

    def test_submit_feedback(self, client, auth):
        """提交纠错反馈。"""
        headers, _ = auth
        # 先获取一个答案
        r1 = client.post("/api/v1/qa/ask", json={
            "question": "试用期员工不符合录用条件，如何合规解除？",
        }, headers=headers)
        answer_id = r1.json()["data"]["answer"]["id"]

        # 提交反馈
        r2 = client.post(f"/api/v1/qa/answers/{answer_id}/feedback", json={
            "answer_id": answer_id,
            "feedback_type": "内容有误",
            "detail": "劳动合同法第39条已经更新，请核实最新版本。",
        }, headers=headers)
        assert r2.status_code == 200
        data = r2.json()["data"]
        assert data["feedback_id"]
        assert data["status"] == "pending"

    def test_submit_feedback_invalid_type(self, client, auth):
        """提交非法类型的反馈应被拒绝。"""
        headers, _ = auth
        r1 = client.post("/api/v1/qa/ask", json={
            "question": "试用期员工不符合录用条件，如何合规解除？",
        }, headers=headers)
        answer_id = r1.json()["data"]["answer"]["id"]

        r2 = client.post(f"/api/v1/qa/answers/{answer_id}/feedback", json={
            "answer_id": answer_id,
            "feedback_type": "非法类型",
        }, headers=headers)
        assert r2.status_code == 422


# ═══════════════════════════════════════════════════════════
# 有帮助反馈
# ═══════════════════════════════════════════════════════════

class TestHelpful:
    """POST /qa/answers/{id}/helpful"""

    def test_mark_helpful(self, client, auth):
        """标记答案有帮助。"""
        headers, _ = auth
        r1 = client.post("/api/v1/qa/ask", json={
            "question": "试用期员工不符合录用条件，如何合规解除？",
        }, headers=headers)
        answer_id = r1.json()["data"]["answer"]["id"]

        r2 = client.post(f"/api/v1/qa/answers/{answer_id}/helpful", json={
            "answer_id": answer_id,
        }, headers=headers)
        assert r2.status_code == 200
        assert r2.json()["data"]["helpful_count"] >= 1


# ═══════════════════════════════════════════════════════════
# SOP归档
# ═══════════════════════════════════════════════════════════

class TestArchive:
    """POST /qa/answers/{id}/archive"""

    def test_archive_to_knowledge_base(self, client, auth):
        """归档答案到知识库。"""
        headers, _ = auth
        r1 = client.post("/api/v1/qa/ask", json={
            "question": "试用期员工不符合录用条件，如何合规解除？",
        }, headers=headers)
        answer_id = r1.json()["data"]["answer"]["id"]

        r2 = client.post(f"/api/v1/qa/answers/{answer_id}/archive", json={
            "answer_id": answer_id,
        }, headers=headers)
        assert r2.status_code == 200
        data = r2.json()["data"]
        assert data["success"] is True
        assert data["doc_id"]
        assert data["contribution_value"] == 20

    def test_archive_duplicate_returns_existing(self, client, auth):
        """重复归档返回已有doc_id。"""
        headers, _ = auth
        r1 = client.post("/api/v1/qa/ask", json={
            "question": "薪酬宽带如何设计才能激励老员工？",
        }, headers=headers)
        answer_id = r1.json()["data"]["answer"]["id"]

        # 第一次归档
        r2 = client.post(f"/api/v1/qa/answers/{answer_id}/archive", json={
            "answer_id": answer_id,
        }, headers=headers)
        doc_id_1 = r2.json()["data"]["doc_id"]

        # 第二次归档
        r3 = client.post(f"/api/v1/qa/answers/{answer_id}/archive", json={
            "answer_id": answer_id,
        }, headers=headers)
        assert r3.json()["data"]["doc_id"] == doc_id_1
        assert r3.json()["data"]["contribution_value"] == 0


# ═══════════════════════════════════════════════════════════
# 热门问题
# ═══════════════════════════════════════════════════════════

class TestHotQuestions:
    """GET /qa/hot-questions"""

    def test_get_hot_questions(self, client, auth):
        """获取热门问题列表。"""
        headers, _ = auth
        r = client.get("/api/v1/qa/hot-questions", headers=headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert isinstance(data, list)
        assert len(data) >= 1
        assert all("id" in q and "text" in q for q in data)


# ═══════════════════════════════════════════════════════════
# 问答历史搜索
# ═══════════════════════════════════════════════════════════

class TestQaHistory:
    """GET /qa/history"""

    def test_search_empty_history(self, client, auth):
        """空历史返回空列表。"""
        headers, _ = auth
        r = client.get("/api/v1/qa/history", headers=headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert isinstance(data, list)

    def test_search_history_with_query(self, client, auth):
        """关键词搜索历史。"""
        headers, _ = auth
        # 先问一个问题
        client.post("/api/v1/qa/ask", json={
            "question": "试用期员工不符合录用条件，如何合规解除？",
        }, headers=headers)

        # 搜索
        r = client.get("/api/v1/qa/history?q=试用期", headers=headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert isinstance(data, list)
        assert len(data) >= 1

    def test_search_history_no_match(self, client, auth):
        """不匹配的搜索返回空列表。"""
        headers, _ = auth
        r = client.get("/api/v1/qa/history?q=不存在的关键词xyz", headers=headers)
        assert r.status_code == 200
        data = r.json()["data"]
        assert len(data) == 0


# ═══════════════════════════════════════════════════════════
# 用户隔离（安全验证）
# ═══════════════════════════════════════════════════════════

class TestUserIsolation:
    """验证不同用户的问答数据隔离"""

    def test_user_cannot_access_other_conversation(self, client):
        """用户A的对话不能被用户B访问。"""
        # 用户A注册登录
        client.post("/api/v1/auth/register", json={
            "phone": "13800000002", "password": "secret123", "gender": "female",
        })
        r_a = client.post("/api/v1/auth/login", json={
            "phone": "13800000002", "password": "secret123",
        })
        token_a = r_a.json()["data"]["token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}

        # 用户A提问
        r1 = client.post("/api/v1/qa/ask", json={
            "question": "试用期员工不符合录用条件，如何合规解除？",
        }, headers=headers_a)
        conv_id = r1.json()["data"]["conversation_id"]

        # 用户B注册登录
        client.post("/api/v1/auth/register", json={
            "phone": "13800000003", "password": "secret123", "gender": "male",
        })
        r_b = client.post("/api/v1/auth/login", json={
            "phone": "13800000003", "password": "secret123",
        })
        token_b = r_b.json()["data"]["token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # 用户B尝试访问用户A的对话
        r2 = client.get(f"/api/v1/qa/conversations/{conv_id}", headers=headers_b)
        assert r2.json()["code"] != 0  # 应拒绝访问

    def test_user_qa_requires_auth(self, client):
        """未认证用户无法使用QA服务。"""
        r = client.post("/api/v1/qa/ask", json={
            "question": "test question?",
        })
        assert r.status_code == 401


# ═══════════════════════════════════════════════════════════
# 三源引擎
# ═══════════════════════════════════════════════════════════

class TestSourceEngines:
    """三源引擎配置"""

    def test_all_sources_disabled_still_works(self, client, auth):
        """即使全部源关闭也能返回基础答案。"""
        headers, _ = auth
        r = client.post("/api/v1/qa/ask", json={
            "question": "试用期员工不符合录用条件，如何合规解除？",
            "source_engines": [
                {"key": "private", "enabled": False},
                {"key": "xiejun", "enabled": False},
                {"key": "internet", "enabled": False},
            ],
        }, headers=headers)
        assert r.status_code == 200
        data = r.json()["data"]
        # 即使没有检索源，也能生成基础答案
        assert data["answer"] is not None

    def test_internet_source_marked_in_answer(self, client, auth):
        """互联网源的答案应被标记。"""
        headers, _ = auth
        r = client.post("/api/v1/qa/ask", json={
            "question": "最新的劳动法裁员补偿标准是什么？",
            "source_engines": [
                {"key": "private", "enabled": False},
                {"key": "xiejun", "enabled": False},
                {"key": "internet", "enabled": True},
            ],
        }, headers=headers)
        assert r.status_code == 200
        answer = r.json()["data"]["answer"]
        # 互联网源答案应有source标注
        if answer and answer["source"]:
            assert answer["source"]["is_internet"] is True
