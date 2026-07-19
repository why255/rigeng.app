"""情绪树洞服务 — 路由层（步骤14）。

API 端点：
  GET  /emotion/today     — 今日情绪概览
  POST /emotion/log       — 记录倾诉消息
  POST /emotion/suggest   — 获取小耕共情回复
  POST /emotion/crisis    — 触发危机干预
  GET  /emotion/history   — 情绪历史趋势
  GET  /growth/records    — 成长记录列表
  POST /growth/record     — 创建成长记录
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ...shared.database import get_db
from ...shared.response import ok
from ...shared.security import CurrentUser, get_current_user
from ...shared.sse_utils import sse_event, sse_done, sse_error, sse_response
from . import service
from .schemas import (
    CrisisTriggerRequest,
    EmotionChatIn,
    EmotionMessageLogRequest,
    EmotionSuggestRequest,
    GrowthRecordCreateRequest,
)

router = APIRouter(tags=["情绪树洞"])
logger = logging.getLogger("emotion_router")


# ═══════ 流程状态机（Phase 4） ═══════

class FlowAdvanceIn(BaseModel):
    next_stage: str = ""


@router.get("/emotion/flow-state")
def get_flow_state(user: CurrentUser = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    """获取情绪树洞当前流程阶段。"""
    from ...engines.flow_state_machine import get_user_stage
    return ok(get_user_stage(db, user.user_id, "mh"))


@router.post("/emotion/flow-advance")
def advance_flow(body: FlowAdvanceIn,
                 user: CurrentUser = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    """推进到下一流程阶段。"""
    from ...engines.flow_state_machine import advance_stage
    next_s = body.next_stage if body.next_stage else None
    return ok(advance_stage(db, user.user_id, "mh", next_s))


@router.post("/emotion/flow-resume")
def resume_flow(user: CurrentUser = Depends(get_current_user),
                db: Session = Depends(get_db)):
    """恢复中断的流程（或开始新流程）。"""
    from ...engines.flow_state_machine import resume_flow
    return ok(resume_flow(db, user.user_id, "mh"))


# ═══════════════════════════════════════════════
# 情绪概览
# ═══════════════════════════════════════════════
@router.get("/emotion/today")
def get_today_emotion(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取今日情绪概览：当前情绪、评分、勇气值、是否有今日倾诉。"""
    return ok(service.get_today_emotion(db, user.user_id))


# ═══════════════════════════════════════════════
# 对话消息
# ═══════════════════════════════════════════════
@router.post("/emotion/log")
def log_emotion_message(
    body: EmotionMessageLogRequest,
    user: CurrentUser = Depends(get_current_user),
):
    """记录一条倾诉对话消息。"""
    return ok(service.log_emotion_message(
        user_id=user.user_id,
        role=body.role,
        text=body.text,
        duration_seconds=body.duration_seconds,
    ))


# ═══════════════════════════════════════════════
# 共情回复
# ═══════════════════════════════════════════════
@router.post("/emotion/suggest")
def get_emotion_suggest(
    body: EmotionSuggestRequest,
    user: CurrentUser = Depends(get_current_user),
):
    """获取小耕共情回复。基于用户消息生成温柔的陪伴性回应。"""
    return ok(service.generate_suggest(body.message))


# ═══════ 情绪树洞 AI 对话 ═══════

