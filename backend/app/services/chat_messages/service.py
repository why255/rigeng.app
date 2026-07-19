"""聊天消息服务 — 核心业务逻辑（全模块数据互通 Phase 1）。

处理消息同步、拉取、元数据管理和一次性迁移。
同步策略：前端上传今日全部消息（全量覆盖），后端按 user_id + module + chat_date
删除旧消息后重新写入，确保本地与后端完全一致。
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import delete, select, func
from sqlalchemy.orm import Session

from ...shared.config import settings
from ...shared.database import new_uuid, utcnow
from ...shared.errors import APIError, E_INTERNAL
from ...shared.models.chat_message import ChatMessage

logger = logging.getLogger("chat_messages")

# ── 模块元数据存储 key ──
# 模块元数据（如复盘阶段状态等）存储在 chat_message 表中，
# 通过 module="__meta__" 特殊标记区分，但这里选择用单独的
# 逻辑：元数据存在 chat_date="" 且 module=module 的记录的 text 字段中。
# 实际上更好的做法是存在专门的列中，但我们用 chat_message 本身
# 的 PortableJSON 来存储。这里使用更简单的方式：
# 元数据存在 chat_date=$date 的一条特殊消息中，role="__meta__"


# ═══════════════════════════════════════════════
# 内部工具
# ═══════════════════════════════════════════════

def _today_chat_date() -> str:
    """返回今天的聊天日（5AM日界，与前端 getTodayChatDay 对齐）。"""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    # 5AM 日界：UTC+8 时区，5:00 = 前一天 21:00 UTC
    # 简化处理：用本地时间
    from datetime import timedelta
    local_now = now + timedelta(hours=8)  # UTC → 北京时间
    if local_now.hour < 5:
        local_now = local_now - timedelta(days=1)
    return local_now.strftime("%Y-%m-%d")


# ═══════════════════════════════════════════════
# 消息同步
# ═══════════════════════════════════════════════

def sync_chat_messages(
    db: Session,
    user_id: str,
    module: str,
    messages: list[dict],
) -> dict:
    """上传今日消息（全量覆盖）。

    先删除该用户今日该模块的所有旧消息，再逐条写入新消息。
    防止重复键冲突，确保本地与后端完全一致。
    """
    chat_date = _today_chat_date()

    # 删除今日该模块的旧消息
    stmt = delete(ChatMessage).where(
        ChatMessage.user_id == user_id,
        ChatMessage.module == module,
        ChatMessage.chat_date == chat_date,
    )
    db.execute(stmt)

    # 逐条写入新消息
    saved = 0
    for seq, msg in enumerate(messages):
        cm = ChatMessage(
            user_id=user_id,
            module=module,
            chat_date=chat_date,
            role=msg.get("role", "user"),
            text=msg.get("text", ""),
            type=msg.get("type", "text"),
            seq=seq,
        )
        db.add(cm)
        saved += 1

    try:
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("sync_chat_messages commit failed")
        raise APIError(E_INTERNAL, "消息同步失败，请稍后重试")

    return {"saved": saved, "chat_date": chat_date}


# ═══════════════════════════════════════════════
# 消息拉取
# ═══════════════════════════════════════════════

def load_chat_messages(
    db: Session,
    user_id: str,
    module: str,
    date: str | None = None,
    limit: int = 200,
) -> dict:
    """按日期拉取消息。

    - date=None: 返回今日消息
    - date=指定日期: 返回该日期消息
    - limit: 最大返回条数
    """
    chat_date = date or _today_chat_date()

    stmt = (
        select(ChatMessage)
        .where(
            ChatMessage.user_id == user_id,
            ChatMessage.module == module,
            ChatMessage.chat_date == chat_date,
        )
        .order_by(ChatMessage.seq)
        .limit(limit)
    )
    rows = db.execute(stmt).scalars().all()

    messages = [
        {
            "id": row.id,
            "role": row.role,
            "text": row.text,
            "type": row.type,
            "seq": row.seq,
            "created_at": row.created_at.isoformat() if row.created_at else "",
        }
        for row in rows
    ]
    return {"module": module, "chat_date": chat_date, "messages": messages}


# ═══════════════════════════════════════════════
# 日期列表
# ═══════════════════════════════════════════════

def get_chat_dates(
    db: Session,
    user_id: str,
    module: str,
    limit: int = 90,
) -> dict:
    """获取该模块有消息的日期列表，最新在前。"""
    stmt = (
        select(ChatMessage.chat_date)
        .where(
            ChatMessage.user_id == user_id,
            ChatMessage.module == module,
        )
        .distinct()
        .order_by(ChatMessage.chat_date.desc())
        .limit(limit)
    )
    rows = db.execute(stmt).scalars().all()
    return {"module": module, "dates": list(rows)}


# ═══════════════════════════════════════════════
# 元数据
# ═══════════════════════════════════════════════

# 使用 chat_date 列存储 "__meta__" 表示这是元数据行
_META_DATE_MARKER = "__meta__"


def get_chat_meta(
    db: Session,
    user_id: str,
    module: str,
) -> dict:
    """获取模块元数据（如复盘阶段状态、语音模式等）。"""
    today = _today_chat_date()
    stmt = select(ChatMessage).where(
        ChatMessage.user_id == user_id,
        ChatMessage.module == module,
        ChatMessage.chat_date == _META_DATE_MARKER,
    ).order_by(ChatMessage.seq).limit(1)
    row = db.execute(stmt).scalars().first()

    meta = {}
    if row and row.text:
        try:
            import json
            meta = json.loads(row.text)
        except (json.JSONDecodeError, TypeError):
            meta = {}

    return {"module": module, "chat_date": today, "meta": meta}


def save_chat_meta(
    db: Session,
    user_id: str,
    module: str,
    meta: dict,
) -> dict:
    """保存模块元数据（全量覆盖）。"""
    # 删除旧元数据
    stmt = delete(ChatMessage).where(
        ChatMessage.user_id == user_id,
        ChatMessage.module == module,
        ChatMessage.chat_date == _META_DATE_MARKER,
    )
    db.execute(stmt)

    import json
    cm = ChatMessage(
        user_id=user_id,
        module=module,
        chat_date=_META_DATE_MARKER,
        role="__meta__",
        text=json.dumps(meta, ensure_ascii=False),
        type="text",
        seq=0,
    )
    db.add(cm)

    try:
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("save_chat_meta commit failed")
        raise APIError(E_INTERNAL, "保存元数据失败")

    return {"saved": True}


# ═══════════════════════════════════════════════
# 一次性迁移
# ═══════════════════════════════════════════════

def migrate_chat_messages(
    db: Session,
    user_id: str,
    module: str,
    data: list[dict],
) -> dict:
    """一次性迁移：上传 localStorage 全部历史消息。

    data 格式: [{chat_date: "2026-07-10", messages: [{role, text, type}]}, ...]
    每个 chat_date 全量覆盖该日期的消息。
    跳过今日（今日由 sync 端点处理，避免覆盖实时消息）。
    """
    today = _today_chat_date()
    migrated_days = 0
    migrated_messages = 0

    for day_entry in data:
        chat_date = day_entry.get("chat_date", "")
        messages = day_entry.get("messages", [])

        # 跳过今日（由 sync 处理）
        if chat_date == today:
            continue
        # 跳过空日期
        if not chat_date or not messages:
            continue

        # 删除该日期的旧消息
        stmt = delete(ChatMessage).where(
            ChatMessage.user_id == user_id,
            ChatMessage.module == module,
            ChatMessage.chat_date == chat_date,
        )
        db.execute(stmt)

        # 写入新消息
        for seq, msg in enumerate(messages):
            cm = ChatMessage(
                user_id=user_id,
                module=module,
                chat_date=chat_date,
                role=msg.get("role", "user"),
                text=msg.get("text", ""),
                type=msg.get("type", "text"),
                seq=seq,
            )
            db.add(cm)
            migrated_messages += 1

        migrated_days += 1

    try:
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("migrate_chat_messages commit failed")
        raise APIError(E_INTERNAL, "数据迁移失败，请稍后重试")

    return {"migrated_days": migrated_days, "migrated_messages": migrated_messages}
