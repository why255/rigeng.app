"""AI 模块统一注册表 — 所有 AI 驱动模块的单一数据源。

此文件是日耕全部 16 个 AI 模块的权威定义。
被以下模块导入：
  - llm_orchestrator.py（模型路由、温度策略）
  - algorithm_admin/schemas.py（管理后台模块列表）
  - algorithm_admin/service.py（AI 配置聚合）

添加新模块时只需修改此文件即可全局生效。
"""
from __future__ import annotations

# ═══════════════════════════════════════════════
# 模块注册表（16 个 AI 驱动模块）
# ═══════════════════════════════════════════════
MODULE_REGISTRY: dict[str, dict] = {
    # ── 豆包 Seed 2.0 Pro 系列（火山引擎）──
    "morning_plan": {
        "name": "朝有规划",
        "icon": "mingcute:sun-line",
        "color": "#E8A94D",
        "default_model": "doubao-seed-2-0-pro",
        "provider": "volcano",
        "temperature": 0.3,
        "description": "每日晨间规划，萃取目标与行动项",
        "fallback_chain": ["qwen3.7-max-preview", "deepseek-chat", "glm-4.5"],
        "template_fallback": "姐，今天有什么计划呢？小耕帮您梳理一下~",
        "ai_capabilities": ["LLM"],
    },
    "morning_chat_lite": {
        # 双阶段响应 Stage-1:先给出一句话核心建议(< 500ms),再由 morning_plan 生成完整回答
        "name": "朝有规划-摘要",
        "icon": "mingcute:sun-line",
        "color": "#E8A94D",
        "default_model": "doubao-lite-32k",
        "provider": "volcano",
        "temperature": 0.5,
        "description": "双阶段摘要通道(lite 模型),仅用于生成 20 字内核心建议",
        "fallback_chain": ["deepseek-chat", "glm-4-flash"],
        "template_fallback": "姐,小耕正在思考…",
        "ai_capabilities": ["LLM"],
    },
    "evening_review": {
        "name": "暮有复盘",
        "icon": "mingcute:moon-line",
        "color": "#6B8FBF",
        "default_model": "doubao-seed-2-0-pro",
        "provider": "volcano",
        "temperature": 0.3,
        "description": "每日晚间复盘，SOP 萃取与经验沉淀",
        "fallback_chain": ["qwen3.7-max-preview", "deepseek-chat", "glm-4.5"],
        "template_fallback": "姐，今天辛苦了，咱们简单回顾一下今天的收获？",
        "ai_capabilities": ["LLM", "SOP提取"],
    },
    "emotion_treehole": {
        "name": "情绪树洞",
        "icon": "mingcute:heart-line",
        "color": "#D46B6B",
        "default_model": "doubao-seed-2-0-pro",
        "provider": "volcano",
        "temperature": 0.7,
        "description": "情绪倾诉与危机检测，三层融合算法",
        "fallback_chain": ["qwen3.7-max-preview", "deepseek-chat", "glm-4.5"],
        "template_fallback": "姐，小耕在听。不管什么时候，这里都是您可以倾诉的地方。",
        "ai_capabilities": ["LLM", "危机检测", "共情生成", "趋势分析"],
    },
    "mood_haven": {
        "name": "情绪港湾",
        "icon": "mingcute:heart-pulse-line",
        "color": "#D46B6B",
        "default_model": "doubao-seed-2-0-pro",
        "provider": "volcano",
        "temperature": 0.7,
        "description": "情绪疗愈空间，温暖陪伴",
        "fallback_chain": ["qwen3.7-max-preview", "deepseek-chat", "glm-4.5"],
        "template_fallback": "姐，小耕在听。不管什么时候，这里都是您可以倾诉的地方。",
        "ai_capabilities": ["LLM"],
    },
    "smart_qa": {
        "name": "智能问答",
        "icon": "mingcute:comment-line",
        "color": "#6BA4B8",
        "default_model": "doubao-seed-2-0-pro",
        "provider": "volcano",
        "temperature": 0.2,
        "description": "HR 专业问答，三源 RAG + 四要素答案",
        "fallback_chain": ["qwen3.7-max-preview", "deepseek-chat", "glm-4.5"],
        "template_fallback": "姐，这个问题小耕需要再查一下，稍后给您准确的答复~",
        "ai_capabilities": ["LLM", "RAG检索", "复杂度评估", "时效性检查"],
    },
    "smart_office": {
        "name": "智能办公",
        "icon": "mingcute:briefcase-line",
        "color": "#C03A39",
        "default_model": "doubao-seed-2-0-pro",
        "provider": "volcano",
        "temperature": 0.3,
        "description": "HR 文档生成（JD、薪酬、绩效）",
        "fallback_chain": ["qwen3.7-max-preview", "deepseek-chat", "glm-4.5"],
        "template_fallback": "姐，文档生成引擎暂时有点忙，请稍后再试~",
        "ai_capabilities": ["LLM", "文档生成"],
    },
    "career": {
        "name": "高维求职",
        "icon": "mingcute:rocket-line",
        "color": "#8E44AD",
        "default_model": "doubao-seed-2-0-pro",
        "provider": "volcano",
        "temperature": 0.3,
        "description": "职业发展全流程：简历→技能水晶→求职策略→面试复盘",
        "fallback_chain": ["qwen3.7-max-preview", "deepseek-chat", "glm-4.5"],
        "template_fallback": "姐，求职分析引擎正在预热中，请稍等一下~",
        "ai_capabilities": ["LLM", "简历解析", "技能提取", "面试策略"],
    },
    "smart_job": {
        "name": "智能求职",
        "icon": "mingcute:search-line",
        "color": "#27AE60",
        "default_model": "doubao-seed-2-0-pro",
        "provider": "volcano",
        "temperature": 0.3,
        "description": "智能求职匹配与策略",
        "fallback_chain": ["qwen3.7-max-preview", "deepseek-chat", "glm-4.5"],
        "template_fallback": "姐，求职分析引擎正在预热中，请稍等一下~",
        "ai_capabilities": ["LLM"],
    },
    "general": {
        "name": "通用模块",
        "icon": "mingcute:app-line",
        "color": "#999999",
        "default_model": "doubao-seed-2-0-pro",
        "provider": "volcano",
        "temperature": 0.5,
        "description": "通用对话与兜底模块",
        "fallback_chain": ["qwen3.7-max-preview", "deepseek-chat", "glm-4.5"],
        "template_fallback": "姐，小耕正在努力思考中，请稍等片刻再试~",
        "ai_capabilities": ["LLM"],
    },

    # ── 通义千问 Qwen3.7-Max（阿里云）──
    "hr_template": {
        "name": "HR模板",
        "icon": "mingcute:file-text-line",
        "color": "#E67E22",
        "default_model": "qwen3.7-max-preview",
        "provider": "dashscope",
        "temperature": 0.3,
        "description": "HR 专业模板生成",
        "fallback_chain": ["deepseek-chat", "doubao-seed-2-0-pro", "glm-4.5"],
        "template_fallback": "姐，文档生成引擎暂时有点忙，请稍后再试~",
        "ai_capabilities": ["LLM", "模板生成"],
    },

    # ── 腾讯混元 Hy3 ──
    "smart_record": {
        "name": "会议纪要",
        "icon": "mingcute:mic-line",
        "color": "#27AE60",
        "default_model": "hy3-preview",
        "provider": "hunyuan",
        "temperature": 0.2,
        "description": "智能录音转写、会议纪要、面试分析、行动项提取",
        "fallback_chain": ["qwen3.7-max-preview", "doubao-seed-2-0-pro"],
        "template_fallback": "姐，录音处理中遇到点问题，小耕正在努力恢复，请稍等~",
        "ai_capabilities": ["LLM", "ASR", "面试分析", "行动项提取", "提词器"],
    },

    # ── Kimi K2.5（月之暗面）──
    "knowledge_base": {
        "name": "知识库",
        "icon": "mingcute:book-6-line",
        "color": "#2ECC71",
        "default_model": "kimi-k2.5",
        "provider": "kimi",
        "temperature": 0.3,
        "description": "私有知识库问答与管理",
        "fallback_chain": ["deepseek-chat", "qwen3.7-max-preview"],
        "template_fallback": "姐，知识库引擎正在整理资料中，请稍等~",
        "ai_capabilities": ["LLM", "向量检索", "文档管理"],
    },

    # ── DeepSeek ──
    "growth_analysis": {
        "name": "成长分析",
        "icon": "mingcute:chart-line",
        "color": "#3498DB",
        "default_model": "deepseek-chat",
        "provider": "deepseek",
        "temperature": 0.3,
        "description": "工作诊断与成长分析",
        "fallback_chain": ["qwen3.7-max-preview", "doubao-seed-2-0-pro"],
        "template_fallback": "姐，成长分析引擎正在思考中，请稍等一下~",
        "ai_capabilities": ["LLM", "诊断分析"],
    },

    # ── 智谱 GLM-4.5 ──
    "brand_building": {
        "name": "品牌建设",
        "icon": "mingcute:star-line",
        "color": "#F39C12",
        "default_model": "glm-4.5",
        "provider": "zhipu",
        "temperature": 0.7,
        "description": "个人品牌与 IP 内容创作",
        "fallback_chain": ["doubao-seed-2-0-pro", "qwen3.7-max-preview"],
        "template_fallback": "姐，内容创作引擎需要一点灵感，请稍等~",
        "ai_capabilities": ["LLM", "内容创作", "负面过滤"],
    },
    "ip_creation": {
        "name": "IP创作",
        "icon": "mingcute:pen-line",
        "color": "#E91E63",
        "default_model": "glm-4.5",
        "provider": "zhipu",
        "temperature": 0.7,
        "description": "IP 内容创作与品牌传播",
        "fallback_chain": ["doubao-seed-2-0-pro", "qwen3.7-max-preview"],
        "template_fallback": "姐，内容创作引擎需要一点灵感，请稍等~",
        "ai_capabilities": ["LLM", "内容创作"],
    },

    # ── 豆包多模态版 ──
    "multimodal": {
        "name": "多模态解析",
        "icon": "mingcute:image-line",
        "color": "#9B59B6",
        "default_model": "doubao-seed-2-0-pro-260215",
        "provider": "volcano",
        "temperature": 0.3,
        "description": "图片/文件多模态内容解析",
        "fallback_chain": ["doubao-seed-2-0-pro", "qwen3.7-max-preview"],
        "template_fallback": "姐，多模态引擎正在解析中，请稍等~",
        "ai_capabilities": ["LLM", "多模态"],
    },
}

