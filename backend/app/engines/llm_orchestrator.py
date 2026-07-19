"""LLM调度引擎 LLMOrchestrationEngine (v2.1 — 统一模块注册表)。

按《日耕产品完整模块配置清单》为每个功能模块绑定专属AI模型，
实行"一模块一模型"策略。模块元数据统一从 module_registry 导入。

模型→模块映射（16 个 AI 模块，详见 module_registry.py）:
  - 豆包 Seed 2.0 Pro (火山引擎): 9 个模块
  - 通义千问 Qwen3.7-Max (阿里云): hr_template
  - 腾讯混元 Hy3: smart_record
  - Kimi K2.5 (月之暗面): knowledge_base
  - DeepSeek: growth_analysis
  - 智谱 GLM-4.5: brand_building, ip_creation
"""
from __future__ import annotations

import logging
import time
from typing import Any

from .module_registry import (
    MODULE_MODEL_MAP,
    MODULE_TEMPERATURE,
    MODULE_TEMPLATE_FALLBACKS,
    _MODEL_TO_PROVIDER,
    get_provider_for_model as _get_provider_for_model,
    get_fast_model,
    FAST_MODEL_TEMPERATURE,
    FAST_MODEL_MAX_TOKENS,
)

logger = logging.getLogger("llm_orchestrator")

# ── DB 覆盖缓存（30秒 TTL，避免每次 LLM 调用都查 DB）──
_db_override_cache: dict[str, dict[str, tuple[str, str]]] = {}
_db_override_cache_time: float = 0.0

# ═══════════════════════════════════════════════
# 任务复杂度枚举（保留向后兼容）
# ═══════════════════════════════════════════════
TASK_COMPLEXITY = {
    "simple": "simple",
    "medium": "medium",
    "complex": "complex",
}

# MODULE_MODEL_MAP 和 MODULE_TEMPERATURE 已迁移到 module_registry.py
# 通过 from .module_registry import MODULE_MODEL_MAP, MODULE_TEMPERATURE 导入

# ═══════════════════════════════════════════════
# Fallback降级链（每个模型的备用选项）
# ═══════════════════════════════════════════════
FALLBACK_CHAIN: dict[str, list[str]] = {
    # 豆包失败 → 通义千问 → DeepSeek → 智谱
    "doubao-seed-2-0-pro": ["qwen3.7-max-preview", "deepseek-chat", "glm-4.5"],
    "doubao-seed-2-0-pro-260215": ["doubao-seed-2-0-pro", "qwen3.7-max-preview"],
    # 通义千问失败 → DeepSeek → 豆包 → 智谱
    "qwen3.7-max-preview": ["deepseek-chat", "doubao-seed-2-0-pro", "glm-4.5"],
    # 腾讯混元失败 → 通义千问 → 豆包
    "hy3-preview": ["qwen3.7-max-preview", "doubao-seed-2-0-pro"],
    # Kimi失败 → DeepSeek → 通义千问
    "kimi-k2.5": ["deepseek-chat", "qwen3.7-max-preview"],
    # DeepSeek失败 → 通义千问 → 豆包
    "deepseek-chat": ["qwen3.7-max-preview", "doubao-seed-2-0-pro"],
    # 智谱失败 → 豆包 → 通义千问
    "glm-4.5": ["doubao-seed-2-0-pro", "qwen3.7-max-preview"],
    # 旧模型兼容
    "claude-sonnet-4-6": ["doubao-seed-2-0-pro", "qwen3.7-max-preview", "glm-4.5"],
}

# _MODEL_TO_PROVIDER 和 get_provider_for_model 已迁移到 module_registry.py
# 通过 from .module_registry import _MODEL_TO_PROVIDER, get_provider_for_model 导入

