"""聊天消息服务 — 路由层（全模块数据互通 Phase 1）。

API 端点：
  POST /chat/sync             — 上传今日消息（全量覆盖）
  GET  /chat/{module}         — 按日期拉取消息
  GET  /chat/{module}/dates   — 获取有消息的日期列表
  GET  /chat/{module}/meta    — 获取模块元数据
  PUT  /chat/{module}/meta    — 保存模块元数据
  POST /chat/{module}/migrate — 一次性迁移：上传 localStorage 全部历史消息
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ...shared.database import get_db
from ...shared.response import ok
from ...shared.security import CurrentUser, get_current_user
from . import service
from .schemas import (
    ChatSyncRequest,
    ChatMetaSaveRequest,
    ChatMigrateRequest,
)

router = APIRouter(tags=["聊天消息"])


# ═══════════════════════════════════════════════
# 消息同步
# ═══════════════════════════════════════════════
@router.post("/chat/sync")
def sync_messages(
    body: ChatSyncRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """上传今日消息（全量覆盖）。

    前端 300ms 防抖后调用，将今日全部消息上传到后端。
    后端先删除今日旧消息，再写入新消息，确保完全一致。
    """
    messages = [m.model_dump() for m in body.messages]
    return ok(service.sync_chat_messages(
        db=db,
        user_id=user.user_id,
        module=body.module,
        messages=messages,
    ))


# ═══════════════════════════════════════════════
# 消息拉取
# ═══════════════════════════════════════════════
@router.get("/chat/{module}")
def load_messages(
    module: str,
    date: str | None = Query(default=None, description="日期 YYYY-MM-DD，默认今日"),
    limit: int = Query(default=200, le=1000),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """按日期拉取消息。

    - date 不传 → 返回今日消息
    - date 传具体日期 → 返回该日消息
    - limit 控制最大返回条数
    """
    return ok(service.load_chat_messages(
        db=db,
        user_id=user.user_id,
        module=module,
        date=date,
        limit=limit,
    ))


# ═══════════════════════════════════════════════
# 日期列表
# ═══════════════════════════════════════════════
@router.get("/chat/{module}/dates")
def get_dates(
    module: str,
    limit: int = Query(default=90, le=365),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取该模块有消息的日期列表，最新在前。最多返回90天。"""
    return ok(service.get_chat_dates(
        db=db,
        user_id=user.user_id,
        module=module,
        limit=limit,
    ))


# ═══════════════════════════════════════════════
# 模块元数据
# ═══════════════════════════════════════════════
@router.get("/chat/{module}/meta")
def get_meta(
    module: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取模块元数据（如复盘阶段状态）。"""
    return ok(service.get_chat_meta(
        db=db,
        user_id=user.user_id,
        module=module,
    ))


@router.put("/chat/{module}/meta")
def save_meta(
    module: str,
    body: ChatMetaSaveRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """保存模块元数据（全量覆盖）。"""
    return ok(service.save_chat_meta(
        db=db,
        user_id=user.user_id,
        module=module,
        meta=body.meta,
    ))


# ═══════════════════════════════════════════════
# 一次性迁移
# ═══════════════════════════════════════════════
@router.post("/chat/{module}/migrate")
def migrate_messages(
    module: str,
    body: ChatMigrateRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """一次性迁移：上传 localStorage 全部历史消息。

    前端检测到后端无数据但 localStorage 有数据时调用。
    跳过今日（今日由 /chat/sync 处理）。
    """
    data = [d.model_dump() for d in body.data]
    return ok(service.migrate_chat_messages(
        db=db,
        user_id=user.user_id,
        module=module,
        data=data,
    ))
