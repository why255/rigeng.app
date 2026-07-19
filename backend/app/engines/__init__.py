# ═══════════════════════════════════════════════
# 日耕智脑层 — 算法基础设施引擎包。

# 为功能层9个模块提供统一的AI能力：
# - persona: 小耕IP人格引擎（三层Prompt叠加）
# - llm_orchestrator: LLM调度引擎（模型选择+温度策略+降级）
# - session_context: 会话上下文引擎（记忆管理+窗口优化）+ Redis会话记忆
# - security_compliance: 安全合规引擎（PII脱敏+内容审核）
# - data_foundation: 数据底座引擎（事件采集+审计日志）
# - content_transformation: 内容转化引擎（知识→技能→经验）
# - outcomes: 成效引擎（成果/效率/回报量化）
# - user_profiler: 用户画像引擎（Tier 2 记忆系统）
# ═══════════════════════════════════════════════

from .persona import build_persona_prompt, get_date_anchor, MODULE_TONE_PROFILES
from .module_registry import (
    get_provider_for_model,
    MODULE_MODEL_MAP,
    MODULE_TEMPERATURE,
)
from .llm_orchestrator import (
    llm_generate_with_orchestration,
    llm_generate_stream_with_orchestration,
    select_model,
    TASK_COMPLEXITY,
)
from .session_context import SessionContext, extract_memory, load_context
from .session_context import save_turn, get_recent_turns, clear_session
from .session_context import prefetch_knowledge, get_prefetched_knowledge
from .security_compliance import (
    desensitize,
    audit_output,
    audit_output_proactive,
    EmotionPrivacyGuard,
    PII_PATTERNS,
)
from .data_foundation import emit_event, write_audit_log, EVENT_TYPES
from .content_transformation import ContentTransformationPipeline
from .outcomes import OutcomeEngine, EfficiencyEngine, ROIEngine
from .flow_state_machine import (
    get_user_stage,
    advance_stage,
    resume_flow,
    can_transition,
    update_metadata,
    validate_stage,
)

__all__ = [
    # persona
    "build_persona_prompt",
    "get_date_anchor",
    "MODULE_TONE_PROFILES",
    # llm_orchestrator
    "llm_generate_with_orchestration",
    "llm_generate_stream_with_orchestration",
    "select_model",
    "get_provider_for_model",
    "MODULE_MODEL_MAP",
    "MODULE_TEMPERATURE",
    "TASK_COMPLEXITY",
    # session_context
    "SessionContext",
    "extract_memory",
    "load_context",
    "save_turn",
    "get_recent_turns",
    "clear_session",
    # security_compliance
    "desensitize",
    "audit_output",
    "audit_output_proactive",
    "EmotionPrivacyGuard",
    "PII_PATTERNS",
    # data_foundation
    "emit_event",
    "write_audit_log",
    "EVENT_TYPES",
    # content_transformation
    "ContentTransformationPipeline",
    # outcomes
    "OutcomeEngine",
    "EfficiencyEngine",
    "ROIEngine",
    # flow_state_machine
    "get_user_stage",
    "advance_stage",
    "resume_flow",
    "can_transition",
    "update_metadata",
    "validate_stage",
]
