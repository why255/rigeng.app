"""智能触发引擎 — 判断用户语音输入何时"够完整"以启动 LLM 预生成。

核心策略（三层触发）:
  1. 句末标点 — 检测到 。！？ 立即触发
  2. 语义完整度 — 文本长度 + 关键词密度 + 句法模式 综合判断
  3. 静音间隙 — 超过阈值无新音频帧

同时处理「中断衔接」: 用户在 LLM 生成过程中继续说话时，
判断新文本是追加（continue）还是转向（restart）。
"""
from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger("realtime.smart_trigger")

# ═══════════════════════════════════════════════
# 常量
# ═══════════════════════════════════════════════

# 句末标点 — 表示语义独立单元结束
SENTENCE_END = {"。", "！", "？", "?", "!", "\n"}

# 弱分隔标点 — 表示子句边界但未完成整句
CLAUSE_SEP = {"，", ",", "、", "；", ";"}

# 各模块最小触发字数（低于此值不触发）
MODULE_MIN_LENGTH: dict[str, int] = {
    "smart_qa": 6,           # 问答通常短
    "emotion_treehole": 4,    # 情绪表达更短
    "morning_plan": 8,
    "evening_review": 8,
    "general": 8,
}

# 各模块触发所需的「信息密度」阈值（关键词数/文本长度）
MODULE_DENSITY_THRESHOLD: dict[str, float] = {
    "smart_qa": 0.20,
    "emotion_treehole": 0.15,
    "morning_plan": 0.22,
    "evening_review": 0.22,
    "general": 0.20,
}

# 静音触发阈值（秒）
SILENCE_TRIGGER_SECONDS = 1.5

# 模块关键词（用于信息密度计算）
MODULE_KEYWORDS: dict[str, list[str]] = {
    "morning_plan": [
        "计划", "今天", "要做", "安排", "任务", "待办", "优先",
        "上午", "下午", "开会", "方案", "面试", "汇报",
        "项目", "截止", "时间", "完成", "确认",
    ],
    "evening_review": [
        "复盘", "今天", "做了", "完成", "收获", "总结",
        "经验", "反思", "改进", "明天", "学到",
    ],
    "emotion_treehole": [
        "心情", "难过", "开心", "焦虑", "压力", "委屈",
        "烦躁", "崩溃", "累", "不想", "觉得",
    ],
    "smart_qa": [
        "怎么", "如何", "HR", "绩效", "招聘", "面试", "薪酬",
        "劳动法", "员工", "离职", "培训", "制度", "流程",
    ],
}


# ═══════════════════════════════════════════════
# 语义完整度评估
# ═══════════════════════════════════════════════

def _compute_semantic_completeness(text: str, module: str) -> float:
    """评估文本语义完整度（0.0 ~ 1.0）。

    维度:
      - 长度归一化（0~0.25）: 长度/20，上限 0.25
      - 句末标点（0~0.40）: 有结尾标点=0.4
      - 信息密度（0~0.25）: 关键词占比/阈值，上限 0.25
      - 句法模式（0~0.10）: 含主谓结构、问句等+0.1
    """
    if not text or len(text) < 2:
        return 0.0

    score = 0.0

    # 1. 长度
    length_score = min(len(text) / 20, 1.0) * 0.25
    score += length_score

    # 2. 句末标点
    if text[-1] in SENTENCE_END:
        score += 0.40

    # 3. 信息密度
    keywords = MODULE_KEYWORDS.get(module, [])
    if keywords:
        hit_count = sum(1 for kw in keywords if kw in text)
        density = hit_count / max(len(text), 1)
        threshold = MODULE_DENSITY_THRESHOLD.get(module, 0.20)
        density_score = min(density / threshold, 1.0) * 0.25
        score += density_score

    # 4. 句法模式：含疑问词、主谓结构、数量词等
    syntax_patterns = [
        r"(怎么|如何|什么|为什么|多少|哪些|能否|可以|帮我|给我)",  # 提问/请求
        r"(我想|我要|我需要|我觉得|我认为|我打算|我计划)",        # 表达意图
        r"(\d+[个项条件次].*[事任务计划])",                       # 数量+事项
        r"(今天|明天|本周|下周|上午|下午).{2,}",                  # 时间+内容
    ]
    if any(re.search(p, text) for p in syntax_patterns):
        score += 0.10

    return min(score, 1.0)


# ═══════════════════════════════════════════════
# 公开 API
# ═══════════════════════════════════════════════

