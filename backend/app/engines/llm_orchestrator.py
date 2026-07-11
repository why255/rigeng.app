"""LLM调度引擎 LLMOrchestrationEngine (SK-4.5-01)

核心能力：多模型智能调度 → Fallback降级链 → 余额不足自动切换 → Token预算管理

模型选择策略:
  - simple: zhipu-glm-4-flash（低成本、低延迟）
  - medium: zhipu-glm-4（性价比高）
  - complex: claude-sonnet-4-6（质量优先）
  - emotion_treehole 永远用最好的模型（情感理解要求最高）
"""
from __future__ import annotations

import logging
import time
from typing import Any

logger = logging.getLogger("llm_orchestrator")

# ═══════════════════════════════════════════════
# 任务复杂度枚举
# ═══════════════════════════════════════════════
TASK_COMPLEXITY = {
    "simple": "simple",     # 关键词匹配、简单分类
    "medium": "medium",     # 结构化提取、SOP萃取
    "complex": "complex",   # 多轮推理、方案生成
}

# ═══════════════════════════════════════════════
# 各模块LLM温度策略（严格按算法文档）
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
    "general":          0.5,
}

# ═══════════════════════════════════════════════
# Fallback降级链
# ═══════════════════════════════════════════════
FALLBACK_CHAIN: dict[str, list[str]] = {
    "claude-sonnet-4-6": ["GLM-4.7", "glm-4-flash"],
    "GLM-4.7": ["glm-4-flash", "GLM-5.1", "GLM-4.5-Air"],
    "glm-4-flash": ["GLM-4.5-Air"],
}

# ═══════════════════════════════════════════════
# 模型选择
# ═══════════════════════════════════════════════

def select_model(module: str, task_complexity: str = "medium") -> str:
    """按模块和任务复杂度选择最佳模型。

    规则：
    - 情绪树洞永远用最好的模型（情感理解要求最高）
    - simple → glm-4-flash（低成本、低延迟）
    - medium → 使用配置的 ZHIPUAI_MODEL（默认 GLM-4.7，性价比高）
    - complex → claude-sonnet-4-6（质量优先）
    """
    from ..shared.config import settings

    # 情绪树洞永远用最好的模型
    if module in ("emotion_treehole", "mood_haven"):
        return "claude-sonnet-4-6"

    if task_complexity == "simple":
        return "glm-4-flash"
    elif task_complexity == "medium":
        return settings.ZHIPUAI_MODEL or "GLM-4.7"
    elif task_complexity == "complex":
        return "claude-sonnet-4-6"

    # 默认性价比优先
    return settings.ZHIPUAI_MODEL or "GLM-4.7"


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
    """LLM调度引擎统一入口。

    封装 voice_engine.llm_generate()，自动选择模型和温度，
    实现完整的降级链。

    Args:
        prompt: 用户提示词
        system_prompt: 系统提示词（应已通过 persona.build_persona_prompt() 构建）
        context: 对话历史上下文
        module: 功能模块key
        task_complexity: 任务复杂度 (simple/medium/complex)
        temperature: 温度参数（不传则按模块自动选择）
        其他参数透传至 voice_engine.llm_generate()

    Returns:
        {"content": str, "model_used": str, "provider": str, "usage": dict}
    """
    from ..services.voice_engine.service import llm_generate

    # 选择模型
    preferred_model = select_model(module, task_complexity)
    # 获取温度
    actual_temperature = _get_temperature(module, temperature)

    # 构建降级模型列表
    fallback_models = FALLBACK_CHAIN.get(preferred_model, [])
    models_to_try = [preferred_model] + fallback_models

    last_error = None
    for model in models_to_try:
        try:
            result = llm_generate(
                prompt=prompt,
                system_prompt=system_prompt,
                context=context,
                model=model,
                temperature=actual_temperature,
                max_tokens=max_tokens,
                stream=stream,
                provider=provider,
                user_id=user_id,
                db=db,
            )
            # 成功返回
            logger.info(
                "LLM调度: module=%s complexity=%s model=%s temp=%.1f tokens=%d",
                module, task_complexity, result.get("model_used", model),
                actual_temperature, result.get("usage", {}).get("total_tokens", 0),
            )
            return result
        except Exception as e:
            last_error = e
            if model != models_to_try[-1]:
                logger.warning("模型 %s 调用失败，降级到 %s: %s", model,
                              models_to_try[models_to_try.index(model) + 1], e)
                time.sleep(1)  # 短暂等待后重试
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