@router.post("/emotion/chat")
def emotion_chat(
    body: EmotionChatIn,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    stream: bool = Query(default=True, description="是否使用 SSE 流式输出"),
    fast_mode: bool = Query(default=False, description="Phase 3: 快速模型模式"),
):
    """情绪树洞 AI 对话 — 所有小耕回复由AI模型生成。

    - stream=true（默认）：SSE 流式输出，逐字返回 AI 回复
    - stream=false：传统 JSON 响应（向后兼容）

    AI根据对话历史和当前消息生成温暖共情的回复，
    遵循三不原则（不评判/不否定/不急给建议）。
    支持空消息（初始问候）。
    """
    if not stream:
        # 向后兼容：传统非流式模式
        data = service.process_emotion_chat(
            message=body.message,
            context=body.context,
            elapsed_seconds=body.elapsed_seconds,
            user_id=user.user_id,
            db=db,
        )
        return ok(data)

    # SSE 流式模式
    from ...engines.persona import build_persona_prompt
    from ...engines.llm_orchestrator import llm_generate_stream_with_orchestration

    def generate_sse():
        try:
            # Phase 4: 读取流程阶段（后端控制）
            current_stage = "vent"
            try:
                from ...engines.flow_state_machine import get_user_stage, resume_flow
                # 确保有活跃流程
                flow_info = resume_flow(db, user.user_id, "mh")
                stage_info = flow_info["stage"]
                current_stage = stage_info["current_stage"]
            except Exception:
                pass

            # Phase 4.2: 30分钟强制提醒
            if body.elapsed_seconds and body.elapsed_seconds >= 1800:
                yield sse_event(
                    "已经聊了30分钟，要不要休息一下？小耕会一直在这里陪着您～",
                    "time_reminder"
                )

            # 阶段引导词（4阶段情绪树洞）
            MH_STAGE_GUIDANCE = {
                "vent": "当前是【尽情倾诉】阶段。极温柔、极耐心地倾听，承接用户的任何情绪，不评判不打断。",
                "reflect": "当前是【情绪识别+共情】阶段。帮用户识别和命名情绪，给予深度共情，让用户感到被理解。",
                "reframe": "当前是【认知重构】阶段。温柔引导用户换个角度看问题，发现新的可能性。不要强行鼓励。",
                "growth": "当前是【成长记录】阶段。帮用户回顾这次倾诉的收获，记录成长，更新勇气值。",
            }
            stage_guidance = MH_STAGE_GUIDANCE.get(current_stage, "")

            # Phase 5: RAG 知识检索注入
            rag_text = ""
            rag_sources: list[dict] = []
            try:
                from ...services.search_rag.service import search_rag_for_prompt
                rag_text, rag_sources = search_rag_for_prompt(
                    db, user.user_id, body.message or "", module="emotion_treehole", top_k=3
                )
            except Exception:
                pass

            # 构建对话历史文本
            context_text = ""
            if body.context:
                recent = body.context[-10:]
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
                    f"{stage_guidance}\n\n"
                    "用户打开了情绪树洞，还没有说话。\n"
                    "请以极温柔、极耐心的方式欢迎用户，创造一个安全、包容的倾诉空间。\n"
                    "可以自然融入品牌语「心事有处说，烦恼变智慧」。\n"
                    "2-3句话，温柔但不能让用户感到压力。"
                )
            else:
                combined_prompt = (
                    f"{stage_guidance}\n\n"
                    f"【对话历史】：\n{context_text}\n\n"
                    f"【用户倾诉】：{body.message}\n\n"
                    f"请严格遵循当前阶段的任务，以小耕的身份（极度温柔、极度耐心、像树洞一样）回应。\n"
                    f"遵循三不原则：不评判、不否定、不急给建议。先共情，再回应。\n"
                    f"如果用户情绪低落，给予温柔的承接和陪伴。2-4句话。"
                    f"{rag_text}"
                )

            system_prompt = build_persona_prompt(module="emotion_treehole")

            tokens = llm_generate_stream_with_orchestration(
                prompt=combined_prompt,
                system_prompt=system_prompt,
                module="emotion_treehole",
                temperature=0.8,
                user_id=user.user_id,
                db=db,
                fast_mode=fast_mode,
            )
            for token in tokens:
                yield sse_event(token, "content")
            # Phase 5: RAG 来源
            if rag_sources:
                yield sse_event(rag_sources, "sources")

            yield sse_done({"model_used": "stream"})

        except Exception as e:
            logger.exception("情绪树洞SSE流式异常")
            yield sse_error("小耕正在努力思考中，稍等一下哦～")

    return sse_response(generate_sse())


# ═══════════════════════════════════════════════
# 危机干预
# ═══════════════════════════════════════════════
@router.post("/emotion/crisis")
def trigger_crisis(
    body: CrisisTriggerRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """触发危机干预。记录危机事件并返回心理援助热线。"""
    return ok(service.trigger_crisis_intervention(
        db, user.user_id, body.reason,
    ))


# ═══════════════════════════════════════════════
# 情绪历史
# ═══════════════════════════════════════════════
@router.get("/emotion/history")
def get_emotion_history(
    week: str | None = Query(None),
    month: str | None = Query(None),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取情绪历史。
    - week=current → 返回本周情绪趋势（WeeklyEmotionResponse 格式）
    - month=current → 返回历史记录列表（EmotionDaySummaryResponse[] 格式）
    """
    if week == "current":
        return ok(service.get_weekly_emotion(db, user.user_id))
    return ok(service.get_emotion_history(db, user.user_id, month))


# ═══════════════════════════════════════════════
# 成长记录
# ═══════════════════════════════════════════════
@router.get("/growth/records")
def get_growth_records(
    limit: int = Query(default=10, le=50),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取成长记录列表，按日期倒序。"""
    return ok(service.get_growth_records(db, user.user_id, limit))


@router.post("/growth/record")
def create_growth_record(
    body: GrowthRecordCreateRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """结束倾诉时创建成长记录。分析对话内容，萃取成长洞察，更新勇气值。"""
    return ok(service.create_growth_record(
        db=db,
        user_id=user.user_id,
        chat_messages=body.chat_messages,
        emotion_score=body.emotion_score,
        courage_value=body.courage_value,
        duration_minutes=body.duration_minutes,
    ))


# ═══════════════════════════════════════════════
# 跨模块：次日关怀检查
# ═══════════════════════════════════════════════
@router.get("/emotion/yesterday-check")
def check_yesterday(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """检查昨日是否有危机或低落情绪（供朝有规划开场时调用）。"""
    return ok(service.check_yesterday_crisis(db, user.user_id))
