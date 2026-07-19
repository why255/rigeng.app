"""意图规则引擎 —— 基于正则的轻量级意图分类器。

设计原则:
1. **准确率优先**:只识别 100% 确定的简单问题(寒暄/感谢/告别/确认),不确定一律归类为 complex
2. **零延迟**:纯本地内存正则匹配,单次 < 0.1ms
3. **保守策略**:宁可把简单问题误判为复杂(多花点延迟),也不能把复杂问题误判为简单(用 lite 敷衍)

规则维护:
- 新增规则请追加到 SIMPLE_PATTERNS,并在 tests/test_rule_engine.py 补充正/负用例
- 长度上限 MAX_SIMPLE_LEN 防止长句寒暄被误判(如"你好呀今天天气怎么样")
"""
from __future__ import annotations

import re
from enum import Enum

from app.shared.config import settings


class IntentType(str, Enum):
    SIMPLE = "simple"    # 走 lite 模型直答
    COMPLEX = "complex"  # 走 pro 完整流程(RAG + Persona + 双阶段)


# 简单问题最大长度(字符),超过一律视为 complex
MAX_SIMPLE_LEN = 15

# 通用尾缀字符类:语气词 + 半/全角标点
_TAIL = r"[了吗呢啦呀哦嗯啊~!！。.\?？]{0,3}"

# 简单问题正则规则库(严格锚定 ^...$,避免"你好今天天气怎么样"误匹配"你好")
SIMPLE_PATTERNS: list[str] = [
    # 寒暄
    r"^(你好|您好|hi|hello|嗨|哈喽|hey)" + _TAIL + r"$",
    # 早晚问候
    r"^(早上好|下午好|晚上好|早安|午安|晚安|早|中午好)" + _TAIL + r"$",
    # 感谢
    r"^(谢谢|感谢|多谢|thanks|thank\s?you|thx)([你您]?)" + _TAIL + r"$",
    # 告别
    r"^(再见|拜拜|bye|byebye|回头见|下次见)" + _TAIL + r"$",
    # 确认/收到
    r"^(好的|好|明白|收到|ok|okay|了解|清楚|嗯|哦|啊)" + _TAIL + r"$",
    # 肯定/否定
    r"^(是的|是|对|好啊|好呀|不是|不用|不需要|没事|没关系|不客气)" + _TAIL + r"$",
    # 简短请求(单字礼貌用语)
    r"^(请|麻烦|辛苦了|加油)([你您]?)" + _TAIL + r"$",
]

_COMPILED = [re.compile(p, re.IGNORECASE) for p in SIMPLE_PATTERNS]


def _normalize(text: str) -> str:
    """归一化:去首尾空白 + 折叠内部空白。保留大小写(正则用 IGNORECASE)。"""
    return re.sub(r"\s+", " ", text.strip())


def is_simple_intent(text: str) -> bool:
    """判断是否为简单意图。空字符串/超长/无匹配 → False。"""
    if not text:
        return False
    t = _normalize(text)
    if not t or len(t) > MAX_SIMPLE_LEN:
        return False
    for pat in _COMPILED:
        if pat.match(t):
            return True
    return False


def classify_intent(text: str) -> IntentType:
    """意图分类主入口。特性开关关闭时始终返回 COMPLEX。"""
    if not settings.INTENT_RULE_ENGINE_ENABLED:
        return IntentType.COMPLEX
    return IntentType.SIMPLE if is_simple_intent(text) else IntentType.COMPLEX
