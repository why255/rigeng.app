"""LLM调度引擎 LLMOrchestrationEngine (v2.0 — 多模型模块路由)。

按《日耕产品完整模块配置清单》为每个功能模块绑定专属AI模型，
实行"一模块一模型"策略，替换旧的复杂度选择逻辑。

模型→模块映射（严格按Excel Sheet2）:
  - main_chat (对话主模块) → 豆包 Seed 2.0 Pro (火山引擎)
  - hr_template (HR模板)   → 通义千问 Qwen3.7-Max (阿里云)
  - meeting (会议纪要)     → 腾讯混元 Hy3
  - knowledge (知识库)     → Kimi K2.5 (月之暗面)
  - growth (成长分析)      → DeepSeek V4-Pro
  - ip_creation (IP创作)   → 智谱 GLM-4.5
"""
from __future__ import annotations

import logging
import time
from typing import Any

logger = logging.getLogger("llm_orchestrator")

# ═══════════════════════════════════════════════
# 任务复杂度枚举（保留向后兼容）
# ═══════════════════════════════════════════════
TASK_COMPLEXITY = {
    "simple": "simple",
    "medium": "medium",
    "complex": "complex",
}

# ═══════════════════════════════════════════════
# 模块→(模型, 提供商) 映射表（Excel Sheet2）
# ═══════════════════════════════════════════════
MODULE_MODEL_MAP: dict[str, tuple[str, str]] = {
    # ── AI对话主模块 → 豆包 Seed 2.0 Pro (火山引擎) ──
    "morning_plan":     ("doubao-seed-2-0-pro", "volcano"),
    "evening_review":   ("doubao-seed-2-0-pro", "volcano"),
    "emotion_treehole": ("doubao-seed-2-0-pro", "volcano"),
    "mood_haven":       ("doubao-seed-2-0-pro", "volcano"),
    "smart_qa":         ("doubao-seed-2-0-pro", "volcano"),
    "smart_office":     ("doubao-seed-2-0-pro", "volcano"),
    "career":           ("doubao-seed-2-0-pro", "volcano"),
    "smart_job":        ("doubao-seed-2-0-pro", "volcano"),
    "general":          ("doubao-seed-2-0-pro", "volcano"),

    # ── HR专业模板 → 通义千问 Qwen3.7-Max (阿里云) ──
    "hr_template":      ("qwen3.7-max-preview", "dashscope"),

    # ── 智能会议纪要 → 腾讯混元 Hy3 ──
    "smart_record":     ("hy3-preview", "hunyuan"),

    # ── 私有知识库问答 → Kimi K2.5 (月之暗面) ──
    "knowledge_base":   ("kimi-k2.5", "kimi"),

    # ── 工作诊断&成长分析 → DeepSeek V4-Pro ──
    "growth_analysis":  ("deepseek-chat", "deepseek"),

    # ── IP内容创作 → 智谱 GLM-4.5 ──
    "brand_building":   ("glm-4.5", "zhipu"),
    "ip_creation":      ("glm-4.5", "zhipu"),

    # ── 多模态解析 → 豆包多模态版 ──
    "multimodal":       ("doubao-seed-2-0-pro-260215", "volcano"),
}

# ═══════════════════════════════════════════════
# 各模块LLM温度策略
# ═══════════════════════════════════════════════
MODULE_TEMPERATURE: dict[str, float] = {
    "morning_plan":     0.3,  # 规划萃取需要严谨
    "evening_review":   0.3,  # SOP萃取需要严谨
    "emotion_treehole": 0.7,  # 情绪回应需要自然
    "mood_haven":       0.7,  # 情绪回应需要自然
    "smart_record":     0.2,  # 信息萃取需要准确
    "smart_qa":         0.2,  # 专业问答需要严谨
    "smart_office":     0.3,  # 文档生成需要规范
    "smart_job":        0.3,  # 求职策略需要务实
    "career":           0.3,  # 求职策略需要务实
    "knowledge_base":   0.3,  # 知识管理需要准确
    "analytics":        0.3,  # 数据分析需要准确
    "data_analytics":   0.3,
    "hr_template":      0.3,  # HR文档需要规范
    "growth_analysis":  0.3,  # 成长分析需要严谨
    "brand_building":   0.7,  # 内容创作需要创意
    "ip_creation":      0.7,
    "general":          0.5,
}

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