def select_model(module: str, task_complexity: str = "medium",
                  db: Any = None) -> tuple[str, str]:
    """按模块选择最佳模型和提供商（Excel Sheet2 映射 + DB 覆盖）。

    优先从数据库读取覆盖配置（管理员可在后台动态调整），
    DB 不可用时回退到硬编码的 MODULE_MODEL_MAP。

    Returns:
        (model_name, provider_name)
    """
    # 1) 尝试 DB 覆盖（管理员后台配置）
    if db:
        db_overrides = _load_db_overrides_cached(db)
        if module in db_overrides:
            model, provider = db_overrides[module]
            logger.debug("模块路由(DB覆盖): %s → %s (%s)", module, model, provider)
            return model, provider

    # 2) 硬编码默认映射
    entry = MODULE_MODEL_MAP.get(module)
    if entry:
        model, provider = entry
        logger.debug("模块路由(默认): %s → %s (%s)", module, model, provider)
        return model, provider

    # 3) 未匹配模块 → 默认豆包
    logger.debug("模块 %s 未匹配，使用默认豆包", module)
    return ("doubao-seed-2-0-pro", "volcano")


def _load_db_overrides(db: Any) -> dict[str, tuple[str, str]]:
    """从数据库加载模块→(模型, 提供商)的覆盖映射。

    只返回 is_active=True 且模型 is_available=True 的记录。
    如果模块有多个活跃绑定（异常情况），取最新的一条。
    异常时返回空 dict，不影响系统正常运行。
    """
    if db is None:
        return {}
    try:
        from ..shared.models.model_config import ModelConfig, ModuleModelBinding
        rows = db.query(
            ModuleModelBinding.module_key,
            ModelConfig.model_name,
            ModelConfig.provider_key,
            ModuleModelBinding.created_at,
        ).join(
            ModelConfig, ModuleModelBinding.model_config_id == ModelConfig.id,
        ).filter(
            ModuleModelBinding.is_active == True,
            ModelConfig.is_available == True,
            ModuleModelBinding.deleted_at == None,
            ModelConfig.deleted_at == None,
        ).order_by(ModuleModelBinding.module_key, ModuleModelBinding.created_at.desc()).all()

        result: dict[str, tuple[str, str]] = {}
        for row in rows:
            # 每个 module_key 只取第一条（最新的）
            if row.module_key not in result:
                result[row.module_key] = (row.model_name, row.provider_key)
                logger.debug("DB覆盖: %s -> %s (%s)", row.module_key, row.model_name, row.provider_key)
        return result
    except Exception as e:
        logger.warning("加载DB模型覆盖配置失败，使用硬编码默认: %s", e)
        return {}


def _load_db_overrides_cached(db: Any) -> dict[str, tuple[str, str]]:
    """带缓存的 DB 覆盖加载（30秒 TTL）。"""
    global _db_override_cache, _db_override_cache_time
    now = time.time()
    if now - _db_override_cache_time < 30:
        return _db_override_cache.get("data", {})
    data = _load_db_overrides(db)
    _db_override_cache = {"data": data}
    _db_override_cache_time = now
    return data


def _get_temperature(module: str, override: float | None = None) -> float:
    """获取模块对应的温度参数。"""
    if override is not None:
        return override
    return MODULE_TEMPERATURE.get(module, 0.5)


# ═══════════════════════════════════════════════
# 统一调度入口
# ═══════════════════════════════════════════════

# _TEMPLATE_FALLBACKS 已迁移到 module_registry.py 的 MODULE_TEMPLATE_FALLBACKS
# 通过 from .module_registry import MODULE_TEMPLATE_FALLBACKS 导入


