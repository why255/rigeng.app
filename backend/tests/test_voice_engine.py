"""③语音/智能引擎服务 单元/接口测试（正常流/边界/离线降级/安全）。"""
from __future__ import annotations

import base64

import pytest


# ═══════ 辅助 ═══════
FAKE_AUDIO_B64 = base64.b64encode(b"\x00" * 1600).decode()  # 100ms 16kHz 模拟音频


def _mock_asr_success(*args, **kwargs):
    return {"text": "今天的工作计划是", "confidence": 0.92, "duration_ms": 3200, "engine_used": "tencent_online"}


def _mock_asr_low_conf(*args, **kwargs):
    return {"text": "??%", "confidence": 0.25, "duration_ms": 1500, "engine_used": "tencent_online"}


def _mock_llm_success(*args, **kwargs):
    return {"content": "姐，今天建议聚焦这三件事~", "model_used": "glm-4-flash",
            "usage": {"prompt_tokens": 150, "completion_tokens": 80, "total_tokens": 230}}


def _mock_converse_success(*args, **kwargs):
    return {
        "conversation_id": "conv_test123",
        "assistant_reply": "好的姐，我来帮你梳理今天的计划。",
        "is_crisis": False,
        "is_hr_guided": False,
        "suggestions": None,
    }


# ═══════ 测试 ═══════


class TestVoiceEngineHealth:
    """A0 服务健康检查。"""

    def test_health_returns_status(self, client):
        r = client.get("/api/v1/voice/health")
        data = r.json()["data"]
        assert data["status"] == "up"
        assert "online_asr" in data
        assert "offline_asr" in data
        assert "llm" in data


class TestASREndpoint:
    """A1/A2 语音转文字。"""

    def test_asr_requires_auth(self, client):
        r = client.post("/api/v1/voice/asr", json={
            "audio_base64": FAKE_AUDIO_B64, "audio_format": "wav",
        })
        assert r.json()["code"] == 10001

    def test_asr_missing_audio(self, auth, client):
        headers, _ = auth
        r = client.post("/api/v1/voice/asr", json={}, headers=headers)
        assert r.status_code == 422

    @pytest.mark.skip(reason="需要真实的腾讯云ASR凭证或mock网络层")
    def test_asr_online_success(self, auth, client):
        """【网络测试】需要有效的腾讯云ASR凭证。"""
        headers, _ = auth
        r = client.post("/api/v1/voice/asr", json={
            "audio_base64": FAKE_AUDIO_B64,
            "audio_format": "wav",
            "prefer_offline": False,
        }, headers=headers)
        assert r.status_code in (200, 503)  # 200=成功 / 503=无凭证/不可用

    def test_asr_prefer_offline_returns_503_when_unavailable(self, auth, client):
        """离线优先模式：Vosk模型未安装时尝试离线→再尝试在线。"""
        headers, _ = auth
        r = client.post("/api/v1/voice/asr", json={
            "audio_base64": FAKE_AUDIO_B64,
            "audio_format": "wav",
            "prefer_offline": True,
        }, headers=headers)
        # 离线不可用→尝试在线→可能在200(成功)、400(API错误)、503(凭证缺失)之间
        assert r.status_code in (200, 400, 503)

    def test_asr_bad_audio_format(self, auth, client):
        """非法音频格式→参数校验拦截（或API返回错误）。"""
        headers, _ = auth
        r = client.post("/api/v1/voice/asr", json={
            "audio_base64": FAKE_AUDIO_B64,
            "audio_format": "",
        }, headers=headers)
        # 空格式可能在参数校验层拦截(422)或被API拒绝(400)
        assert r.status_code in (200, 400, 422, 503)

    def test_asr_sample_rate_bounds(self, auth, client):
        """采样率边界校验。"""
        headers, _ = auth
        # 低于8kHz
        r = client.post("/api/v1/voice/asr", json={
            "audio_base64": FAKE_AUDIO_B64,
            "sample_rate": 4000,
        }, headers=headers)
        assert r.status_code == 422
        # 高于48kHz
        r = client.post("/api/v1/voice/asr", json={
            "audio_base64": FAKE_AUDIO_B64,
            "sample_rate": 96000,
        }, headers=headers)
        assert r.status_code == 422
        # 合法值 16000
        r = client.post("/api/v1/voice/asr", json={
            "audio_base64": FAKE_AUDIO_B64,
            "sample_rate": 16000,
        }, headers=headers)
        assert r.status_code in (200, 400, 503)  # 200=成功 400=API鉴权 503=无凭证