# ═══════════════════════════════════════════════
# 模型→提供商 反向映射
# ═══════════════════════════════════════════════
_MODEL_TO_PROVIDER: dict[str, str] = {
    "doubao-seed-2-0-pro": "volcano",
    "doubao-seed-2-0-pro-260215": "volcano",
    "qwen3.7-max-preview": "dashscope",
    "hy3-preview": "hunyuan",
    "kimi-k2.5": "kimi",
    "deepseek-chat": "deepseek",
    "glm-4.5": "zhipu",
    "GLM-4.7": "zhipu",
    "GLM-4.5-Air": "zhipu",
    "glm-4-flash": "zhipu",
    "claude-sonnet-4-6": "anthropic",
}


def get_provider_for_model(model: str) -> str:
    """根据模型名返回对应的提供商。"""
    return _MODEL_TO_PROVIDER.get(model, "zhipu")


def select_model(module: str, task_complexity: str = "medium") -> tuple[str, str]:
    """按模块选择最佳模型和提供商（Excel Sheet2 映射）。

    Returns:
        (model_name, provider_name)
    """
    entry = MODULE_MODEL_MAP.get(module)
    if entry:
        model, provider = entry
        logger.debug("模块路由: %s → %s (%s)", module, model, provider)
        return model, provider

    # 未匹配模块 → 默认豆包
    logger.debug("模块 %s 未匹配，使用默认豆包", module)
    return ("doubao-seed-2-0-pro", "volcano")


def _get_temperature(module: str, override: float | None = None) -> float:
    """获取模块对应的温度参数。"""
    if override is not None:
        return override
    return MODULE_TEMPERATURE.get(module, 0.5)


# ═══════════════════════════════════════════════
# 统一调度入口
# ═══════════════════════════════════════════════

# 模板化兜底回复（全部LLM失败时使用）
_TEMPLATE_FALLBACKS: dict[str, str] = {
    "morning_plan": "姐，今天有什么计划呢？小耕帮您梳理一下~",
    "evening_review": "姐，今天辛苦了，咱们简单回顾一下今天的收获？",
    "emotion_treehole": "姐，小耕在听。不管什么时候，这里都是您可以倾诉的地方。",
    "mood_haven": "姐，小耕在听。不管什么时候，这里都是您可以倾诉的地方。",
    "smart_record": "姐，录音处理中遇到点问题，小耕正在努力恢复，请稍等~",
    "smart_qa": "姐，这个问题小耕需要再查一下，稍后给您准确的答复~",
    "smart_office": "姐，文档生成引擎暂时有点忙，请稍后再试~",
    "smart_job": "姐，求职分析引擎正在预热中，请稍等一下~",
    "career": "姐，求职分析引擎正在预热中，请稍等一下~",
    "hr_template": "姐，文档生成引擎暂时有点忙，请稍后再试~",
    "growth_analysis": "姐，成长分析引擎正在思考中，请稍等一下~",
    "general": "姐，小耕正在努力思考中，请稍等片刻再试~",
}


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
) -> dict[str, Any]:
    """LLM调度引擎统一入口 (v2.0)。

    按模块自动路由到对应的模型提供商（严格遵循Excel配置）。
    支持fallback降级链，确保服务可用性。

    Args:
        prompt: 用户提示词
        system_prompt: 系统提示词
        context: 对话历史上下文
        module: 功能模块key（决定使用哪个模型）
        task_complexity: 保留参数，不再影响模型选择（向后兼容）
        temperature: 温度参数（不传则按模块自动选择）
        provider: 显式指定提供商（覆盖模块路由）
        user_id: 用户ID
        db: 数据库会话

    Returns:
        {"content": str, "model_used": str, "provider": str, "usage": dict}
    """
    from ..services.voice_engine.service import llm_generate

    # 选择模型和提供商
    if provider:
        # 显式指定提供商 → 使用该提供商的默认模型
        preferred_model = None
    else:
        preferred_model, provider = select_model(module, task_complexity)

    # 获取温度
    actual_temperature = _get_temperature(module, temperature)

    # 构建降级模型列表
    fallback_models = FALLBACK_CHAIN.get(preferred_model, []) if preferred_model else []
    models_to_try = [preferred_model] if preferred_model else []
    models_to_try += fallback_models

    last_error = None
    for model in models_to_try:
        # 根据模型推断提供商
        current_provider = provider if model == preferred_model else get_provider_for_model(model)
        try:
            result = llm_generate(
                prompt=prompt,
                system_prompt=system_prompt,
                context=context,
                model=model,
                temperature=actual_temperature,
                max_tokens=max_tokens,
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
    fallback_content = _TEMPLATE_FALLBACKS.get(module, _TEMPLATE_FALLBACKS["general"])
    logger.error("LLM调度全部失败(module=%s): %s", module, last_error)

    return {
        "content": fallback_content,
        "model_used": "fallback_template",
        "provider": "fallback",
        "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
    }