def should_trigger_llm(
    partial_text: str,
    module: str,
    last_audio_time: float | None = None,
    previous_text: str = "",
) -> tuple[bool, str]:
    """判断是否应启动 LLM 预生成。

    Args:
        partial_text: 当前累积的部分转写文本
        module: 功能模块名
        last_audio_time: 最后收到音频帧的时间戳（None=尚未收到音频）
        previous_text: 上一轮转写文本（用于判断是否有新增内容）

    Returns:
        (should_trigger: bool, reason: str)
    """
    text = partial_text.strip()
    if not text:
        return False, "empty"

    # 长度不足
    min_len = MODULE_MIN_LENGTH.get(module, 8)
    if len(text) < min_len:
        return False, f"too_short({len(text)}<{min_len})"

    # 1. 句末标点 — 最强信号
    if text[-1] in SENTENCE_END:
        # 额外检查：不含未闭合的引号/括号
        if text.count(""") % 2 == 0 and text.count(""") % 2 == 0:
            return True, "sentence_end"

    # 2. 语义完整度
    completeness = _compute_semantic_completeness(text, module)
    if completeness >= 0.65:
        return True, f"semantic_complete({completeness:.2f})"

    # 3. 静音间隙 — 用户暂停说话
    if last_audio_time is not None:
        silent_duration = time.time() - last_audio_time
        if silent_duration >= SILENCE_TRIGGER_SECONDS:
            return True, f"silence({silent_duration:.1f}s)"

    return False, f"not_ready(score={completeness:.2f})"


@dataclass
class GenerationState:
    """跟踪一次实时语音会话中的 LLM 生成状态。"""

    # 当前累积的最终转写文本
    full_text: str = ""
    # 是否有 LLM 生成在活跃
    is_generating: bool = False
    # 当前生成的 prompt（触发时的文本）
    generating_prompt: str = ""
    # 已生成的回复 token 数
    generated_tokens: int = 0
    # 中断计数器
    interruption_count: int = 0
    # 最大允许中断次数（防止无限循环）
    max_interruptions: int = 3
    # 已完成的轮次
    completed_turns: int = 0


def decide_continuation(
    state: GenerationState,
    new_text: str,
    existing_reply_so_far: str = "",
) -> str:
    """判断新输入对当前生成的影响。

    Args:
        state: 当前生成状态
        new_text: 用户最新的完整文本
        existing_reply_so_far: 已生成的 LLM 回复文本（可能为空）

    Returns:
        "continue" — 新文本是已有输入的追加，继续当前生成
        "restart" — 文本方向改变，中断并重新生成
        "complete" — 输入未变化，等待当前生成完成
    """
    trimmed_new = new_text.strip()
    trimmed_old = state.generating_prompt.strip()

    # 文本未变化 → 等当前生成完成
    if trimmed_new == trimmed_old:
        return "complete"

    # 新文本以旧文本为前缀 → 追加，继续当前生成
    if trimmed_new.startswith(trimmed_old):
        return "continue"

    # 文本有实质变化 → 需要判断是微调还是转向
    # 计算文本相似度（Jaccard 字符集）
    set_old = set(trimmed_old)
    set_new = set(trimmed_new)
    if set_old and set_new:
        overlap = len(set_old & set_new) / len(set_old | set_new)
        if overlap > 0.5:
            # 高度重叠 → 微调，但重新生成以获得更准确回复
            return "restart"
        else:
            # 低重叠 → 转向，必须重新生成
            return "restart"

    return "restart"


def should_interrupt(
    state: GenerationState,
    new_text: str,
    existing_reply_tokens: int = 0,
) -> tuple[bool, str]:
    """判断是否应中断当前 LLM 生成。

    Args:
        state: 当前生成状态
        new_text: 最新的部分转写文本
        existing_reply_tokens: 已生成的回复 token 数

    Returns:
        (should_interrupt: bool, action: str)
    """
    if not state.is_generating:
        return False, "not_generating"

    if state.interruption_count >= state.max_interruptions:
        return False, "max_interruptions"

    # 新文本为空或太短 → 不中断
    if not new_text or len(new_text.strip()) < 3:
        return False, "too_short"

    # 已生成 token 太少（<20）→ 可以中断（浪费不大）
    if existing_reply_tokens < 20:
        action = decide_continuation(state, new_text)
        if action == "restart":
            return True, "restart_early"
        return False, action

    # 已生成较多 token → 更谨慎，只在文本大幅变化时中断
    action = decide_continuation(state, new_text)
    if action == "restart":
        # 检查变化幅度：新增内容是否超过原文本的 30%
        trimmed_old = state.generating_prompt.strip()
        trimmed_new = new_text.strip()
        new_chars = len(trimmed_new) - len(trimmed_old)
        if new_chars > len(trimmed_old) * 0.3:
            return True, "restart_significant_change"

    return False, action


def get_trigger_summary(trigger_reason: str, partial_text: str, module: str) -> dict[str, Any]:
    """生成触发事件的调试摘要。"""
    return {
        "reason": trigger_reason,
        "text_length": len(partial_text.strip()),
        "completeness": _compute_semantic_completeness(partial_text.strip(), module),
        "ends_with_sentence_end": partial_text.strip()[-1] in SENTENCE_END if partial_text.strip() else False,
        "module": module,
    }