# ═══════════════════════════════════════════════
# Phase 3: 快速模型映射（用于预生成/预热场景，追求低TTFT）
# ═══════════════════════════════════════════════

# 每个主模型的快速替代模型。DeepSeek Chat 首token延迟最低（<500ms），
# GLM-4-Flash 是智谱的低延迟变体。均用于 fast_mode=1 的预生成请求。
FAST_MODEL_MAP: dict[str, str] = {
    "doubao-seed-2-0-pro": "deepseek-chat",
    "doubao-seed-2-0-pro-260215": "deepseek-chat",
    "qwen3.7-max-preview": "deepseek-chat",
    "hy3-preview": "deepseek-chat",
    "kimi-k2.5": "deepseek-chat",
    "deepseek-chat": "deepseek-chat",   # 已是最快
    "glm-4.5": "glm-4-flash",           # 智谱快速变体
    "glm-4-flash": "glm-4-flash",
    "GLM-4.7": "glm-4-flash",
    "GLM-4.5-Air": "glm-4-flash",
    "claude-sonnet-4-6": "deepseek-chat",
}

# 快速模型默认温度（低temperature保证预生成结果可用）
FAST_MODEL_TEMPERATURE: float = 0.1

# 快速模型默认 max_tokens（预生成不需要完整回复，够看到方向即可）
FAST_MODEL_MAX_TOKENS: int = 512


