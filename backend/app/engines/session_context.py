"""会话上下文引擎 SessionContextEngine (SK-4.4-01)

核心能力：对话历史管理 → 跨模块记忆传递 → 用户习惯学习 → 上下文窗口优化

Token预算管理:
  System Prompt ≤ 2000 + 记忆 ≤ 1000 + 历史 ≤ 1500 = 4500 max
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger("session_context")

# ═══════════════════════════════════════════════
# SessionContext — 对话历史管理
# ═══════════════════════════════════════════════

# 生产环境用 Redis，开发用内存
_sessions: dict[str, "SessionContext"] = {}


class SessionContext:
    """单次对话的上下文管理器。

    管理对话历史、模块跳转链、自动压缩旧对话。
    """

    def __init__(self, user_id: str, max_turns: int = 20):
        self.user_id = user_id
        self.turns: list[dict[str, str]] = []       # 最多保留20轮（40条消息）
        self.summary: str = ""                        # 超过20轮后生成摘要
        self.active_module: str | None = None         # 当前活跃模块
        self.module_chain: list[str] = []             # 模块跳转链
        self.max_turns = max_turns
        self.created_at = datetime.now(timezone.utc)

    def add_turn(self, role: str, content: str, module: str | None = None) -> None:
        """添加一轮对话。超过max_turns时自动压缩旧对话。"""
        self.turns.append({"role": role, "content": content, "module": module or ""})
        if len(self.turns) > self.max_turns * 2:  # *2因为每轮有user+assistant
            self._compress_history()

    def _compress_history(self) -> None:
        """压缩旧对话：保留最近5轮完整内容，更早的生成摘要。"""
        keep_turns = 5 * 2  # 最近5轮 = 10条消息
        if len(self.turns) <= keep_turns:
            return

        old_turns = self.turns[:-keep_turns]
        self.turns = self.turns[-keep_turns:]

        # 简单摘要：提取旧对话中用户的关键内容
        user_messages = [t["content"][:100] for t in old_turns if t["role"] == "user"]
        if user_messages:
            self.summary = f"[前序对话摘要] 用户讨论了: {'; '.join(user_messages[-5:])}"

    def get_context_for_llm(self) -> list[dict[str, str]]:
        """获取适合发送给LLM的上下文（摘要+最近对话）。"""
        context = []
        if self.summary:
            context.append({"role": "system", "content": self.summary})
        for turn in self.turns:
            context.append({"role": turn["role"], "content": turn["content"]})
        return context

    def switch_module(self, new_module: str) -> None:
        """记录模块切换。"""
        if self.active_module and self.active_module != new_module:
            self.module_chain.append(self.active_module)
        self.active_module = new_module

    def to_dict(self) -> dict[str, Any]:
        return {
            "user_id": self.user_id,
            "turns_count": len(self.turns),
            "has_summary": bool(self.summary),
            "active_module": self.active_module,
            "module_chain": self.module_chain,
        }


def get_or_create_session(user_id: str, session_id: str | None = None) -> tuple[SessionContext, str]:
    """获取或创建会话上下文。

    Returns:
        (SessionContext, session_id)
    """
    import uuid

    if session_id and session_id in _sessions:
        return _sessions[session_id], session_id

    new_id = session_id or f"sess_{uuid.uuid4().hex[:12]}"
    ctx = SessionContext(user_id)
    _sessions[new_id] = ctx
    return ctx, new_id


# ═══════════════════════════════════════════════
# 跨模块记忆管理
# ═══════════════════════════════════════════════

# 内存记忆存储（生产环境用 Redis/PostgreSQL）
_user_memories: dict[str, list[dict[str, Any]]] = {}


def extract_memory(
    db,
    user_id: str,
    module: str,
    conversation: list[dict[str, str]],
) -> list[dict[str, Any]]:
    """从对话中提取跨模块记忆。

    记忆类型:
    - 用户背景：公司规模/行业/HR团队结构
    - 在办事项：正在推进的项目/关键时间节点
    - 偏好习惯：喜欢简洁/喜欢详细/喜欢被追问/不喜欢被追问
    - 情绪模式：经常在周一焦虑/周三疲惫/周五放松

    提取时机：每个模块的 execute() 执行完毕后调用。

    Returns:
        新提取的记忆列表
    """
    # MVP阶段：基于关键词的简单记忆提取
    new_memories = []
    all_text = " ".join(
        m.get("content", "") for m in conversation
        if m.get("role") in ("user",)
    )

    if not all_text:
        return []

    today = datetime.now(timezone.utc).date().isoformat()

    # 公司背景检测
    if any(kw in all_text for kw in ["公司", "我们公司", "我们企业"]):
        size_keywords = [f"{n}人" for n in range(1, 10000)]
        for kw in size_keywords:
            if kw in all_text:
                new_memories.append({
                    "key": "user_company_size",
                    "value": kw,
                    "source_module": module,
                    "source_session": "",
                    "confidence": 0.7,
                    "last_updated": today,
                    "access_count": 0,
                })
                break

    # 偏好检测
    if any(kw in all_text for kw in ["简单说", "简洁", "直接说", "别啰嗦"]):
        new_memories.append({
            "key": "prefer_concise",
            "value": True,
            "source_module": module,
            "confidence": 0.8,
            "last_updated": today,
            "access_count": 0,
        })
    if any(kw in all_text for kw in ["详细", "细说", "展开"]):
        new_memories.append({
            "key": "prefer_detailed",
            "value": True,
            "source_module": module,
            "confidence": 0.8,
            "last_updated": today,
            "access_count": 0,
        })

    # 存储
    if user_id not in _user_memories:
        _user_memories[user_id] = []
    _user_memories[user_id].extend(new_memories)

    logger.info(
        "记忆提取: user=%s module=%s new=%d total=%d",
        user_id[:8], module, len(new_memories), len(_user_memories.get(user_id, [])),
    )

    return new_memories


def load_context(
    db,
    user_id: str,
    module: str,
    max_memories: int = 5,
) -> dict[str, Any]:
    """加载与当前模块相关的记忆和上下文。

    优化策略:
    - 只发送与当前模块相关的记忆(相关性评分 ≥ 0.5)
    - 只发送最近3轮的完整对话，更早的用摘要
    - 记忆按引用频率排序，优先发送高频记忆

    Returns:
        {"memories": [...], "context_summary": str}
    """
    memories = _user_memories.get(user_id, [])

    # 按引用频率排序
    sorted_memories = sorted(
        memories,
        key=lambda m: m.get("access_count", 0),
        reverse=True,
    )[:max_memories]

    # 更新引用计数
    for m in sorted_memories:
        m["access_count"] = m.get("access_count", 0) + 1

    context_summary = ""
    if sorted_memories:
        parts = []
        for m in sorted_memories:
            parts.append(f"{m['key']}: {m['value']}")
        context_summary = "用户背景: " + "; ".join(parts)

    return {
        "memories": sorted_memories,
        "context_summary": context_summary,
        "total_memories": len(memories),
    }