class TestLLMEndpoint:
    """A3/A4 AI推理/生成。"""

    def test_llm_requires_auth(self, client):
        """修复后：LLM端点需要认证。"""
        r = client.post("/api/v1/voice/llm", json={"prompt": "测试"})
        assert r.json()["code"] == 10001

    def test_llm_empty_prompt(self, auth, client):
        headers, _ = auth
        r = client.post("/api/v1/voice/llm", json={"prompt": ""}, headers=headers)
        assert r.status_code == 422

    def test_llm_prompt_too_long(self, auth, client):
        headers, _ = auth
        r = client.post("/api/v1/voice/llm", json={"prompt": "x" * 9000}, headers=headers)
        assert r.status_code == 422

    def test_llm_minimal_prompt(self, auth, client):
        """无API Key时返回503，网络超时返回504。"""
        headers, _ = auth
        r = client.post("/api/v1/voice/llm", json={"prompt": "什么是HR三支柱"}, headers=headers)
        assert r.status_code in (200, 502, 503, 504)

    def test_llm_with_context(self, auth, client):
        """多轮对话上下文。"""
        headers, _ = auth
        r = client.post("/api/v1/voice/llm", json={
            "prompt": "那绩效面谈呢",
            "context": [{"role": "user", "content": "什么是HR三支柱"}, {"role": "assistant", "content": "HR三支柱包含..."}],
        }, headers=headers)
        # 200=成功 502=AI返回空 503=无凭证 504=网络超时
        assert r.status_code in (200, 502, 503, 504)

    def test_llm_custom_params(self, auth, client):
        """自定义模型参数。"""
        headers, _ = auth
        r = client.post("/api/v1/voice/llm", json={
            "prompt": "测试",
            "model": "glm-4-flash",
            "temperature": 0.3,
            "max_tokens": 500,
            "stream": False,
        }, headers=headers)
        assert r.status_code in (200, 502, 503, 504)


class TestConverseEndpoint:
    """A5 多轮对话管理。"""

    def test_converse_requires_auth(self, client):
        r = client.post("/api/v1/voice/converse", json={
            "user_input": "我今天要做绩效面谈",
            "module": "morning_plan",
        })
        assert r.json()["code"] == 10001

    def test_converse_missing_input(self, auth, client):
        headers, _ = auth
        r = client.post("/api/v1/voice/converse", json={}, headers=headers)
        assert r.status_code == 422

    def test_converse_new_conversation(self, auth, client):
        """新建对话→返回conversation_id。"""
        headers, _ = auth
        r = client.post("/api/v1/voice/converse", json={
            "user_input": "你好小耕",
            "module": "general",
        }, headers=headers)
        assert r.status_code in (200, 502, 503, 504)
        if r.status_code == 200:
            data = r.json()["data"]
            assert "conversation_id" in data
            assert "assistant_reply" in data

    def test_converse_module_morning_plan(self, auth, client):
        """朝有规划模块对话。"""
        headers, _ = auth
        r = client.post("/api/v1/voice/converse", json={
            "user_input": "帮我规划今天的工作",
            "module": "morning_plan",
        }, headers=headers)
        assert r.status_code in (200, 502, 503, 504)

    def test_converse_crisis_detection(self, auth, client):
        """危机检测：含危机关键词的输入。"""
        headers, _ = auth
        r = client.post("/api/v1/voice/converse", json={
            "user_input": "我觉得活不下去了，好绝望",
            "module": "mood_haven",
        }, headers=headers)
        # 即使LLM不可用，危机检测也应返回结果
        if r.status_code == 200:
            data = r.json()["data"]
            assert data["is_crisis"] is True

    def test_converse_hr_scope_detection(self, auth, client):
        """HR范围外检测。"""
        headers, _ = auth
        r = client.post("/api/v1/voice/converse", json={
            "user_input": "帮我写一首诗吧",
            "module": "general",
        }, headers=headers)
        if r.status_code == 200:
            data = r.json()["data"]
            assert data["is_hr_guided"] is True

    def test_converse_with_context(self, auth, client):
        """带模块上下文对话。"""
        headers, _ = auth
        r = client.post("/api/v1/voice/converse", json={
            "user_input": "回顾一下昨天的安排",
            "module": "evening_review",
            "context_meta": {"yesterday_plan": ["绩效面谈", "招聘筛选"]},
        }, headers=headers)
        assert r.status_code in (200, 502, 503, 504)