def get_fast_model(main_model: str) -> str:
    """返回主模型对应的快速替代模型。"""
    return FAST_MODEL_MAP.get(main_model, "deepseek-chat")


# ═══════════════════════════════════════════════
# 向后兼容的导出（供 llm_orchestrator.py 使用）
# ═══════════════════════════════════════════════

# 模块→(模型, 提供商) 映射
MODULE_MODEL_MAP: dict[str, tuple[str, str]] = {
    k: (v["default_model"], v["provider"])
    for k, v in MODULE_REGISTRY.items()
}

# 模块→温度 映射
MODULE_TEMPERATURE: dict[str, float] = {
    k: v["temperature"]
    for k, v in MODULE_REGISTRY.items()
}

# 模型→提供商 反向映射（含兼容别名）
_MODEL_TO_PROVIDER: dict[str, str] = {
    "doubao-seed-2-0-pro": "volcano",
    "doubao-seed-2-0-pro-260215": "volcano",
    "doubao-lite-32k": "volcano",
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

# 模块→兜底回复 映射
MODULE_TEMPLATE_FALLBACKS: dict[str, str] = {
    k: v["template_fallback"]
    for k, v in MODULE_REGISTRY.items()
}


def get_module_info(module_key: str) -> dict | None:
    """获取单个模块的完整注册信息。"""
    return MODULE_REGISTRY.get(module_key)


def get_provider_for_model(model: str) -> str:
    """根据模型名返回对应的提供商。"""
    return _MODEL_TO_PROVIDER.get(model, "zhipu")


def list_all_module_keys() -> list[str]:
    """列出全部模块 key。"""
    return list(MODULE_REGISTRY.keys())
