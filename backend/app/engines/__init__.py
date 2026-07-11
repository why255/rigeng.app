"""日耕智脑层 — 算法基础设施引擎包。

为功能层9个模块提供统一的AI能力：
- persona: 小耕IP人格引擎（三层Prompt叠加）
- llm_orchestrator: LLM调度引擎（模型选择+温度策略+降级）
- session_context: 会话上下文引擎（记忆管理+窗口优化）
- security_compliance: 安全合规引擎（PII脱敏+内容审核）
- data_foundation: 数据底座引擎（事件采集+审计日志）
- content_transformation: 内容转化引擎（知识→技能→经验）
- outcomes: 成效引擎（成果/效率/回报量化）
"""

from .persona import build_persona_prompt, MODULE_TONE_PROFILES
from .llm_orchestrator import (
    llm_generate_with_orchestration,
    select_model,
    get_provider_for_model,
    MODULE_MODEL_MAP,
    MODULE_TEMPERATURE,
    TASK_COMPLEXITY,
)
from .session_context import SessionContext, extract_memory, load_context
from .security_compliance import (
    desensitize,
    audit_output,
    EmotionPrivacyGuard,
    PII_PATTERNS,
)
from .data_foundation import emit_event, write_audit_log, EVENT_TYPES
from .content_transformation import ContentTransformationPipeline
from .outcomes import OutcomeEngine, EfficiencyEngine, ROIEngine

__all__ = [
    # persona
    "build_persona_prompt",
    "MODULE_TONE_PROFILES",
    # llm_orchestrator
    "llm_generate_with_orchestration",
    "select_model",
    "get_provider_for_model",
    "MODULE_MODEL_MAP",
    "MODULE_TEMPERATURE",
    "TASK_COMPLEXITY",
    # session_context
    "SessionContext",
    "extract_memory",
    "load_context",
    # security_compliance
    "desensitize",
    "audit_output",
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
]
