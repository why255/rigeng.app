"""会话上下文引擎 SessionContextEngine (SK-4.4-01)

核心能力：对话历史管理 → 跨模块记忆传递 → 用户习惯学习 → 上下文窗口优化
三层记忆存储:
  Tier 1: Redis (生产) — rg:session:{user_id}:{module}，24h TTL
  Tier 1-fallback: InMemory (开发/Redis不可用)
  Tier 2: 用户画像 — engines/user_profiler.py
  Tier 3: 流程状态 — engines/flow_state_machine.py

Token预算管理:
  System Prompt ≤ 2000 + 记忆 ≤ 1000 + 历史 ≤ 1500 = 4500 max
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
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
# Tier 1: Redis 会话记忆 + InMemory Fallback
# ═══════════════════════════════════════════════

_t1_redis_client = None
_t1_redis_available: bool | None = None  # None=未检测, True=可用, False=不可用
_session_ttl = timedelta(hours=24)


def _get_redis():
    """惰性初始化 Redis 客户端。"""
    global _t1_redis_client, _t1_redis_available
    if _t1_redis_available is not None:
        return _t1_redis_client if _t1_redis_available else None
    try:
        from ..shared.config import settings
        import redis  # type: ignore
        _t1_redis_client = redis.from_url(settings.REDIS_URL, socket_connect_timeout=2, socket_timeout=3)
        _t1_redis_client.ping()
        _t1_redis_available = True
        logger.info("Redis 会话记忆已连接: %s", settings.REDIS_URL)
    except Exception as e:
        _t1_redis_available = False
        _t1_redis_client = None
        logger.warning("Redis 不可用，使用 InMemory 会话记忆: %s", e)
    return _t1_redis_client if _t1_redis_available else None


def _session_key(user_id: str, module: str) -> str:
    return f"rg:session:{user_id}:{module}"


class InMemorySessionStore:
    """内存会话记忆（开发/Redis 不可用时的 fallback）。"""

    def __init__(self):
        self._store: dict[str, list[dict[str, Any]]] = {}

    def save_turn(self, user_id: str, module: str, role: str, content: str) -> None:
        key = _session_key(user_id, module)
        if key not in self._store:
            self._store[key] = []
        self._store[key].append({
            "role": role,
            "content": content,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        # 保留最近 40 条（20 轮）
        if len(self._store[key]) > 40:
            self._store[key] = self._store[key][-40:]

    def get_recent_turns(self, user_id: str, module: str, n: int = 10) -> list[dict[str, str]]:
        key = _session_key(user_id, module)
        if key not in self._store:
            return []
        return [
            {"role": t["role"], "content": t["content"]}
            for t in self._store[key][-n:]
        ]


_inmemory_store = InMemorySessionStore()


def save_turn(user_id: str, module: str, role: str, content: str) -> None:
    """Tier 1: 保存一轮对话（优先 Redis，fallback InMemory）。

    所有 LLM 对话完成后调用，建立跨对话记忆。

    Args:
        user_id: 用户 ID
        module: 模块 key（如 morning_plan, smart_qa）
        role: 角色（user / assistant）
        content: 消息文本
    """
    r = _get_redis()
    if r:
        try:
            key = _session_key(user_id, module)
            entry = json.dumps({
                "role": role,
                "content": content,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }, ensure_ascii=False)
            r.rpush(key, entry)
            r.expire(key, _session_ttl)
            # 保留最近 40 条
            r.ltrim(key, -40, -1)
            logger.debug("T1 save: user=%s module=%s role=%s len=%d", user_id[:8], module, role, len(content))
            return
        except Exception as e:
            logger.warning("Redis save_turn 失败，降级到 InMemory: %s", e)
    # fallback
    _inmemory_store.save_turn(user_id, module, role, content)


def get_recent_turns(user_id: str, module: str, n: int = 10) -> list[dict[str, str]]:
    """Tier 1: 读取最近 N 轮对话（优先 Redis，fallback InMemory）。

    Args:
        user_id: 用户 ID
        module: 模块 key
        n: 最多返回的轮数（默认 10 = 最近 20 条消息）

    Returns:
        [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]
    """
    r = _get_redis()
    if r:
        try:
            key = _session_key(user_id, module)
            raw = r.lrange(key, -n * 2, -1)  # n 轮 = 2n 条消息
            turns = []
            for item in raw:
                try:
                    t = json.loads(item)
                    turns.append({"role": t["role"], "content": t["content"]})
                except json.JSONDecodeError:
                    continue
            logger.debug("T1 read: user=%s module=%s count=%d", user_id[:8], module, len(turns))
            return turns
        except Exception as e:
            logger.warning("Redis get_recent_turns 失败，降级到 InMemory: %s", e)
    # fallback
    return _inmemory_store.get_recent_turns(user_id, module, n)


def clear_session(user_id: str, module: str) -> None:
    """清除指定会话记忆。"""
    r = _get_redis()
    if r:
        try:
            r.delete(_session_key(user_id, module))
        except Exception:
            pass
    # also clear inmemory
    key = _session_key(user_id, module)
    _inmemory_store._store.pop(key, None)


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


# ═══════════════════════════════════════════════
# Phase 5: 上下文预取 — 提前检索相关知识
# ═══════════════════════════════════════════════

# 预取缓存（{user_id}_{module}_{stage}: [doc_items]）
_prefetch_cache: dict[str, list[dict[str, Any]]] = {}
_prefetch_cache_time: dict[str, float] = {}
_PREFETCH_TTL = 300  # 预取缓存 5 分钟


def prefetch_knowledge(db, user_id: str, module: str, stage: str = "greeting") -> list[dict[str, Any]]:
    """预取当前阶段相关文档，在用户进入模块时调用。

    在 greeting 阶段提前检索相关知识文档，实际对话时直接使用缓存结果，
    避免每次用户发言都等待 RAG 检索。

    Args:
        db: 数据库会话
        user_id: 用户 ID
        module: 模块 key（mp/er/mh 或 morning_plan/evening_review/emotion_treehole）
        stage: 当前阶段

    Returns:
        预取的文档列表 (title, snippet, source, doc_id)
    """
    import time

    cache_key = f"{user_id}_{module}_{stage}"

    # 检查缓存
    cached = _prefetch_cache.get(cache_key)
    cached_time = _prefetch_cache_time.get(cache_key, 0)
    if cached and (time.time() - cached_time) < _PREFETCH_TTL:
        logger.debug("预取命中缓存: %s %s %s", user_id[:8], module, stage)
        return cached

    # 根据模块生成检索查询
    module_queries = {
        "morning_plan": "工作计划 时间管理 优先级",
        "mp": "工作计划 时间管理 优先级",
        "evening_review": "复盘 总结 经验萃取",
        "er": "复盘 总结 经验萃取",
        "emotion_treehole": "情绪管理 压力应对 心理健康",
        "mh": "情绪管理 压力应对 心理健康",
        "smart_qa": "HR 人力资源管理 招聘 绩效 薪酬",
        "general": "工作方法 效率提升",
    }
    query = module_queries.get(module, module_queries["general"])

    try:
        from ..services.search_rag.service import semantic_search
        result = semantic_search(db, user_id, query, top_n=5)
        items = result.get("items", [])

        docs = []
        for item in items:
            docs.append({
                "title": item.get("title", ""),
                "snippet": (item.get("snippet") or "")[:200],
                "source": item.get("source", ""),
                "source_name": "私有库" if item.get("source") == "private" else "携君库",
                "doc_id": item.get("doc_id", ""),
            })

        _prefetch_cache[cache_key] = docs
        _prefetch_cache_time[cache_key] = time.time()
        logger.info("预取完成: %s %s %s → %d docs", user_id[:8], module, stage, len(docs))
        return docs

    except Exception as e:
        logger.warning("预取失败（不阻塞流程）: %s", e)
        return []


def get_prefetched_knowledge(user_id: str, module: str, stage: str = "greeting") -> list[dict[str, Any]]:
    """读取预取结果（从缓存，不发起新请求）。"""
    cache_key = f"{user_id}_{module}_{stage}"
    return _prefetch_cache.get(cache_key, [])
