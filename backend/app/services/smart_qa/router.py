"""智能问答服务 — 路由层（步骤16）。

API 端点：
  POST   /qa/ask                      — 发起提问（三源检索 + AI答案生成 + 追问澄清）
  POST   /qa/chat                     — SSE流式对话
  GET    /qa/conversations/{id}       — 获取对话历史
  DELETE /qa/conversations/{id}       — 删除对话
  POST   /qa/answers/{id}/feedback    — 纠错反馈（防幻觉L3）
  POST   /qa/answers/{id}/helpful     — 标记答案有帮助
  POST   /qa/answers/{id}/archive     — 归档到知识库（SOP沉淀）
  GET    /qa/hot-questions            — 热门问题推荐
  GET    /qa/history                  — 搜索问答历史
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ...shared.database import get_db
from ...shared.response import ok
from ...shared.security import CurrentUser, get_current_user
from ...shared.sse_utils import sse_event, sse_done, sse_error, sse_response
from . import service
from .schemas import (
    ArchiveRequest,
    AskRequest,
    FeedbackRequest,
    HelpfulRequest,
    QaChatIn,
)

router = APIRouter(tags=["智能问答"], prefix="/qa")
logger = logging.getLogger("smart_qa_router")


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
# SSE 流式对话
# ═══════════════════════════════════════════════

@router.post("/chat")
def qa_chat(
    body: QaChatIn,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    stream: bool = Query(default=True, description="是否使用 SSE 流式输出"),
    fast_mode: bool = Query(default=False, description="Phase 3: 快速模型模式"),
):
    """智能问答 SSE 流式对话。

    - stream=true（默认）：SSE 流式输出，逐字返回 AI 回复
    - stream=false：传统 JSON 响应（委托给 /qa/ask）
    """
    if not stream:
        # 向后兼容：委托给 /qa/ask
        result = service.ask_question(
            db=db,
            user_id=user.user_id,
            question=body.message,
            conversation_id=body.conversation_id,
        )
        return ok(result)

    # SSE 流式模式
    from ...engines.persona import build_persona_prompt
    from ...engines.llm_orchestrator import llm_generate_stream_with_orchestration

    def generate_sse():
        try:
            # 构建对话历史文本
            context_text = ""
            if body.context:
                recent = body.context[-12:]
                parts = []
                for m in recent:
                    role_label = "用户" if m.get("role") == "user" else "小耕"
                    text = (m.get("text") or m.get("content") or "").strip()
                    if text:
                        parts.append(f"{role_label}：{text}")
                context_text = "\n".join(parts)

            # 构建 prompt
            if not body.message.strip():
                combined_prompt = (
                    "用户打开了智能问答，还没有提问。\n"
                    "请以温暖专业的方式欢迎用户，告诉用户可以问HR相关问题。\n"
                    "2句话即可。"
                )
            else:
                combined_prompt = (
                    f"【对话历史】：\n{context_text}\n\n"
                    f"【用户提问】：{body.message}\n\n"
                    f"请以小耕的身份（专业严谨、温暖简洁）回答。\n"
                    f"要求：\n"
                    f"- 基于知识库给出专业、实用的HR建议\n"
                    f"- 如果问题不够清晰，温和追问澄清\n"
                    f"- 不知道就说不知道，绝不编造\n"
                    f"- 四要素回答：操作要点+注意事项+沟通话术+达成标准\n"
                    f"- 3-5句话为宜"
                )

            system_prompt = build_persona_prompt(module="smart_qa")

            tokens = llm_generate_stream_with_orchestration(
                prompt=combined_prompt,
                system_prompt=system_prompt,
                module="smart_qa",
                temperature=0.5,
                user_id=user.user_id,
                db=db,
                fast_mode=fast_mode,
            )
            for token in tokens:
                yield sse_event(token, "content")
            yield sse_done({"model_used": "stream"})

        except Exception as e:
            logger.exception("智能问答SSE流式异常")
            yield sse_error("小耕正在努力思考中，稍等一下哦～")

    return sse_response(generate_sse())


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
