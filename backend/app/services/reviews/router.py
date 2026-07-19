"""复盘服务 路由层（步骤11：暮有复盘全部API端点）。"""
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
from .schemas import DiagnoseIn, ReviewChatIn, SaveMessageIn, SopIn

router = APIRouter(tags=["暮有复盘"])
logger = logging.getLogger("reviews_router")


# ═══════ 流程状态机（Phase 4） ═══════

class FlowAdvanceIn(BaseModel):
    next_stage: str = ""


@router.get("/reviews/flow-state")
def get_flow_state(user: CurrentUser = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    """获取暮有复盘当前流程阶段。"""
    from ...engines.flow_state_machine import get_user_stage
    return ok(get_user_stage(db, user.user_id, "er"))


@router.post("/reviews/flow-advance")
def advance_flow(body: FlowAdvanceIn,
                 user: CurrentUser = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    """推进到下一流程阶段。"""
    from ...engines.flow_state_machine import advance_stage
    next_s = body.next_stage if body.next_stage else None
    return ok(advance_stage(db, user.user_id, "er", next_s))


@router.post("/reviews/flow-resume")
def resume_flow(user: CurrentUser = Depends(get_current_user),
                db: Session = Depends(get_db)):
    """恢复中断的流程（或开始新流程）。"""
    from ...engines.flow_state_machine import resume_flow
    return ok(resume_flow(db, user.user_id, "er"))


@router.get("/reviews/stats")
def stats(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """获取今日复盘统计数据（P1 入口页）。"""
    data = service.get_review_stats(db, user_id=user.user_id)
    return ok(data)


@router.get("/reviews/yesterday-summary")
def yesterday_summary(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """获取昨日复盘摘要（P1 入口页）。"""
    data = service.get_yesterday_summary(db, user_id=user.user_id)
    return ok(data)


@router.post("/reviews/messages")
def save_message(body: SaveMessageIn, user: CurrentUser = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    """保存复盘对话记录（P2 对话页每个阶段结束时触发）。

    自动检测用户拒绝意图，触发温柔坚持机制：
    - 第一次拒绝：返回温柔坚持回复，鼓励用户继续
    - 温柔坚持已用过后再拒绝：尊重用户选择，允许跳过
    """
    data = service.save_review_message(
        db, user_id=user.user_id, stage=body.stage,
        messages=body.messages, emotion_score=body.emotion_score,
        courage_value=body.courage_value,
    )
    return ok(data)


@router.post("/reviews/sop")
def save_sop(body: SopIn, user: CurrentUser = Depends(get_current_user),
             db: Session = Depends(get_db)):
    """生成/保存 SOP（P2 对话页进入归档阶段时触发）。

    自动将SOP归档到知识库（跨模块数据流：复盘→知识库归档）。
    归档失败不阻断SOP保存（降级策略）。
    """
    steps_in = [s.model_dump() for s in body.steps]
    data = service.save_sop(
        db, user_id=user.user_id, title=body.title, steps=steps_in,
        key_phrases=body.key_phrases, precautions=body.precautions,
        reflection_text=body.reflection_text,
    )
    return ok(data)


@router.get("/reviews/sop/today")
def today_sop(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """获取今日生成的 SOP（P3 报告页）。"""
    data = service.get_today_sop(db, user_id=user.user_id)
    return ok(data)


@router.post("/reviews/diagnosis")
def submit_diagnosis(body: DiagnoseIn, user: CurrentUser = Depends(get_current_user),
                     db: Session = Depends(get_db)):
    """提交诊断问卷（P3 报告页）。"""
    data = service.submit_diagnosis(db, user_id=user.user_id, answers=body.model_dump())
    return ok(data)


@router.post("/reviews/archive")
def archive(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """归档今日复盘（P3 报告页）。"""
    data = service.archive_review(db, user_id=user.user_id)
    return ok(data)


@router.get("/reviews/weekly-progress")
def weekly_progress(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """获取本周复盘进度（P4 历史页）。"""
    data = service.get_weekly_progress(db, user_id=user.user_id)
    return ok(data)


@router.get("/reviews/history")
def history(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """获取历史复盘列表（P4 历史页）。"""
    data = service.get_review_history(db, user_id=user.user_id)
    return ok(data)


# ═══════ 暮有复盘 AI 对话 ═══════

@router.post("/reviews/chat")
def review_chat(body: ReviewChatIn,
                user: CurrentUser = Depends(get_current_user),
                db: Session = Depends(get_db),
                stream: bool = Query(default=True, description="是否使用 SSE 流式输出"),
                fast_mode: bool = Query(default=False, description="Phase 3: 快速模型模式")):
    """暮有复盘 AI 对话 — 所有小耕回复由AI模型生成。

    - stream=true（默认）：SSE 流式输出，逐字返回 AI 回复
    - stream=false：传统 JSON 响应（向后兼容）

    AI根据当前阶段(collecting/五阶段)和对话上下文，
    按照复盘的算法引导用户完成复盘。
    前端负责阶段流转控制，后端负责内容生成。
    """
    if not stream:
        # 向后兼容：传统非流式模式
        data = service.process_review_chat(
            message=body.message,
            phase=body.phase,
            stage=body.stage,
            context=body.context,
            info_rounds=body.info_rounds,
            gentle_persistence_used=body.gentle_persistence_used,
            user_id=user.user_id,
            db=db,
        )
        return ok(data)

    # SSE 流式模式
    from ...engines.persona import build_persona_prompt
    from ...engines.llm_orchestrator import llm_generate_stream_with_orchestration

    def generate_sse():
        try:
            module_key = "evening_review"

            # Phase 4: 读取流程阶段（后端控制）
            stage = body.stage or "greeting"
            try:
                from ...engines.flow_state_machine import get_user_stage
                stage_info = get_user_stage(db, user.user_id, "er")
                if stage_info["is_active"]:
                    stage = stage_info["current_stage"]
            except Exception:
                pass

            # 阶段引导词
            ER_STAGE_GUIDANCE = {
                "greeting": "当前是【开篇问候】阶段。温暖问候用户，邀请聊聊今天的经历和复盘意愿。",
                "inventory": "当前是【回顾成就】阶段。帮用户梳理今天完成的事，真诚赞美，捕捉记忆点。",
                "extraction": "当前是【提炼方法论】阶段。帮用户从经验中萃取可复用的方法和SOP。",
                "improvement": "当前是【改进方向】阶段。温和引导用户发现改进空间，制定明日行动。",
                "archive": "当前是【总结归档】阶段。帮用户总结今日复盘收获，温暖有力地收尾。",
            }
            stage_guidance = ER_STAGE_GUIDANCE.get(stage, "")

            # 构建对话历史文本
            context_text = ""
            if body.context:
                recent = body.context[-12:]
                parts = []
                for m in recent:
                    role_label = "姐" if m.get("role") == "user" else "小耕"
                    text = (m.get("text") or m.get("content") or "").strip()
                    if text:
                        parts.append(f"{role_label}：{text}")
                context_text = "\n".join(parts)

            # Phase 5: RAG 知识检索注入
            rag_text = ""
            rag_sources: list[dict] = []
            try:
                from ...services.search_rag.service import search_rag_for_prompt
                rag_text, rag_sources = search_rag_for_prompt(
                    db, user.user_id, body.message or "", module="evening_review", top_k=3
                )
            except Exception:
                pass

            # 根据阶段构建 prompt
            if not body.message.strip():
                if body.phase == "collecting":
                    combined_prompt = (
                        f"{stage_guidance}\n\n"
                        "用户刚打开暮有复盘页面，还没有说过话。\n"
                        "请以温暖的方式打招呼，开启今天的复盘对话。\n"
                        "可以融入品牌语「睡前做复盘，经验变方法」。\n"
                        "邀请用户聊聊今天发生了什么、有什么想复盘的事。\n"
                        "2-3句话即可，热情但不啰嗦。"
                    )
                else:
                    combined_prompt = (
                        f"{stage_guidance}\n\n"
                        "用户之前已经开始了复盘，现在回来了。\n"
                        "请以温暖的方式欢迎用户回来继续复盘。\n"
                        "可以简单回顾一下之前聊了什么，邀请继续。\n"
                        "2-3句话即可。"
                    )
            else:
                combined_prompt = (
                    f"{stage_guidance}\n\n"
                    f"【对话历史】：\n{context_text}\n\n"
                    f"【用户刚说】：{body.message}\n\n"
                    f"请严格遵循当前阶段的任务，根据复盘阶段和对话上下文，以小耕的身份温暖回应。2-4句话为宜。"
                    f"{rag_text}"
                )

            system_prompt = build_persona_prompt(module=module_key)

            tokens = llm_generate_stream_with_orchestration(
                prompt=combined_prompt,
                system_prompt=system_prompt,
                module=module_key,
                temperature=0.7,
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
            logger.exception("暮有复盘SSE流式异常")
            yield sse_error("小耕正在努力思考中，稍等一下哦～")

    return sse_response(generate_sse())


# ── 步骤11 新增端点 ──

@router.get("/reviews/non-review-reminders")
def non_review_reminders(user: CurrentUser = Depends(get_current_user),
                          db: Session = Depends(get_db)):
    """检查连续未复盘天数及应触发的提醒（步骤11：连续未复盘提醒）。

    返回：
    - consecutive_skip_days: 连续未复盘天数
    - reminders: 应触发的提醒列表（3天App推送/5天短信/7天运营官介入）
    - needs_attention: 是否需要关注（≥3天）
    """
    data = service.check_non_review_reminders(db, user_id=user.user_id)
    return ok(data)
