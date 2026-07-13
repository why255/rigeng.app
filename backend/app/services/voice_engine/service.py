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

    # 解码Base64获取原始音频字节长度（腾讯云API要求DataLen=原始字节数，非Base64字符串长度）
    audio_bytes = base64.b64decode(audio_base64)

    payload = json.dumps({
        "EngSerViceType": engine,
        "SourceType": 1,  # 原始音频
        "VoiceFormat": audio_format,
        "Data": audio_base64,
        "DataLen": len(audio_bytes),
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
    """语音识别统一入口：腾讯云在线 → Vosk离线。

    引擎优先级（可自动降级）:
    1. 腾讯云 ASR（在线引擎）
    2. Vosk 离线 ASR（无网环境）
    """
    # 离线优先模式
    if prefer_offline and settings.offline_asr_enabled:
        try:
            audio_data = base64.b64decode(audio_base64)
            result = asr_offline(audio_data, sample_rate)
            if result["confidence"] > 0.3:
                return result
        except (APIError, Exception):
            pass

    # 在线识别：腾讯云 ASR
    if settings.TENCENT_ASR_SECRET_ID:
        try:
            result = asr_online(audio_base64, audio_format, sample_rate, engine)
            if result["confidence"] < 0.5:
                logger.warning("ASR低置信度: %.2f, text=%s", result["confidence"], result["text"][:50])
            return result
        except APIError:
            raise
        except Exception as e:
            logger.exception("腾讯云ASR调用异常")
            raise APIError(50001, f"语音识别服务异常: {str(e)}", 503)

    # 离线兜底
    if settings.offline_asr_enabled:
        audio_data = base64.b64decode(audio_base64)
        return asr_offline(audio_data, sample_rate)

    raise E_OFFLINE_UNAVAILABLE


# ═══════════════════════════════════════════════
# 腾讯云实时语音识别 WebSocket（流式 ASR）
# ═══════════════════════════════════════════════
TENCENT_ASR_WS_ENDPOINT = "asr.cloud.tencent.com"
TENCENT_ASR_WS_PATH = "/asr/v2/"


def get_realtime_asr_auth() -> dict[str, Any]:
    """生成腾讯云实时语音识别 WebSocket 连接所需的签名参数。

    返回前端可直接用于连接 Tencent Cloud ASR WebSocket 的参数。
    WebSocket URL: wss://asr.cloud.tencent.com/asr/v2/{appid}

    Returns:
        {"ws_url": "wss://...", "voice_id": "xxx", "appid": "xxx", ...}
    """
    import hashlib as _hl

    secret_id = settings.TENCENT_ASR_SECRET_ID
    secret_key = settings.TENCENT_ASR_SECRET_KEY
    if not secret_id or not secret_key:
        raise APIError(50001, "腾讯云ASR未配置密钥（TENCENT_ASR_SECRET_ID/SECRET_KEY）", 503)

    # 获取 appid — 从配置读取或使用默认值
    appid = getattr(settings, "TENCENT_ASR_APPID", None)
    if not appid:
        # 尝试从 SecretId 推导（Tencent Cloud SecretId 格式: AKIDxxxx）
        raise APIError(50001, "请配置 TENCENT_ASR_APPID（腾讯云账号APPID）", 503)

    timestamp = int(time.time())
    expired = timestamp + 86400  # 24小时有效
    nonce = timestamp * 1000 + int(time.time() * 1000) % 1000
    voice_id = str(uuid.uuid4())

    # 构建签名 — 腾讯云实时ASR使用 HMAC-SHA1 + Base64
    sign_str = f"{TENCENT_ASR_WS_ENDPOINT}{TENCENT_ASR_WS_PATH}{appid}"
    signature = base64.b64encode(
        hmac.new(secret_key.encode("utf-8"), sign_str.encode("utf-8"), hashlib.sha1).digest()
    ).decode("utf-8")

    ws_url = (
        f"wss://{TENCENT_ASR_WS_ENDPOINT}{TENCENT_ASR_WS_PATH}{appid}"
        f"?secretid={secret_id}"
        f"&timestamp={timestamp}"
        f"&expired={expired}"
        f"&nonce={nonce}"
        f"&voice_id={voice_id}"
        f"&signature={signature}"
    )

    logger.info("实时ASR签名已生成: voice_id=%s", voice_id)

    return {
        "ws_url": ws_url,
        "voice_id": voice_id,
        "appid": str(appid),
        "engine_model_type": settings.TENCENT_ASR_ENGINE,
        "expired": expired,
    }


# ═══════════════════════════════════════════════
# 智谱AI GLM endpoint（保留用于 _call_zhipu_api）
# ═══════════════════════════════════════════════
ZHIPUAI_ENDPOINT = "https://open.bigmodel.cn/api/paas/v4/chat/completions"


# ═══════════════════════════════════════════════
# 多轮对话管理
# ═══════════════════════════════════════════════
# 生产环境用 Redis，开发用内存（简化版）
_conversations: dict[str, list[dict[str, str]]] = {}

# ═══════════════════════════════════════════════
# 各模块的系统提示词（含品牌语 - 锁定书V1.1）
# ⚠️ DEPRECATED: 推荐使用 engines.persona.build_persona_prompt() 替代。
#   该函数提供三层叠加式persona系统（核心人设→模块场景→用户状态），
#   比此处的静态prompt更完整，严格遵循《日耕模块算法设计文档_V2.0》。
#   此字典保留用于向后兼容，新模块请使用 engines.persona。
# ═══════════════════════════════════════════════
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
    """情绪/危机检测 — 委托给 emotion_service.analyze_emotion（三层检测融合算法）。

    使用延迟导入避免循环依赖（emotion_service -> llm_orchestrator -> voice_engine）。
    """
    try:
        from ..emotion_service.service import analyze_emotion
        return analyze_emotion(text)
    except Exception as e:
        logger.warning("emotion_service.analyze_emotion 不可用，使用本地简易检测: %s", e)

    # === 本地简易回退（原有关键词匹配） ===
    crisis_keywords = ["自杀", "不想活", "死了算了", "结束生命", "自残", "伤害自己",
                       "想死", "活不下去", "没意义了", "绝望", "崩溃"]
    agitation_keywords = ["好烦", "气死", "受不了", "崩溃", "难过", "焦虑", "压抑",
                          "累死了", "撑不住", "想哭", "崩溃了"]

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
                 provider: str | None = None,
                 user_id: str | None = None, db=None,
                 module: str | None = None) -> dict[str, Any]:
    """A3/A4 LLM生成回答（统一入口，支持多提供商）。

    模型/提供商选择优先级（高→低）:
      1. 调用方显式传入 model + provider 参数
      2. 管理员后台 module→模型绑定（ModuleModelBinding 表）★ 所有模块AI模型版本受管理员控制
      3. 用户模型偏好（user_auth.get_preferred_model）
      4. LLM_PROVIDER 全局配置

    provider 可选值: "volcano" / "dashscope" / "hunyuan" / "kimi" / "deepseek" / "zhipu" / "anthropic" / "auto"

    module: 可选，传入后自动从 DB 读取管理员配置的模块→模型绑定（惰性导入避免循环依赖）。
    """
    # ★ 1) 管理员后台模块→模型绑定（最高优先级，仅当 model + provider 都未显式传入时生效）
    if module and model is None and provider is None and db is not None:
        try:
            from ..engines.llm_orchestrator import select_model
            model, provider = select_model(module, db=db)
        except Exception:
            pass  # DB 不可用时降级到后续逻辑

    # 2) 读取用户模型偏好（如果未显式指定模型且未被模块绑定覆盖）
    if model is None and user_id and db is not None:
        try:
            from ..user_auth.service import get_preferred_model
            pref = get_preferred_model(db, user_id)
            model = pref["model"]
        except Exception:
            pass  # 降级到提供商默认模型

    provider = provider or settings.LLM_PROVIDER

    # ═══ 多提供商路由分发 ═══

    # 显式指定 provider
    if provider == "volcano":
        return llm_generate_volcano(
            prompt=prompt, system_prompt=system_prompt,
            context=context, model=model,
            temperature=temperature, max_tokens=max_tokens,
        )
    elif provider == "dashscope":
        return llm_generate_dashscope(
            prompt=prompt, system_prompt=system_prompt,
            context=context, model=model,
            temperature=temperature, max_tokens=max_tokens,
        )
    elif provider == "hunyuan":
        return llm_generate_hunyuan(
            prompt=prompt, system_prompt=system_prompt,
            context=context, model=model,
            temperature=temperature, max_tokens=max_tokens,
        )
    elif provider == "kimi":
        return llm_generate_kimi(
            prompt=prompt, system_prompt=system_prompt,
            context=context, model=model,
            temperature=temperature, max_tokens=max_tokens,
        )
    elif provider == "deepseek":
        return llm_generate_deepseek(
            prompt=prompt, system_prompt=system_prompt,
            context=context, model=model,
            temperature=temperature, max_tokens=max_tokens,
        )
    elif provider == "zhipu":
        return _llm_generate_zhipu(
            prompt=prompt, system_prompt=system_prompt,
            context=context, model=model,
            temperature=temperature, max_tokens=max_tokens,
            stream=stream,
        )
    elif provider == "anthropic":
        return llm_generate_anthropic(
            prompt=prompt, system_prompt=system_prompt,
            context=context, model=model,
            temperature=temperature, max_tokens=max_tokens,
        )

    # auto 模式：优先火山引擎（豆包），按顺序尝试可用提供商
    if provider == "auto":
        providers = [
            ("volcano", settings.VOLCANO_API_KEY, llm_generate_volcano),
            ("dashscope", settings.DASHSCOPE_API_KEY, llm_generate_dashscope),
            ("anthropic", settings.ANTHROPIC_API_KEY, llm_generate_anthropic),
            ("zhipu", settings.ZHIPUAI_API_KEY, _llm_generate_zhipu),
            ("deepseek", settings.DEEPSEEK_API_KEY, llm_generate_deepseek),
            ("kimi", settings.KIMI_API_KEY, llm_generate_kimi),
        ]
        for prov_name, api_key, func in providers:
            if api_key:
                try:
                    return func(
                        prompt=prompt, system_prompt=system_prompt,
                        context=context, model=model,
                        temperature=temperature, max_tokens=max_tokens,
                    )
                except APIError:
                    logger.warning("auto模式: %s 调用失败，尝试下一个提供商", prov_name)
                    continue
        raise APIError(50020, "所有LLM提供商均不可用，请检查API密钥配置", 503)

    raise APIError(50020, f"不支持的LLM提供商: {provider}", 400)


def _llm_generate_zhipu(prompt: str, system_prompt: str | None = None,
                         context: list[dict[str, str]] | None = None,
                         model: str | None = None, temperature: float | None = None,
                         max_tokens: int | None = None, stream: bool = False) -> dict[str, Any]:
    """智谱AI GLM 原始实现（内部函数）。

    支持余额不足时自动降级到备用模型列表。
    """
    import urllib.request

    if not settings.ZHIPUAI_API_KEY:
        raise APIError(50020, "智谱AI API密钥未配置", 503)

    model = model or settings.ZHIPUAI_MODEL
    temperature = temperature if temperature is not None else settings.ZHIPUAI_TEMPERATURE
    max_tokens = max_tokens or settings.ZHIPUAI_MAX_TOKENS

    # 构建需要尝试的模型列表：用户选择的模型 + 降级备用模型
    models_to_try = [model]
    fallback_models = getattr(settings, "ZHIPUAI_FALLBACK_MODELS", [])
    for fb in fallback_models:
        if fb not in models_to_try:
            models_to_try.append(fb)

    last_error: Exception | None = None

    for m in models_to_try:
        try:
            return _call_zhipu_api(
                prompt=prompt, system_prompt=system_prompt, context=context,
                model=m, temperature=temperature, max_tokens=max_tokens,
                stream=stream,
            )
        except _BalanceInsufficientError:
            if m != models_to_try[-1]:
                logger.warning("智谱AI模型 %s 余额不足，尝试降级到 %s", m,
                               models_to_try[models_to_try.index(m) + 1])
                continue
            raise E_LLM_TIMEOUT from None
        except APIError:
            raise
        except Exception as e:
            last_error = e
            if m != models_to_try[-1]:
                logger.warning("智谱AI模型 %s 调用失败: %s，尝试降级", m, e)
                continue

    if last_error:
        logger.exception("智谱AI所有模型调用失败")
    raise E_LLM_TIMEOUT


class _BalanceInsufficientError(Exception):
    """智谱AI余额不足（错误码1113）。"""


def _call_zhipu_api(prompt: str, system_prompt: str | None = None,
                     context: list[dict[str, str]] | None = None,
                     model: str | None = None, temperature: float | None = None,
                     max_tokens: int | None = None, stream: bool = False) -> dict[str, Any]:
    """单次调用智谱AI API。余额不足时抛 _BalanceInsufficientError。"""
    import urllib.request

    model = model or settings.ZHIPUAI_MODEL
    messages: list[dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    if context:
        messages.extend(context)
    messages.append({"role": "user", "content": prompt})

    body = json.dumps({
        "model": model,
        "messages": messages,
        "temperature": temperature if temperature is not None else settings.ZHIPUAI_TEMPERATURE,
        "max_tokens": max_tokens or settings.ZHIPUAI_MAX_TOKENS,
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
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        try:
            err_data = json.loads(err_body)
            err_code = str(err_data.get("error", {}).get("code", ""))
            err_msg = err_data.get("error", {}).get("message", "")
            # 余额不足 — 向上抛特殊异常，由外层尝试降级
            if err_code == "1113":
                raise _BalanceInsufficientError(err_msg)
            raise APIError(50020, f"大模型错误({err_code}): {err_msg}", 502)
        except (_BalanceInsufficientError, APIError):
            raise
        except Exception:
            raise APIError(50020, f"大模型HTTP错误({e.code})", 502)

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


# ═══════════════════════════════════════════════
# 通用 OpenAI 兼容 API 客户端
# 豆包(火山引擎) / 通义千问(阿里云) / Kimi(月之暗面) / DeepSeek
# 均使用 OpenAI 兼容的 /v1/chat/completions 接口
# ═══════════════════════════════════════════════

def _openai_compatible_generate(
    prompt: str,
    *,
    base_url: str,
    api_key: str,
    model: str,
    system_prompt: str | None = None,
    context: list[dict[str, str]] | None = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
    provider_name: str = "openai_compatible",
) -> dict[str, Any]:
    """通用 OpenAI 兼容接口调用。

    适用于: 火山引擎(豆包)、阿里云DashScope(通义千问)、月之暗面(Kimi)、DeepSeek
    """
    import urllib.request

    if not api_key:
        raise APIError(50020, f"{provider_name} API密钥未配置", 503)

    # 构建 messages
    messages: list[dict[str, Any]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    if context:
        for msg in context:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role in ("user", "assistant", "system"):
                messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": prompt})

    endpoint = f"{base_url.rstrip('/')}/chat/completions"
    body = json.dumps({
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }).encode("utf-8")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        req = urllib.request.Request(endpoint, data=body, headers=headers)
        with urllib.request.urlopen(req, timeout=settings.DOWNSTREAM_TIMEOUT_SECONDS) as resp:
            result = json.loads(resp.read().decode("utf-8"))

        if "choices" not in result or not result["choices"]:
            raise APIError(50020, f"{provider_name}返回为空", 502)

        choice = result["choices"][0]
        return {
            "content": choice["message"]["content"],
            "model_used": result.get("model", model),
            "provider": provider_name,
            "usage": {
                "prompt_tokens": result.get("usage", {}).get("prompt_tokens", 0),
                "completion_tokens": result.get("usage", {}).get("completion_tokens", 0),
                "total_tokens": result.get("usage", {}).get("total_tokens", 0),
            },
        }

    except APIError:
        raise
    except Exception as e:
        logger.exception("%s调用异常", provider_name)
        raise E_LLM_TIMEOUT


# ═══════════════════════════════════════════════
# 字节火山引擎 — 豆包 Seed 2.0 Pro（Excel #1 AI对话主模块）
# ═══════════════════════════════════════════════

def llm_generate_volcano(
    prompt: str,
    system_prompt: str | None = None,
    context: list[dict[str, str]] | None = None,
    model: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> dict[str, Any]:
    """豆包 Seed 2.0 Pro — AI对话主模块（小耕人设/晨间/暮省/树洞/问答）。"""
    return _openai_compatible_generate(
        prompt=prompt,
        base_url=settings.VOLCANO_BASE_URL,
        api_key=settings.VOLCANO_API_KEY,
        model=model or settings.VOLCANO_CHAT_MODEL,
        system_prompt=system_prompt,
        context=context,
        temperature=temperature if temperature is not None else settings.VOLCANO_TEMPERATURE,
        max_tokens=max_tokens or settings.VOLCANO_MAX_TOKENS,
        provider_name="volcano",
    )


# ═══════════════════════════════════════════════
# 阿里云 DashScope — 通义千问 Qwen3.7-Max（Excel #2 HR模板）
# ═══════════════════════════════════════════════

def llm_generate_dashscope(
    prompt: str,
    system_prompt: str | None = None,
    context: list[dict[str, str]] | None = None,
    model: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> dict[str, Any]:
    """通义千问 Qwen3.7-Max — HR专业模板生成、实时语音对话。"""
    return _openai_compatible_generate(
        prompt=prompt,
        base_url=settings.DASHSCOPE_BASE_URL,
        api_key=settings.DASHSCOPE_API_KEY,
        model=model or settings.DASHSCOPE_CHAT_MODEL,
        system_prompt=system_prompt,
        context=context,
        temperature=temperature if temperature is not None else settings.DASHSCOPE_TEMPERATURE,
        max_tokens=max_tokens or settings.DASHSCOPE_MAX_TOKENS,
        provider_name="dashscope",
    )


# ═══════════════════════════════════════════════
# 月之暗面 Kimi K2.5（Excel #4 私有知识库问答）
# ═══════════════════════════════════════════════

def llm_generate_kimi(
    prompt: str,
    system_prompt: str | None = None,
    context: list[dict[str, str]] | None = None,
    model: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> dict[str, Any]:
    """Kimi K2.5 — 私有知识库问答，超大上下文窗口。"""
    return _openai_compatible_generate(
        prompt=prompt,
        base_url=settings.KIMI_BASE_URL,
        api_key=settings.KIMI_API_KEY,
        model=model or settings.KIMI_MODEL,
        system_prompt=system_prompt,
        context=context,
        temperature=temperature if temperature is not None else settings.KIMI_TEMPERATURE,
        max_tokens=max_tokens or settings.KIMI_MAX_TOKENS,
        provider_name="kimi",
    )


# ═══════════════════════════════════════════════
# DeepSeek V4-Pro（Excel #9 工作诊断&成长分析）
# ═══════════════════════════════════════════════

def llm_generate_deepseek(
    prompt: str,
    system_prompt: str | None = None,
    context: list[dict[str, str]] | None = None,
    model: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> dict[str, Any]:
    """DeepSeek V4-Pro — 工作诊断、成长分析、逻辑推理。"""
    return _openai_compatible_generate(
        prompt=prompt,
        base_url=settings.DEEPSEEK_BASE_URL,
        api_key=settings.DEEPSEEK_API_KEY,
        model=model or settings.DEEPSEEK_MODEL,
        system_prompt=system_prompt,
        context=context,
        temperature=temperature if temperature is not None else settings.DEEPSEEK_TEMPERATURE,
        max_tokens=max_tokens or settings.DEEPSEEK_MAX_TOKENS,
        provider_name="deepseek",
    )


# ═══════════════════════════════════════════════
# 腾讯混元 Hy3（Excel #3 智能会议纪要）
# ═══════════════════════════════════════════════

def llm_generate_hunyuan(
    prompt: str,
    system_prompt: str | None = None,
    context: list[dict[str, str]] | None = None,
    model: str | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> dict[str, Any]:
    """腾讯混元 Hy3 — 智能会议纪要（使用腾讯云API v3签名）。"""
    import urllib.request

    if not settings.HUNYUAN_SECRET_ID or not settings.HUNYUAN_SECRET_KEY:
        raise APIError(50020, "腾讯混元API密钥未配置（HUNYUAN_SECRET_ID/SECRET_KEY）", 503)

    model = model or settings.HUNYUAN_MODEL
    temperature = temperature if temperature is not None else settings.HUNYUAN_TEMPERATURE
    max_tokens = max_tokens or settings.HUNYUAN_MAX_TOKENS

    # 构建 messages
    messages: list[dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    if context:
        messages.extend(context)
    messages.append({"role": "user", "content": prompt})

    timestamp = int(time.time())
    payload = json.dumps({
        "Model": model,
        "Messages": messages,
        "Temperature": temperature,
        "TopP": 0.8,
    })

    # 使用腾讯云API v3签名
    service = "hunyuan.tencentcloudapi.com"
    headers = _tencent_sign(service, "ChatCompletions", payload, timestamp)
    headers["X-TC-Version"] = "2023-09-01"

    try:
        req = urllib.request.Request(
            f"https://{service}",
            data=payload.encode("utf-8"),
            headers=headers,
        )
        with urllib.request.urlopen(req, timeout=settings.DOWNSTREAM_TIMEOUT_SECONDS) as resp:
            result = json.loads(resp.read().decode("utf-8"))

        if "Error" in result.get("Response", {}):
            err = result["Response"]["Error"]
            raise APIError(50020, f"腾讯混元错误: {err.get('Message', '未知错误')}", 502)

        choices = result["Response"].get("Choices", [])
        if not choices:
            raise APIError(50020, "腾讯混元返回为空", 502)

        content = choices[0]["Message"]["Content"]
        usage = result["Response"].get("Usage", {})
        return {
            "content": content,
            "model_used": result["Response"].get("Model", model),
            "provider": "hunyuan",
            "usage": {
                "prompt_tokens": usage.get("PromptTokens", 0),
                "completion_tokens": usage.get("CompletionTokens", 0),
                "total_tokens": usage.get("TotalTokens", 0),
            },
        }

    except APIError:
        raise
    except Exception as e:
        logger.exception("腾讯混元调用异常")
        raise E_LLM_TIMEOUT


# ═══════════════════════════════════════════════
# 通义千问 Qwen3.5-Omni ASR（Excel #5 语音识别）
# ═══════════════════════════════════════════════

# DashScope 多模态生成端点（Qwen Omni 系列）
DASHSCOPE_MULTIMODAL_ENDPOINT = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"


def asr_qwen_omni(audio_base64: str, audio_format: str = "wav", sample_rate: int = 16000,
                  model: str | None = None) -> dict[str, Any]:
    """通义千问 Qwen3.5-Omni — 语音转文字（Excel #5，默认在线ASR引擎）。

    使用 DashScope 多模态 API，直接传入 Base64 音频 → 返回转写文本。
    替代已停服的通义听悟（TINGWU），无需 AppKey，无需 OSS 上传。

    优势：
    - 支持 Base64 音频直传（无需先上传 OSS）
    - 同步返回，延迟 ~0.5-2s
    - 16kHz 单声道 WAV 最优

    Args:
        audio_base64: Base64 编码的音频数据（WAV/PCM 格式）
        audio_format: 音频格式（wav/webm 等，用于 data URI MIME type）
        sample_rate: 采样率 Hz，默认 16000

    Returns:
        {"text": str, "confidence": float, "duration_ms": int, "engine_used": str}
    """
    import urllib.request

    if not settings.DASHSCOPE_API_KEY:
        raise APIError(50001, "DashScope API密钥未配置（DASHSCOPE_API_KEY）", 503)

    model = model or getattr(settings, "ASR_OMNI_MODEL", "qwen3.5-omni-flash")
    mime_type = "audio/webm" if audio_format == "webm" else "audio/wav"
    data_uri = f"data:{mime_type};base64,{audio_base64}"

    body = json.dumps({
        "model": model,
        "input": {
            "messages": [{
                "role": "user",
                "content": [
                    {"audio": data_uri},
                    {"text": "请直接输出这段语音的转写文本，只输出文本内容，不要添加任何前缀、解释或标点修饰。"},
                ],
            }],
        },
        "parameters": {
            "temperature": 0.1,
            "max_tokens": 4096,
        },
    }).encode("utf-8")

    headers = {
        "Authorization": f"Bearer {settings.DASHSCOPE_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        req = urllib.request.Request(DASHSCOPE_MULTIMODAL_ENDPOINT, data=body, headers=headers)
        with urllib.request.urlopen(req, timeout=settings.DOWNSTREAM_TIMEOUT_SECONDS) as resp:
            result = json.loads(resp.read().decode("utf-8"))

        # 提取文本内容
        choices = result.get("output", {}).get("choices", [])
        if not choices:
            raise APIError(50001, "通义千问ASR返回为空", 502)

        text_parts = []
        for part in choices[0].get("message", {}).get("content", []):
            if isinstance(part, dict) and part.get("text"):
                text_parts.append(part["text"])

        text = "".join(text_parts).strip()

        # 计算音频时长（估算：PCM 16bit 16kHz 单声道 ≈ 32KB/s）
        audio_bytes = base64.b64decode(audio_base64)
        duration_ms = int(len(audio_bytes) / 32)  # 粗略估算

        return {
            "text": text,
            "confidence": 0.85,  # Omni 不返回置信度，实测准确率高
            "duration_ms": duration_ms,
            "engine_used": f"qwen_omni_{model}",
        }

    except APIError:
        raise
    except Exception as e:
        logger.exception("通义千问ASR调用异常")
        raise APIError(50001, f"语音识别服务异常: {str(e)}", 503)


# 保留旧函数名作为别名，向后兼容
def asr_tingwu(audio_base64: str, audio_format: str = "wav", sample_rate: int = 16000) -> dict[str, Any]:
    """[已废弃] 通义听悟已停服，自动路由到通义千问 Omni ASR。"""
    logger.info("asr_tingwu 已废弃，自动路由到 asr_qwen_omni")
    return asr_qwen_omni(audio_base64, audio_format, sample_rate)


def converse(user_input: str, conversation_id: str | None = None,
             module: str = "general", context_meta: dict[str, Any] | None = None,
             provider: str | None = None,
             user_id: str | None = None,
             db: Any | None = None) -> dict[str, Any]:
    """A5 多轮对话统一入口。

    当 db 传入时，自动检索该模块的算法文件并注入 system prompt，
    实现「AI调用时优先检索管理员上传的算法文件」。
    当 user_id + db 传入时，读取用户模型偏好并传递给 LLM。
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

    # 4. LLM推理（传递 provider + 用户模型偏好）
    try:
        # 读取用户模型偏好
        user_model = None
        if user_id and db is not None:
            try:
                from ..user_auth.service import get_preferred_model
                pref = get_preferred_model(db, user_id)
                user_model = pref["model"]
            except Exception:
                pass  # 兜底使用全局配置

        llm_result = llm_generate(
            prompt=user_input,
            system_prompt=system_prompt,
            context=history,
            model=user_model,
            provider=provider,
            module=module,
            user_id=user_id,
            db=db,
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


# ═══════════════════════════════════════════════
# 语音全链路引擎增强 (SK-4.3-01)
# ═══════════════════════════════════════════════

# 方言识别增强 — System Prompt注入方言提示
DIALECT_AWARENESS_PROMPT = (
    "用户可能使用方言表达，请识别口音并理解方言词汇。"
    "遇到不确定的词：优先根据上下文推测，推测失败的标注[?]并温柔确认。"
    "支持的方言: 四川话(川渝特色词汇)、粤语(广府话常见词汇)、"
    "东北话(东北特色词汇)、吴语(上海话常见词汇)。"
)

# 语音状态存储
_voice_sessions: dict[str, dict] = {}  # session_id -> state


class VoiceSilenceGuardian:
    """30秒静默守护。

    30秒 → 温柔提醒"小耕还在听哦~"
    60秒 → 自动暂停，保留已转录内容
    提醒风格：关切而非催促，绝不用「您还在吗？」(催促感)
    """

    SILENCE_NUDGE_SECONDS = 30
    SILENCE_PAUSE_SECONDS = 60

    @staticmethod
    def check(session_id: str, last_speech_time: float) -> dict:
        """检查静默时长并返回对应动作。

        Returns:
            {"action": "continue"|"nudge"|"pause", "message": str|None}
        """
        import time
        elapsed = time.time() - last_speech_time

        if elapsed >= VoiceSilenceGuardian.SILENCE_PAUSE_SECONDS:
            _voice_sessions.pop(session_id, None)
            return {
                "action": "pause",
                "message": "姐，小耕先去旁边等一下，您随时可以叫我~",
            }

        if elapsed >= VoiceSilenceGuardian.SILENCE_NUDGE_SECONDS:
            return {
                "action": "nudge",
                "message": "姐，小耕还在听哦~",
            }

        return {"action": "continue", "message": None}


class VoiceInterruptionHandler:
    """语音中断续接 — 打断时自动保存上下文快照。"""

    SNAPSHOT_TTL_SECONDS = 600  # 10分钟有效期

    @staticmethod
    def save_snapshot(session_id: str, session_state: dict) -> None:
        """打断时保存上下文快照。"""
        snapshot = {
            "session_id": session_id,
            "last_sop_step": session_state.get("current_step"),
            "transcribed_so_far": session_state.get("transcript", ""),
            "extracted_items": session_state.get("extracted_items", []),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        # 内存存储（生产环境用 Redis: redis.setex(f"voice_snapshot:{session_id}", 600, snapshot)）
        _voice_sessions[f"snapshot_{session_id}"] = snapshot
        logger.info("语音中断上下文已保存: session=%s", session_id)

    @staticmethod
    def try_resume(session_id: str) -> dict:
        """尝试恢复上下文。"""
        snapshot_key = f"snapshot_{session_id}"
        snapshot = _voice_sessions.get(snapshot_key)

        if snapshot:
            try:
                snap_time = datetime.fromisoformat(snapshot["timestamp"])
                elapsed = (datetime.now(timezone.utc) - snap_time).total_seconds()
                if elapsed < VoiceInterruptionHandler.SNAPSHOT_TTL_SECONDS:
                    _voice_sessions.pop(snapshot_key, None)
                    return {
                        "mode": "resume",
                        "message": "姐，刚才断了一下。咱们接着来？",
                        "context": snapshot,
                    }
            except (ValueError, KeyError):
                pass

        return {
            "mode": "restart",
            "message": "姐，刚才出了点状况，咱们重新来？",
        }


# ═══════════════════════════════════════════════
# TTS语音合成（小耕说话）
# ═══════════════════════════════════════════════

def tts_speak(text: str, emotion_context: str = "neutral", voice: str = "zhitian_emo",
              audio_format: str = "mp3") -> dict:
    """TTS语音合成 — 小耕说话（阿里云通义TTS-HD — Excel #6）。

    使用阿里云 DashScope 通义千问 TTS-HD 模型：
    - 小耕专属温柔治愈女声
    - 支持情绪语调适配
    - 高清人声输出

    Args:
        text: 要合成的文本
        emotion_context: 情绪上下文 (neutral/sad/anxious/low/happy)
        voice: 音色标识 (默认: zhitian_emo 温柔女声)
        audio_format: 输出格式 (mp3/wav/pcm)

    Returns:
        {
            "audio_base64": str,   # Base64编码的音频数据
            "audio_format": str,   # 音频格式
            "engine": str,         # 引擎名称
            "text": str,           # 原始文本
            "speed": float,        # 实际语速
        }
    """
    import urllib.request

    # 情绪→语速映射
    emotion_speed_map = {
        "sad": 0.85,
        "anxious": 0.9,
        "low": 0.9,
        "neutral": 1.0,
        "happy": 1.05,
    }
    speed = emotion_speed_map.get(emotion_context, 1.0)

    if not settings.DASHSCOPE_API_KEY:
        # 未配置阿里云API → 降级返回参数给前端
        logger.warning("DashScope API未配置，TTS降级为参数模式")
        return {
            "audio_base64": "",
            "audio_format": audio_format,
            "engine": "aliyun_tts_params_only",
            "text": text,
            "speed": speed,
            "pitch": 0.0,
            "volume": 1.0,
        }

    # 调用阿里云 DashScope TTS API
    endpoint = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"
    body = json.dumps({
        "model": settings.DASHSCOPE_TTS_MODEL,  # qwen-tts-hd
        "input": {
            "messages": [{
                "role": "user",
                "content": [{"text": text}],
            }],
        },
        "parameters": {
            "text_type": "PlainText",
            "voice": voice,
            "format": audio_format,
            "sample_rate": 24000,
            "speed": speed,
            "volume": 50,
        },
    }).encode("utf-8")

    headers = {
        "Authorization": f"Bearer {settings.DASHSCOPE_API_KEY}",
        "Content-Type": "application/json",
        "X-DashScope-OssResourceResolve": "enable",  # 返回可下载URL而非Base64
    }

    try:
        req = urllib.request.Request(endpoint, data=body, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=settings.DOWNSTREAM_TIMEOUT_SECONDS) as resp:
            result = json.loads(resp.read().decode("utf-8"))

        output = result.get("output", {})
        audio_url = output.get("audio", {}).get("url", "")

        logger.info(
            "TTS合成成功: text_len=%d emotion=%s voice=%s speed=%.2f",
            len(text), emotion_context, voice, speed,
        )

        return {
            "audio_url": audio_url,      # 音频文件OSS URL（有效期24h）
            "audio_format": audio_format,
            "engine": "aliyun_tts_hd",
            "text": text,
            "speed": speed,
            "voice": voice,
            "request_id": result.get("request_id", ""),
        }

    except Exception as e:
        logger.exception("阿里云TTS调用异常，降级为参数模式")
        # 降级：返回参数让前端自行合成
        return {
            "audio_base64": "",
            "audio_format": audio_format,
            "engine": "aliyun_tts_fallback",
            "text": text,
            "speed": speed,
            "pitch": 0.0,
            "volume": 1.0,
        }


def build_voice_system_prompt(module: str, enable_dialect: bool = True) -> str:
    """构建语音场景专用的system prompt增强。

    在已有的模块system prompt基础上追加语音相关指令。
    """
    extras = []
    if enable_dialect:
        extras.append(DIALECT_AWARENESS_PROMPT)

    extras.append(
        "当前为语音交互模式。用户的输入来自语音识别，可能包含识别错误。"
        "遇到明显不通顺的地方，请结合上下文理解用户意图，不要逐字较真。"
    )
    return "\n".join(extras)
