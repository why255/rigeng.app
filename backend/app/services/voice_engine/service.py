"""③语音/智能引擎服务 核心业务逻辑（P1）。

集成：
- 腾讯云 ASR（在线语音识别）
- Vosk（离线语音识别）
- 智谱AI GLM（大模型推理/生成）
- Anthropic Claude（大模型推理/生成，推荐）
- 多轮对话管理
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from ...shared.config import settings
from ...shared.errors import (
    APIError,
    E_LLM_TIMEOUT,
    E_OFFLINE_UNAVAILABLE,
)

logger = logging.getLogger("voice_engine")

# ═══════════════════════════════════════════════
# 离线 ASR 模型（惰性加载）
# ═══════════════════════════════════════════════
_vosk_model = None


def _get_vosk_model():
    global _vosk_model
    if _vosk_model is not None:
        return _vosk_model
    try:
        from vosk import Model

        _vosk_model = Model(settings.OFFLINE_ASR_MODEL_PATH)
        logger.info("Vosk离线ASR模型加载完成")
    except Exception as e:
        logger.warning("Vosk离线模型加载失败，离线识别不可用: %s", e)
        _vosk_model = False
    return _vosk_model


# ═══════════════════════════════════════════════
# 腾讯云 ASR（在线语音识别）
# ═══════════════════════════════════════════════
TENCENT_ASR_ENDPOINT = "asr.tencentcloudapi.com"


def _tencent_sign(service: str, action: str, payload: str, timestamp: int) -> dict[str, str]:
    """腾讯云 API v3 签名。"""
    secret_id = settings.TENCENT_ASR_SECRET_ID
    secret_key = settings.TENCENT_ASR_SECRET_KEY

    date = datetime.fromtimestamp(timestamp, tz=timezone.utc).strftime("%Y-%m-%d")
    algorithm = "TC3-HMAC-SHA256"

    # 1. CanonicalRequest
    http_request_method = "POST"
    canonical_uri = "/"
    canonical_querystring = ""
    canonical_headers = f"content-type:application/json; charset=utf-8\nhost:{service}\nx-tc-action:{action.lower()}\n"
    signed_headers = "content-type;host;x-tc-action"
    hashed_request_payload = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    canonical_request = f"{http_request_method}\n{canonical_uri}\n{canonical_querystring}\n{canonical_headers}\n{signed_headers}\n{hashed_request_payload}"

    # 2. StringToSign
    # ⚠️ service 参数在签名中提取纯服务名（去掉域名部分）
    _svc_name = service.split(".")[0] if "." in service else service
    credential_scope = f"{date}/{_svc_name}/tc3_request"
    hashed_canonical_request = hashlib.sha256(canonical_request.encode("utf-8")).hexdigest()
    string_to_sign = f"{algorithm}\n{timestamp}\n{credential_scope}\n{hashed_canonical_request}"

    # 3. Signature
    def _sign(key: bytes, msg: str) -> bytes:
        return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()

    k_date = _sign(("TC3" + secret_key).encode("utf-8"), date)
    k_service = _sign(k_date, _svc_name)
    k_signing = _sign(k_service, "tc3_request")
    signature = hmac.new(k_signing, string_to_sign.encode("utf-8"), hashlib.sha256).hexdigest()

    # 4. Authorization
    authorization = (
        f"{algorithm} Credential={secret_id}/{credential_scope}, "
        f"SignedHeaders={signed_headers}, Signature={signature}"
    )

    return {
        "Authorization": authorization,
        "Content-Type": "application/json; charset=utf-8",
        "Host": service,
        "X-TC-Action": action,
        "X-TC-Timestamp": str(timestamp),
        "X-TC-Version": "2019-06-14",
        "X-TC-Region": settings.TENCENT_ASR_REGION,
    }


def asr_online(audio_base64: str, audio_format: str = "wav", sample_rate: int = 16000, engine: str | None = None) -> dict[str, Any]:
    """A1 在线语音转文字（腾讯云 ASR）。

    Returns:
        {text, confidence, duration_ms}
    """
    import urllib.request

    engine = engine or settings.TENCENT_ASR_ENGINE
    timestamp = int(time.time())

    payload = json.dumps({
        "EngSerViceType": engine,
        "SourceType": 1,  # 原始音频
        "VoiceFormat": audio_format,
        "Data": audio_base64,
        "DataLen": len(audio_base64),
        "FilterDirty": 1,
        "FilterModal": 0,
        "ConvertNumMode": 1,
    })

    headers = _tencent_sign(TENCENT_ASR_ENDPOINT, "SentenceRecognition", payload, timestamp)

    try:
        req = urllib.request.Request(
            f"https://{TENCENT_ASR_ENDPOINT}",
            data=payload.encode("utf-8"),
            headers=headers,
        )
        with urllib.request.urlopen(req, timeout=settings.DOWNSTREAM_TIMEOUT_SECONDS) as resp:
            result = json.loads(resp.read().decode("utf-8"))

        if "Error" in result.get("Response", {}):
            err = result["Response"]["Error"]
            logger.error("腾讯云ASR错误: %s - %s", err.get("Code"), err.get("Message"))
            raise APIError(50001, f"语音识别失败: {err.get('Message', '未知错误')}", 400)

        return {
            "text": result["Response"].get("Result", ""),
            "confidence": result["Response"].get("Confidence", 0.0) / 100.0,
            "duration_ms": result["Response"].get("AudioDuration", 0),
            "engine_used": "tencent_online",
        }

    except APIError:
        raise
    except Exception as e:
        logger.exception("腾讯云ASR调用异常")
        raise APIError(50001, f"语音识别服务异常: {str(e)}", 503)


def asr_offline(audio_data: bytes, sample_rate: int = 16000) -> dict[str, Any]:
    """A2 离线语音转文字（Vosk）。"""
    if not settings.offline_asr_enabled:
        raise E_OFFLINE_UNAVAILABLE

    model = _get_vosk_model()
    if not model:
        raise E_OFFLINE_UNAVAILABLE

    try:
        from vosk import KaldiRecognizer

        rec = KaldiRecognizer(model, sample_rate)
        rec.SetWords(True)

        if rec.AcceptWaveform(audio_data):
            result = json.loads(rec.Result())
        else:
            result = json.loads(rec.FinalResult())

        text = result.get("text", "")
        confidence = result.get("confidence", 0.0) if result.get("confidence") else 0.5

        return {
            "text": text,
            "confidence": confidence,
            "duration_ms": 0,
            "engine_used": "vosk_offline",
        }
    except Exception as e:
        logger.exception("Vosk离线ASR异常")
        raise E_OFFLINE_UNAVAILABLE


def recognize_speech(audio_base64: str, audio_format: str = "wav", sample_rate: int = 16000,
                     prefer_offline: bool = False, engine: str | None = None) -> dict[str, Any]:
    """语音识别统一入口：优先在线，可切离线。"""
    # 离线优先模式
    if prefer_offline and settings.offline_asr_enabled:
        try:
            audio_data = base64.b64decode(audio_base64)
            result = asr_offline(audio_data, sample_rate)
            if result["confidence"] > 0.3:  # 离线置信度够用则返回
                return result
        except (APIError, Exception):
            pass  # 离线失败→降级到在线

    # 在线识别
    if not settings.TENCENT_ASR_SECRET_ID:
        # 未配置在线ASR→尝试离线
        if settings.offline_asr_enabled:
            audio_data = base64.b64decode(audio_base64)
            return asr_offline(audio_data, sample_rate)
        raise E_OFFLINE_UNAVAILABLE

    result = asr_online(audio_base64, audio_format, sample_rate, engine)

    # 低置信度告警
    if result["confidence"] < 0.5:
        logger.warning("ASR低置信度: %.2f, text=%s", result["confidence"], result["text"][:50])

    return result


# ═══════════════════════════════════════════════
# 智谱AI GLM（大模型推理/生成）
# ═══════════════════════════════════════════════
ZHIPUAI_ENDPOINT = "https://open.bigmodel.cn/api/paas/v4/chat/completions"


def llm_generate(prompt: str, system_prompt: str | None = None,
                 context: list[dict[str, str]] | None = None,
                 model: str | None = None, temperature: float | None = None,
                 max_tokens: int | None = None, stream: bool = False) -> dict[str, Any]:
    """A3/A4 LLM生成回答（智谱AI GLM）。"""
    import urllib.request

    if not settings.ZHIPUAI_API_KEY:
        raise APIError(50020, "AI引擎未配置API密钥", 503)

    model = model or settings.ZHIPUAI_MODEL
    temperature = temperature if temperature is not None else settings.ZHIPUAI_TEMPERATURE
    max_tokens = max_tokens or settings.ZHIPUAI_MAX_TOKENS

    # 构建 messages
    messages: list[dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    if context:
        messages.extend(context)
    messages.append({"role": "user", "content": prompt})

    body = json.dumps({
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": stream,
    }).encode("utf-8")

    headers = {
        "Authorization": f"Bearer {settings.ZHIPUAI_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        req = urllib.request.Request(ZHIPUAI_ENDPOINT, data=body, headers=headers)
        with urllib.request.urlopen(req, timeout=settings.DOWNSTREAM_TIMEOUT_SECONDS) as resp:
            result = json.loads(resp.read().decode("utf-8"))

        if "choices" not in result or not result["choices"]:
            raise APIError(50020, "大模型返回为空", 502)

        choice = result["choices"][0]
        return {
            "content": choice["message"]["content"],
            "model_used": result.get("model", model),
            "usage": {
                "prompt_tokens": result.get("usage", {}).get("prompt_tokens", 0),
                "completion_tokens": result.get("usage", {}).get("completion_tokens", 0),
                "total_tokens": result.get("usage", {}).get("total_tokens", 0),
            },
        }

    except APIError:
        raise
    except Exception as e:
        logger.exception("智谱AI调用异常")
        raise E_LLM_TIMEOUT


# ═══════════════════════════════════════════════
# 多轮对话管理
# ═══════════════════════════════════════════════
# 生产环境用 Redis，开发用内存（简化版）
_conversations: dict[str, list[dict[str, str]]] = {}

# 各模块的系统提示词（含品牌语 - 锁定书V1.1）
MODULE_SYSTEM_PROMPTS: dict[str, str] = {
    "general": (
        "你是日耕(RiGeng)的AI助手小耕，一位温暖而专业的HR顾问。"
        "日耕的使命是：日耕朝夕，耕愈工作，耕暖生活。"
        "你的回答风格：温暖鼓励，专业务实，简洁有力。"
    ),
    "morning_plan": (
        "你是朝有规划的AI助手小耕，帮助用户梳理每日计划。回复风格温暖简洁。\n"
        "收到用户计划后：先确认（1-2句），然后在末尾输出任务列表。"
    ),
    "evening_review": (
        "你是暮有复盘的AI助手小耕。暮有复盘的品牌语：经验可沉淀，行动成晶体。"
        "你引导用户进行五阶段复盘（回顾→分析→萃取→沉淀→行动），"
        "帮助用户把经验转化为SOP。风格：温柔坚持，用户说不想复盘时温和鼓励一次。"
    ),
    "mood_haven": (
        "你是情绪树洞的AI助手小耕。情绪树洞的品牌语：心事有处说，温暖不缺席。"
        "你倾听用户的情绪倾诉，给予温暖共情。注意检测危机信号（自伤/伤人倾向），"
        "一旦检测到立即触发危机干预协议。风格：极度温暖，绝对安全。"
    ),
    "smart_record": (
        "你是智能记录的AI助手小耕。智能记录的品牌语：所言成资产，回顾有痕迹。"
        "你帮助用户处理会议录音，提取关键行动项和决策点。"
    ),
    "smart_qa": (
        "你是智能问答的AI助手小耕。智能问答的品牌语：不懂就问它，答案不瞎编。"
        "你从三源知识库（私有库+携君库+互联网）中检索并回答问题，"
        "答案包含四要素：操作要点+注意事项+沟通话术+达成标准。"
        "不知道就说不知道，绝不编造。"
    ),
    "smart_office": (
        "你是智能办公的AI助手小耕。智能办公的品牌语：告别碎片化，高效又专业。"
        "你帮助用户生成HR专业文档（JD、薪酬方案、绩效制度、员工手册等），"
        "结合用户输入的信息，生成结构化的专业文档。"
    ),
    "smart_job": (
        "你是智能求职的AI助手小耕。智能求职的品牌语：求职有策略，步步有方向。"
        "你帮助用户进行职业规划、简历优化、面试准备、offer对比等求职相关任务，"
        "提供专业、实用的求职建议。"
    ),
}


def _detect_emotion(text: str) -> dict[str, Any]:
    """情绪/危机检测（简单关键词 + 规则，生产环境接专业模型）。"""
    crisis_keywords = ["自杀", "不想活", "死了算了", "结束生命", "自残", "伤害自己",
                       "想死", "活不下去", "没意义了", "绝望", "崩溃"]
    agitation_keywords = ["好烦", "气死", "受不了", "崩溃", "难过", "焦虑", "压抑",
                          "累死了", "撑不住", "想哭", "崩溃了"]

    text_lower = text.lower()
    is_crisis = any(kw in text for kw in crisis_keywords)
    is_agitated = is_crisis or any(kw in text for kw in agitation_keywords)

    crisis_level = 0
    crisis_reason = None
    if is_crisis:
        crisis_level = 3
        crisis_reason = "文本含危机关键词"
    elif is_agitated:
        crisis_level = 1
        crisis_reason = "文本含情绪激动关键词"

    return {
        "is_agitated": is_agitated,
        "emotion_label": "anxious" if is_agitated else "neutral",
        "crisis_level": crisis_level,
        "crisis_reason": crisis_reason,
    }


def _detect_hr_scope(text: str) -> bool:
    """检测是否超出HR范围（简单规则）。"""
    non_hr_keywords = ["天气预报", "股票", "彩票", "星座", "占卜",
                       "政治", "军事", "编程代码", "写小说", "写诗", "诗吧"]
    return any(kw in text for kw in non_hr_keywords)


# ═══════════════════════════════════════════════
# Anthropic Claude（推荐 LLM 提供商）
# ═══════════════════════════════════════════════
ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"


def llm_generate_anthropic(prompt: str, system_prompt: str | None = None,
                           context: list[dict[str, str]] | None = None,
                           model: str | None = None, temperature: float | None = None,
                           max_tokens: int | None = None) -> dict[str, Any]:
    """A3/A4 LLM生成回答（Anthropic Claude）。

    使用 Anthropic Messages API，支持 system prompt 和多轮对话上下文。
    """
    import urllib.request

    if not settings.ANTHROPIC_API_KEY:
        raise APIError(50020, "Anthropic API密钥未配置", 503)

    model = model or settings.ANTHROPIC_MODEL
    temperature = temperature if temperature is not None else settings.ANTHROPIC_TEMPERATURE
    max_tokens = max_tokens or settings.ANTHROPIC_MAX_TOKENS

    # 构建 messages（Anthropic 格式）
    messages: list[dict[str, Any]] = []
    if context:
        for msg in context:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": prompt})

    body = json.dumps({
        "model": model,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "system": system_prompt or "",
        "messages": messages,
    }).encode("utf-8")

    headers = {
        "x-api-key": settings.ANTHROPIC_API_KEY,
        "anthropic-version": ANTHROPIC_VERSION,
        "Content-Type": "application/json",
    }

    try:
        req = urllib.request.Request(ANTHROPIC_ENDPOINT, data=body, headers=headers)
        with urllib.request.urlopen(req, timeout=settings.DOWNSTREAM_TIMEOUT_SECONDS) as resp:
            result = json.loads(resp.read().decode("utf-8"))

        if "content" not in result:
            raise APIError(50020, "Claude返回为空", 502)

        # 提取文本内容
        text_blocks = [b for b in result["content"] if b.get("type") == "text"]
        content = "\n".join(b.get("text", "") for b in text_blocks)

        return {
            "content": content,
            "model_used": result.get("model", model),
            "provider": "anthropic",
            "usage": {
                "prompt_tokens": result.get("usage", {}).get("input_tokens", 0),
                "completion_tokens": result.get("usage", {}).get("output_tokens", 0),
                "total_tokens": (
                    result.get("usage", {}).get("input_tokens", 0)
                    + result.get("usage", {}).get("output_tokens", 0)
                ),
            },
        }

    except APIError:
        raise
    except Exception as e:
        logger.exception("Anthropic Claude调用异常")
        raise E_LLM_TIMEOUT


def llm_generate(prompt: str, system_prompt: str | None = None,
                 context: list[dict[str, str]] | None = None,
                 model: str | None = None, temperature: float | None = None,
                 max_tokens: int | None = None, stream: bool = False,
                 provider: str | None = None) -> dict[str, Any]:
    """A3/A4 LLM生成回答（统一入口，支持多提供商）。

    provider 优先级: 参数 > LLM_PROVIDER 配置 > "auto"
    "auto" 模式: 优先 Anthropic Claude，不可用时降级到智谱AI GLM
    """
    provider = provider or settings.LLM_PROVIDER

    # auto 模式：检测可用的提供商
    if provider == "auto":
        if settings.ANTHROPIC_API_KEY:
            provider = "anthropic"
        elif settings.ZHIPUAI_API_KEY:
            provider = "zhipu"
        else:
            raise APIError(50020, "未配置任何LLM提供商（Anthropic/智谱AI）", 503)

    # 按提供商分发
    if provider == "anthropic":
        try:
            return llm_generate_anthropic(
                prompt=prompt, system_prompt=system_prompt,
                context=context, model=model,
                temperature=temperature, max_tokens=max_tokens,
            )
        except APIError:
            # 如果配置了降级，尝试智谱AI
            if settings.ZHIPUAI_API_KEY and settings.LLM_PROVIDER == "auto":
                logger.warning("Anthropic调用失败，降级到智谱AI")
                return _llm_generate_zhipu(
                    prompt=prompt, system_prompt=system_prompt,
                    context=context, model=None,
                    temperature=temperature, max_tokens=max_tokens,
                    stream=stream,
                )
            raise

    # 智谱AI
    return _llm_generate_zhipu(
        prompt=prompt, system_prompt=system_prompt,
        context=context, model=model,
        temperature=temperature, max_tokens=max_tokens,
        stream=stream,
    )


def _llm_generate_zhipu(prompt: str, system_prompt: str | None = None,
                         context: list[dict[str, str]] | None = None,
                         model: str | None = None, temperature: float | None = None,
                         max_tokens: int | None = None, stream: bool = False) -> dict[str, Any]:
    """智谱AI GLM 原始实现（内部函数）。"""
    import urllib.request

    if not settings.ZHIPUAI_API_KEY:
        raise APIError(50020, "智谱AI API密钥未配置", 503)

    model = model or settings.ZHIPUAI_MODEL
    temperature = temperature if temperature is not None else settings.ZHIPUAI_TEMPERATURE
    max_tokens = max_tokens or settings.ZHIPUAI_MAX_TOKENS

    messages: list[dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    if context:
        messages.extend(context)
    messages.append({"role": "user", "content": prompt})

    body = json.dumps({
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": stream,
    }).encode("utf-8")

    headers = {
        "Authorization": f"Bearer {settings.ZHIPUAI_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        req = urllib.request.Request(ZHIPUAI_ENDPOINT, data=body, headers=headers)
        with urllib.request.urlopen(req, timeout=settings.DOWNSTREAM_TIMEOUT_SECONDS) as resp:
            result = json.loads(resp.read().decode("utf-8"))

        if "choices" not in result or not result["choices"]:
            raise APIError(50020, "大模型返回为空", 502)

        choice = result["choices"][0]
        return {
            "content": choice["message"]["content"],
            "model_used": result.get("model", model),
            "provider": "zhipu",
            "usage": {
                "prompt_tokens": result.get("usage", {}).get("prompt_tokens", 0),
                "completion_tokens": result.get("usage", {}).get("completion_tokens", 0),
                "total_tokens": result.get("usage", {}).get("total_tokens", 0),
            },
        }

    except APIError:
        raise
    except Exception as e:
        logger.exception("智谱AI调用异常")
        raise E_LLM_TIMEOUT


def converse(user_input: str, conversation_id: str | None = None,
             module: str = "general", context_meta: dict[str, Any] | None = None,
             provider: str | None = None,
             db: Any | None = None) -> dict[str, Any]:
    """A5 多轮对话统一入口。

    当 db 传入时，自动检索该模块的算法文件并注入 system prompt，
    实现「AI调用时优先检索管理员上传的算法文件」。
    """
    # 1. 情绪检测
    emotion = _detect_emotion(user_input)

    # 2. HR范围检测
    is_non_hr = _detect_hr_scope(user_input)

    # 3. 对话管理
    if conversation_id and conversation_id in _conversations:
        history = _conversations[conversation_id]
    else:
        conversation_id = f"conv_{uuid.uuid4().hex[:12]}"
        history = []

    # 获取模块系统提示词
    system_prompt = MODULE_SYSTEM_PROMPTS.get(module, MODULE_SYSTEM_PROMPTS["general"])

    # ★ 注入算法文件内容（管理员上传的模块算法优先检索）
    if db is not None and module != "general":
        try:
            from ..algorithm_admin.service import get_algorithms_for_module
            algo_content = get_algorithms_for_module(db, module)
            if algo_content:
                system_prompt += algo_content
                logger.info("算法文件已注入 system prompt: module=%s len=%d", module, len(algo_content))
        except Exception as e:
            logger.warning("算法文件检索失败（不影响主流程）: module=%s error=%s", module, e)

    # 添加模块上下文
    if context_meta:
        system_prompt += f"\n当前上下文: {json.dumps(context_meta, ensure_ascii=False)}"

    # 4. LLM推理（传递 provider 参数）
    try:
        llm_result = llm_generate(
            prompt=user_input,
            system_prompt=system_prompt,
            context=history,
            provider=provider,
        )
    except APIError:
        # LLM超时/不可用→返回温和降级回复
        return {
            "conversation_id": conversation_id,
            "assistant_reply": "小耕正在努力思考中，请稍等片刻再试~",
            "is_crisis": emotion["crisis_level"] >= 2,
            "is_hr_guided": is_non_hr,
            "suggestions": None,
            "provider": None,
        }

    # 5. 更新对话历史（保留最近20轮）
    history.append({"role": "user", "content": user_input})
    history.append({"role": "assistant", "content": llm_result["content"]})
    if len(history) > 40:  # 20轮×2条
        history = history[-40:]
    _conversations[conversation_id] = history

    # 6. 构建回复
    reply = llm_result["content"]

    # 危机干预嵌入（静默标记）
    if emotion["crisis_level"] >= 2:
        reply += "\n\n💙 如果此刻你需要专业支持：全国心理援助热线 400-161-9995（24小时免费）"

    # HR范围外温和引导
    if is_non_hr:
        reply = "姐，这个问题超出了小耕的HR专业范围呢~ 试试聊一些HR相关的话题吧，我会全力以赴帮你！"

    return {
        "conversation_id": conversation_id,
        "assistant_reply": reply,
        "is_crisis": emotion["crisis_level"] >= 2,
        "is_hr_guided": is_non_hr,
        "suggestions": None,
        "provider": llm_result.get("provider", "zhipu"),
    }
