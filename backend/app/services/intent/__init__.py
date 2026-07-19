"""意图规则引擎 —— 快速识别寒暄/感谢/告别等简单问题,跳过重量级 RAG+Persona 流程。"""
from .rule_engine import IntentType, classify_intent, is_simple_intent

__all__ = ["IntentType", "classify_intent", "is_simple_intent"]
