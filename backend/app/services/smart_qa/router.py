"""智能问答服务 — 路由层（步骤16）。

API 端点：
  POST   /qa/ask                      — 发起提问（三源检索 + AI答案生成 + 追问澄清）
  GET    /qa/conversations/{id}       — 获取对话历史
  DELETE /qa/conversations/{id}       — 删除对话
  POST   /qa/answers/{id}/feedback    — 纠错反馈（防幻觉L3）
  POST   /qa/answers/{id}/helpful     — 标记答案有帮助
  POST   /qa/answers/{id}/archive     — 归档到知识库（SOP沉淀）
  GET    /qa/hot-questions            — 热门问题推荐
  GET    /qa/history                  — 搜索问答历史
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ...shared.database import get_db
from ...shared.response import ok
from ...shared.security import CurrentUser, get_current_user
from . import service
from .schemas import (
    ArchiveRequest,
    AskRequest,
    FeedbackRequest,
    HelpfulRequest,
)

router = APIRouter(tags=["智能问答"], prefix="/qa")


# ═══════════════════════════════════════════════
# 核心：提问
# ═══════════════════════════════════════════════

@router.post("/ask")
def ask(
    body: AskRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """发起提问。支持新问题和追问。

    三源引擎（私有库+携君库+互联网）检索 → AI四要素答案生成。
    如果问题不够清晰，返回追问澄清提示（最多4轮）。
    """
    source_engines_dict = None
    if body.source_engines:
        source_engines_dict = [e.model_dump() for e in body.source_engines]

    result = service.ask_question(
        db=db,
        user_id=user.user_id,
        question=body.question,
        conversation_id=body.conversation_id,
        source_engines=source_engines_dict,
    )
    return ok(result)


# ═══════════════════════════════════════════════
# 对话管理
# ═══════════════════════════════════════════════

@router.get("/conversations/{conversation_id}")
def get_conversation(
    conversation_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取对话历史和全部消息（含四要素答案）。"""
    return ok(service.get_conversation(db, user.user_id, conversation_id))


@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """软删除对话及其关联答案。"""
    return ok(service.delete_conversation(db, user.user_id, conversation_id))


# ═══════════════════════════════════════════════
# 反馈 & 纠错
# ═══════════════════════════════════════════════

@router.post("/answers/{answer_id}/feedback")
def submit_feedback(
    answer_id: str,
    body: FeedbackRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """纠错反馈（防幻觉四级防线第3级：申诉纠错）。

    反馈类型：内容有误 / 时效过期 / 逻辑不通 / 其他问题
    """
    return ok(service.submit_feedback(
        db, user.user_id, answer_id, body.feedback_type, body.detail,
    ))


@router.post("/answers/{answer_id}/helpful")
def mark_helpful(
    answer_id: str,
    body: HelpfulRequest | None = None,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """标记答案有帮助。"""
    return ok(service.mark_helpful(db, user.user_id, answer_id))


# ═══════════════════════════════════════════════
# SOP沉淀归档
# ═══════════════════════════════════════════════

@router.post("/answers/{answer_id}/archive")
def archive_answer(
    answer_id: str,
    body: ArchiveRequest | None = None,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """将答案归档到知识库（SOP沉淀）。

    创建结构化文档，进入知识库待审核区。
    归档成功获得+20贡献值。
    """
    hr_category = body.hr_category if body else None
    return ok(service.archive_answer_to_kb(
        db, user.user_id, answer_id, hr_category,
    ))


# ═══════════════════════════════════════════════
# 热门问题
# ═══════════════════════════════════════════════

@router.get("/hot-questions")
def hot_questions(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取热门问题推荐列表。基于用户历史和全局热门统计。"""
    return ok(service.get_hot_questions(db, user.user_id))


# ═══════════════════════════════════════════════
# 问答历史搜索
# ═══════════════════════════════════════════════

@router.get("/history")
def search_history(
    q: str | None = Query(None, description="搜索关键词"),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """搜索用户的问答历史记录。"""
    return ok(service.search_qa_history(db, user.user_id, q))