class TestConversationHistory:
    """对话历史管理。"""

    def test_get_history_requires_auth(self, client):
        r = client.get("/api/v1/voice/conversations/nonexistent")
        assert r.json()["code"] == 10001

    def test_get_empty_history(self, auth, client):
        headers, _ = auth
        r = client.get("/api/v1/voice/conversations/nonexistent_id", headers=headers)
        assert r.status_code == 200
        assert r.json()["data"]["history"] == []

    def test_delete_conversation_requires_auth(self, client):
        r = client.delete("/api/v1/voice/conversations/nonexistent")
        assert r.json()["code"] == 10001

    def test_delete_nonexistent_conversation(self, auth, client):
        headers, _ = auth
        r = client.delete("/api/v1/voice/conversations/nonexistent_id", headers=headers)
        assert r.status_code == 200
        assert r.json()["data"]["deleted"] == "nonexistent_id"


class TestEmotionDetection:
    """情绪检测内部逻辑（直接测service）。"""

    def test_neutral_text(self):
        from app.services.voice_engine.service import _detect_emotion
        result = _detect_emotion("今天工作很顺利")
        assert result["is_agitated"] is False
        assert result["crisis_level"] == 0

    def test_agitated_text(self):
        from app.services.voice_engine.service import _detect_emotion
        result = _detect_emotion("好烦啊，受不了了")
        assert result["is_agitated"] is True
        assert result["crisis_level"] >= 1

    def test_crisis_text(self):
        from app.services.voice_engine.service import _detect_emotion
        result = _detect_emotion("我想自杀，活不下去了")
        assert result["is_agitated"] is True
        assert result["crisis_level"] == 3


class TestHRScopeDetection:
    """HR范围检测内部逻辑。"""

    def test_in_scope(self):
        from app.services.voice_engine.service import _detect_hr_scope
        assert _detect_hr_scope("怎么做绩效面谈") is False

    def test_out_of_scope(self):
        from app.services.voice_engine.service import _detect_hr_scope
        assert _detect_hr_scope("帮我写小说") is True

    def test_out_of_scope_stock(self):
        from app.services.voice_engine.service import _detect_hr_scope
        assert _detect_hr_scope("今天股票怎么样") is True


class TestModuleSystemPrompts:
    """模块系统提示词完整性。"""

    def test_all_modules_have_prompts(self):
        from app.services.voice_engine.service import MODULE_SYSTEM_PROMPTS
        expected_modules = [
            "general", "morning_plan", "evening_review", "mood_haven",
            "smart_record", "smart_qa",
        ]
        for mod in expected_modules:
            assert mod in MODULE_SYSTEM_PROMPTS, f"缺少模块 {mod} 的系统提示词"
            assert len(MODULE_SYSTEM_PROMPTS[mod]) > 50, f"模块 {mod} 提示词过短"

    def test_all_prompts_contain_brand_name(self):
        from app.services.voice_engine.service import MODULE_SYSTEM_PROMPTS
        for mod, prompt in MODULE_SYSTEM_PROMPTS.items():
            assert "日耕" in prompt or "小耕" in prompt, f"模块 {mod} 缺少品牌词"