def llm_generate_with_orchestration(
    prompt: str,
    system_prompt: str | None = None,
    context: list[dict[str, str]] | None = None,
    module: str = "general",
    task_complexity: str = "medium",
    temperature: float | None = None,
    max_tokens: int | None = None,
    stream: bool = False,
    provider: str | None = None,
    user_id: str | None = None,
    db: Any = None,
    fast_mode: bool = False,
) -> dict[str, Any]:
    """LLM调度引擎统一入口 (v2.0)。

    按模块自动路由到对应的模型提供商（严格遵循Excel配置）。
    支持fallback降级链，确保服务可用性。

    Args:
        prompt: 用户提示词
        system_prompt: 系统提示词
        context: 对话历史上下文
        module: 功能模块key（决定使用哪个模型）
        fast_mode: Phase 3 — True时使用快速模型（更低TTFT）

    Returns:
        {"content": str, "model_used": str, "provider": str, "usage": dict}
    """
    from ..services.voice_engine.service import llm_generate

    # 选择模型和提供商
    if provider:
        preferred_model = None
    else:
        preferred_model, provider = select_model(module, task_complexity, db=db)

    # Phase 3: 快速模式
    if fast_mode and preferred_model:
        original = preferred_model
        preferred_model = get_fast_model(preferred_model)
        provider = _get_provider_for_model(preferred_model)
        logger.debug("快速模式(非流式): module=%s %s → %s", module, original, preferred_model)

    # 获取温度
    actual_temperature = _get_temperature(module, temperature)
    if fast_mode:
        actual_temperature = FAST_MODEL_TEMPERATURE

    actual_max_tokens_nonstream = max_tokens
    if fast_mode and max_tokens is None:
        actual_max_tokens_nonstream = FAST_MODEL_MAX_TOKENS

    # 构建降级模型列表
    fallback_models = FALLBACK_CHAIN.get(preferred_model, []) if preferred_model else []
    models_to_try = [preferred_model] if preferred_model else []
    models_to_try += fallback_models

    last_error = None
    for model in models_to_try:
        # 根据模型推断提供商
        current_provider = provider if model == preferred_model else _get_provider_for_model(model)
        try:
            result = llm_generate(
                prompt=prompt,
                system_prompt=system_prompt,
                context=context,
                model=model,
                temperature=actual_temperature,
                max_tokens=actual_max_tokens_nonstream,
                stream=stream,
                provider=current_provider,
                user_id=user_id,
                db=db,
            )
            # 成功返回
            logger.info(
                "LLM调度: module=%s model=%s provider=%s temp=%.1f tokens=%d",
                module, result.get("model_used", model),
                result.get("provider", current_provider),
                actual_temperature, result.get("usage", {}).get("total_tokens", 0),
            )
            return result
        except Exception as e:
            last_error = e
            if model != models_to_try[-1]:
                next_idx = models_to_try.index(model) + 1
                logger.warning("模型 %s 调用失败，降级到 %s: %s", model,
                              models_to_try[next_idx], e)
                time.sleep(1)
                continue

    # 全部失败 → 模板化兜底
    fallback_content = MODULE_TEMPLATE_FALLBACKS.get(module, MODULE_TEMPLATE_FALLBACKS["general"])
    logger.error("LLM调度全部失败(module=%s): %s", module, last_error)

    return {
        "content": fallback_content,
        "model_used": "fallback_template",
        "provider": "fallback",
        "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
    }


# ═══════════════════════════════════════════════
# 流式调度入口
# ═══════════════════════════════════════════════

def llm_generate_stream_with_orchestration(
    prompt: str,
    system_prompt: str | None = None,
    context: list[dict[str, str]] | None = None,
    module: str = "general",
    task_complexity: str = "medium",
    temperature: float | None = None,
    max_tokens: int | None = None,
    provider: str | None = None,
    user_id: str | None = None,
    db: Any = None,
    fast_mode: bool = False,
):
    """LLM 流式调度引擎入口（生成器）。

    按模块自动路由 + fallback 降级链，逐个 yield token 字符串。

    Args:
        fast_mode: Phase 3 — True时使用快速模型（更低TTFT），用于预生成/预测场景

    用法:
        for token in llm_generate_stream_with_orchestration(prompt="...", module="morning_plan"):
            yield f"data: {json.dumps({'token': token, 'type': 'content'})}\\n\\n"
        yield "data: [DONE]\\n\\n"
    """
    from ..services.voice_engine.service import llm_generate_stream

    # 选择模型和提供商
    if provider:
        preferred_model = None
    else:
        preferred_model, provider = select_model(module, task_complexity, db=db)

    # Phase 3: 快速模式 — 替换为低延迟模型
    if fast_mode and preferred_model:
        original = preferred_model
        preferred_model = get_fast_model(preferred_model)
        provider = _get_provider_for_model(preferred_model)
        logger.debug("快速模式: module=%s %s → %s", module, original, preferred_model)

    actual_temperature = _get_temperature(module, temperature)
    if fast_mode:
        actual_temperature = FAST_MODEL_TEMPERATURE

    actual_max_tokens = max_tokens
    if fast_mode and max_tokens is None:
        actual_max_tokens = FAST_MODEL_MAX_TOKENS

    fallback_models = FALLBACK_CHAIN.get(preferred_model, []) if preferred_model else []
    models_to_try = [preferred_model] if preferred_model else []
    models_to_try += fallback_models

    last_error = None
    for model in models_to_try:
        current_provider = provider if model == preferred_model else _get_provider_for_model(model)
        try:
            token_count = 0
            for token in llm_generate_stream(
                prompt=prompt,
                system_prompt=system_prompt,
                context=context,
                model=model,
                temperature=actual_temperature,
                max_tokens=actual_max_tokens,
                provider=current_provider,
                user_id=user_id,
                db=db,
            ):
                token_count += 1
                yield token
            logger.info(
                "LLM流式调度完成: module=%s model=%s provider=%s temp=%.1f tokens=%d",
                module, model, current_provider, actual_temperature, token_count,
            )
            return
        except Exception as e:
            last_error = e
            if model != models_to_try[-1]:
                next_idx = models_to_try.index(model) + 1
                logger.warning("模型 %s 流式调用失败，降级到 %s: %s", model,
                              models_to_try[next_idx], e)
                time.sleep(1)
                continue

    # 全部失败 → 模板化兜底（以单 token 形式输出）
    fallback_content = MODULE_TEMPLATE_FALLBACKS.get(module, MODULE_TEMPLATE_FALLBACKS["general"])
    logger.error("LLM流式调度全部失败(module=%s): %s", module, last_error)
    yield fallback_content


# ═══════════════════════════════════════════════
# 双阶段响应 — Stage-1 摘要生成
# ═══════════════════════════════════════════════

def generate_summary(
    user_message: str,
    timeout_ms: int | None = None,
    user_id: str | None = None,
    db: Any = None,
) -> str | None:
    """双阶段 Stage-1:用 lite 模型生成一句话(<= 20 字)核心建议。

    - 超时(默认 DUAL_STAGE_SUMMARY_TIMEOUT_MS)返回 None,不阻塞主流程
    - 任何异常返回 None,由调用方决定要不要跳过 summary 事件
    - 用 morning_chat_lite 模块 → doubao-lite-32k(见 module_registry)

    Args:
        user_message: 用户消息(已脱敏)
        timeout_ms: 覆盖默认超时;传 0 表示无超时(仅测试用)
        user_id: 传给 llm_generate 用于计费/审计
        db: DB session,允许后台 override 模型

    Returns:
        摘要文本(去首尾空白 + 截断到 40 字),或 None
    """
    from ..shared.config import settings as _settings

    if not _settings.DUAL_STAGE_ENABLED:
        return None
    if not user_message or not user_message.strip():
        return None

    budget_ms = timeout_ms if timeout_ms is not None else _settings.DUAL_STAGE_SUMMARY_TIMEOUT_MS
    if budget_ms and budget_ms <= 0:
        # 显式关闭超时
        deadline = None
    else:
        deadline = time.monotonic() + budget_ms / 1000.0

    prompt = (
        f"用户说:{user_message.strip()}\n\n"
        "请用一句话(不超过 20 字)给出核心建议或回应,不要解释原因,不要客套。"
    )
    system_prompt = "你是日耕 AI 助手,只输出一句话的核心建议。"

    import threading

    result_holder: dict[str, Any] = {"text": None, "error": None}

    def _call():
        try:
            out = llm_generate_with_orchestration(
                prompt=prompt,
                system_prompt=system_prompt,
                module="morning_chat_lite",
                task_complexity="simple",
                max_tokens=64,
                stream=False,
                user_id=user_id,
                db=db,
            )
            content = (out or {}).get("content", "")
            if isinstance(content, str):
                result_holder["text"] = content.strip()[:40]
        except Exception as exc:
            result_holder["error"] = exc

    worker = threading.Thread(target=_call, daemon=True)
    worker.start()

    if deadline is None:
        worker.join()
    else:
        remaining = max(0.0, deadline - time.monotonic())
        worker.join(remaining)

    if worker.is_alive():
        logger.info("Stage-1 摘要超时(%dms),跳过 summary 事件", budget_ms)
        return None
    if result_holder["error"] is not None:
        logger.debug("Stage-1 摘要生成失败,跳过: %s", result_holder["error"])
        return None
    return result_holder["text"] or None
