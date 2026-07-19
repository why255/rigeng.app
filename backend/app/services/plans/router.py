"""计划服务 路由层。"""
from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ...shared.database import get_db
from ...shared.errors import APIError
from ...shared.response import ok
from ...shared.security import CurrentUser, get_current_user
from ...shared.sse_utils import sse_event, sse_done, sse_error, sse_response
from . import service
from .schemas import ArchiveIn, ExtractPlanIn, MorningChatIn, PlanCreateIn, PlanUpdateIn, PromoteIn, SyncIn, TaskAddIn, TaskMoveIn, TaskUpdateIn

router = APIRouter(tags=["朝有规划"])
logger = logging.getLogger("plans_router")


@router.get("/plans/today")
def today(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """获取今日活跃计划（含任务列表）。"""
    data = service.get_today_plan(db, user_id=user.user_id)
    return ok(data)


@router.get("/plans/stats")
def stats(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """今日计划概览统计。"""
    data = service.get_plan_stats(db, user_id=user.user_id)
    return ok(data)


@router.get("/plans/yesterday-unfinished")
def yesterday_unfinished(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """昨日未完成任务列表。"""
    data = service.get_yesterday_unfinished(db, user_id=user.user_id)
    return ok(data)


@router.get("/plans/smart-record-sync")
def smart_record_sync(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """智能记录同步任务列表。"""
    data = service.get_smart_record_sync(db, user_id=user.user_id)
    return ok(data)


@router.post("/plans")
def create(body: PlanCreateIn, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """创建新计划。"""
    tasks_in = [t.model_dump() for t in body.tasks]
    data = service.create_plan(db, user_id=user.user_id, title=body.title, tasks_in=tasks_in)
    return ok(data)


@router.post("/plans/sync")
def sync_offline(body: SyncIn, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """批量同步离线操作。"""
    items = [i.model_dump() for i in body.items]
    data = service.sync_offline(db, user_id=user.user_id, items=items)
    return ok(data)


@router.get("/plans/{plan_id}")
def get_one(plan_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """获取指定计划详情。"""
    data = service.get_plan(db, plan_id=plan_id, user_id=user.user_id)
    return ok(data)


@router.patch("/plans/{plan_id}")
def update(plan_id: str, body: PlanUpdateIn, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """更新计划标题。"""
    data = service.update_plan(db, plan_id=plan_id, user_id=user.user_id, title=body.title)
    return ok(data)


@router.patch("/plans/{plan_id}/tasks/{task_id}")
def update_task(plan_id: str, task_id: str, body: TaskUpdateIn,
                user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """更新任务（标题/象限/状态/排序等）。"""
    data = service.update_task(
        db, task_id=task_id, plan_id=plan_id, user_id=user.user_id,
        title=body.title, description=body.description, quadrant=body.quadrant,
        status=body.status, sort_order=body.sort_order, time_estimate=body.time_estimate,
    )
    return ok(data)


@router.patch("/plans/{plan_id}/tasks/{task_id}/quadrant")
def move_quadrant(plan_id: str, task_id: str, body: TaskMoveIn,
                  user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """拖拽移动任务到新象限。"""
    data = service.move_task_quadrant(
        db, task_id=task_id, plan_id=plan_id, user_id=user.user_id,
        new_quadrant=body.new_quadrant,
    )
    return ok(data)


@router.post("/plans/{plan_id}/confirm")
def confirm(plan_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """确认今日计划（设为active，不标记任务完成）。"""
    data = service.confirm_plan(db, plan_id=plan_id, user_id=user.user_id)
    return ok(data)


@router.post("/plans/{plan_id}/complete")
def complete(plan_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """标记计划已完成。"""
    data = service.complete_plan(db, plan_id=plan_id, user_id=user.user_id)
    return ok(data)


@router.post("/plans/{plan_id}/archive")
def archive(plan_id: str, body: ArchiveIn = ArchiveIn(),
            user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """归档计划。"""
    data = service.archive_plan(db, plan_id=plan_id, user_id=user.user_id, date_str=body.date)
    return ok(data)


# ═══════ 任务 CRUD 补充 ═══════

@router.delete("/plans/{plan_id}/tasks/{task_id}")
def delete_task(plan_id: str, task_id: str,
                user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """删除任务（软删除）。"""
    data = service.delete_task(db, task_id=task_id, plan_id=plan_id, user_id=user.user_id)
    return ok(data)


@router.post("/plans/{plan_id}/tasks")
def add_task(plan_id: str, body: TaskAddIn,
             user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """向已有计划添加任务。"""
    data = service.add_task(
        db, plan_id=plan_id, user_id=user.user_id,
        title=body.title, description=body.description,
        quadrant=body.quadrant, source=body.source,
        time_estimate=body.time_estimate,
    )
    return ok(data)


@router.post("/plans/{plan_id}/promote")
def promote_tasks(plan_id: str, body: PromoteIn,
                  user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """将任务提升到今日计划（从昨日未完成或智能记录同步）。"""
    data = service.promote_tasks(
        db, plan_id=plan_id, user_id=user.user_id,
        task_ids=body.task_ids, source=body.source,
    )
    return ok(data)


# ═══════ 流程状态机（Phase 4） ═══════

class FlowAdvanceIn(BaseModel):
    next_stage: str = ""


@router.get("/plans/flow-state")
def get_flow_state(user: CurrentUser = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    """获取朝有规划当前流程阶段。"""
    from ...engines.flow_state_machine import get_user_stage
    return ok(get_user_stage(db, user.user_id, "mp"))


@router.post("/plans/flow-advance")
def advance_flow(body: FlowAdvanceIn,
                 user: CurrentUser = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    """推进到下一流程阶段。不传 next_stage 时自动推进到相邻阶段。"""
    from ...engines.flow_state_machine import advance_stage
    next_s = body.next_stage if body.next_stage else None
    return ok(advance_stage(db, user.user_id, "mp", next_s))


@router.post("/plans/flow-resume")
def resume_flow(user: CurrentUser = Depends(get_current_user),
                db: Session = Depends(get_db)):
    """恢复中断的流程（或开始新流程）。"""
    from ...engines.flow_state_machine import resume_flow
    return ok(resume_flow(db, user.user_id, "mp"))


# ═══════ 朝有规划对话（AI意图识别+分流） ═══════

@router.post("/plans/chat")
def morning_chat(body: MorningChatIn,
                 user: CurrentUser = Depends(get_current_user),
                 db: Session = Depends(get_db),
                 stream: bool = Query(default=True, description="是否使用 SSE 流式输出"),
                 fast_mode: bool = Query(default=False, description="Phase 3: 快速模型模式")):
    """朝有规划对话统一入口。

    - stream=true（默认）：SSE 流式输出，逐字返回 AI 回复
    - stream=false：传统 JSON 响应（向后兼容）

    SSE 事件类型：content | stage_change | done | error
    """
    if not stream:
        # 向后兼容：传统非流式模式
        data = service.process_morning_chat(
            message=body.message,
            user_id=user.user_id,
            db=db,
        )
        return ok(data)

    # SSE 流式模式
    from ...engines.persona import build_persona_prompt
    from ...engines.llm_orchestrator import (
        llm_generate_stream_with_orchestration,
        generate_summary,
    )
    from ...engines.security_compliance import desensitize
    from ...engines.session_context import save_turn
    from ...services.intent.rule_engine import classify_intent, IntentType
    from ...shared.config import settings as _settings

    def generate_sse():
        try:
            safe_message = desensitize(body.message, module="morning_plan")

            # ── Stage-0: 意图分流 ──
            # 规则引擎判定为 SIMPLE(寒暄/致谢/确认)时,走 lite 直答,跳过重量级前奏
            intent = classify_intent(safe_message) if not fast_mode else IntentType.COMPLEX
            if intent == IntentType.SIMPLE:
                lite_reply_text = ""
                try:
                    for token in llm_generate_stream_with_orchestration(
                        prompt=(
                            f"用户说:{safe_message}\n\n"
                            "请以「小耕」(温暖亲切的HR闺蜜姐姐)身份用一句话自然回复。\n"
                            "要求:称呼「姐」;不解释原因;不追问;10-30 字为宜。"
                        ),
                        system_prompt="你是小耕,温暖亲切的HR闺蜜姐姐,擅长简短自然回应寒暄类问候。",
                        module="morning_chat_lite",
                        task_complexity="simple",
                        temperature=0.5,
                        max_tokens=128,
                        user_id=user.user_id,
                        db=db,
                    ):
                        lite_reply_text += token
                        yield sse_event(token, "content")
                except Exception as exc:
                    logger.warning("SIMPLE 意图流式失败,发送兜底: %s", exc)
                    yield sse_event("姐,小耕在这儿呢~", "content")
                    lite_reply_text = "姐,小耕在这儿呢~"

                try:
                    save_turn(user.user_id, "morning_plan", "user", safe_message)
                    save_turn(user.user_id, "morning_plan", "assistant", lite_reply_text)
                except Exception:
                    pass

                yield sse_done({"model_used": "morning_chat_lite", "intent": "simple"})
                return

            # ── COMPLEX 分支 ──
            if fast_mode:
                # ★ P0-2.3 快速通道：跳过重量级操作（Persona 构建、DB 查询、RAG 检索）
                system_prompt = "你是日耕 AI 助手，请用温暖亲切的语气回复用户。"
                stage_guidance_text = ""
                extra_context = ""
                rag_text = ""
                rag_sources: list[dict] = []

                # 异步记录活动追踪（不阻塞响应）
                import threading
                try:
                    from ...engines.user_profiler import track_user_activity
                    threading.Thread(
                        target=track_user_activity,
                        args=(db, user.user_id, "morning_plan_prefetch"),
                        daemon=True,
                    ).start()
                except Exception:
                    pass
            else:
                # ★ 正常通道：完整前奏
                system_prompt = build_persona_prompt(module="morning_plan")

                # Tier 2: morning context injection
                extra_context = ""
                current_stage = "greeting"
                try:
                    from ...engines.user_profiler import generate_morning_context, track_user_activity
                    from ...engines.flow_state_machine import get_user_stage
                    morning_ctx = generate_morning_context(db, user.user_id)
                    if morning_ctx.get("yesterday_unfinished"):
                        items = morning_ctx["yesterday_unfinished"]
                        unfinished_lines = "\n".join(
                            f"  - {t['title']}（{t.get('date', '之前')}）" for t in items[:5]
                        )
                        extra_context += f"\n\n【昨日未完成事项】：\n{unfinished_lines}"
                    if morning_ctx.get("user_profile_summary"):
                        extra_context += f"\n\n【用户习惯】：{morning_ctx['user_profile_summary']}"
                    track_user_activity(db, user.user_id, "morning_plan")
                    # Phase 4: 读取当前流程阶段
                    stage_info = get_user_stage(db, user.user_id, "mp")
                    current_stage = stage_info["current_stage"]
                except Exception:
                    pass

                # 阶段引导词（程序控制，AI 不自行决定跳转）
                STAGE_GUIDANCE = {
                    "greeting": "当前是【问候与回顾】阶段。欢迎用户，回顾昨日未完成事项，自然引导用户开始列出计划。",
                    "inventory": "当前是【列事项】阶段。帮用户梳理今天要做的所有事情，不要评判，让ta尽情列出。",
                    "prioritize": "当前是【排优先级】阶段。帮用户对已列出的事项排序，区分轻重缓急。",
                    "classify": "当前是【四象限分类】阶段。帮用户把事项归类到重要紧急/重要不紧急/不重要但紧急/不重要不紧急四个象限。",
                    "confirm": "当前是【确认计划】阶段。帮用户确认最终计划，鼓励ta。不要引入新的事项。",
                    "archive": "当前是【归档】阶段。帮用户总结今日计划，祝贺完成，提醒下一步行动。",
                }
                stage_guidance_text = STAGE_GUIDANCE.get(current_stage, "")

                # Phase 5: RAG 知识检索注入
                rag_text = ""
                rag_sources: list[dict] = []
                try:
                    from ...services.search_rag.service import search_rag_for_prompt
                    rag_text, rag_sources = search_rag_for_prompt(
                        db, user.user_id, body.message, module="morning_plan", top_k=3
                    )
                except Exception:
                    pass

            prompt = (
                f"{stage_guidance_text}\n\n"
                f"用户说：{safe_message}\n\n"
                f"请用小耕的身份（温暖专业的HR闺蜜姐姐）自然回复。\n"
                f"要求：\n"
                f"- 严格遵循当前阶段的任务，不要跳步骤\n"
                f"- 称呼用户「姐」，自称「小耕」\n"
                f"- 语气温暖亲切，自然随和\n"
                f"- 回复2-4句话为宜，不要太长"
                f"{extra_context}"
                f"{rag_text}"
            )

            # ── Stage-1: lite 摘要(500ms 硬上限,超时静默跳过) ──
            # fast_mode 已经是低延迟通道,不再叠加摘要以避免双重开销
            if _settings.DUAL_STAGE_ENABLED and not fast_mode:
                try:
                    summary = generate_summary(
                        safe_message,
                        timeout_ms=_settings.DUAL_STAGE_SUMMARY_TIMEOUT_MS,
                        user_id=user.user_id,
                        db=db,
                    )
                    if summary:
                        yield sse_event(summary, "summary")
                except Exception as exc:
                    logger.debug("Stage-1 摘要异常,已跳过: %s", exc)

            full_reply = ""
            for token in llm_generate_stream_with_orchestration(
                prompt=prompt,
                system_prompt=system_prompt,
                module="morning_plan",
                task_complexity="medium",
                temperature=0.7,
                user_id=user.user_id,
                db=db,
                fast_mode=fast_mode,
            ):
                full_reply += token
                yield sse_event(token, "content")

            # Phase 5: 发送 RAG 来源标注
            if rag_sources:
                yield sse_event(rag_sources, "sources")

            # Tier 1: save session turn
            try:
                save_turn(user.user_id, "morning_plan", "user", safe_message)
                save_turn(user.user_id, "morning_plan", "assistant", full_reply)
            except Exception:
                pass

            yield sse_done({"model_used": "stream"})

        except Exception as e:
            logger.exception("朝有规划SSE流式异常")
            yield sse_error(f"小耕正在努力思考中，稍等一下哦～")

    return sse_response(generate_sse())


@router.post("/plans/extract")
def extract_plan(body: ExtractPlanIn,
                 user: CurrentUser = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    """从对话上下文中提炼计划项。

    将所有用户消息拼接后调用AI提取结构化计划项。
    返回已提炼的计划列表和小耕确认回复。
    """
    data = service.extract_plan_from_context(
        messages=body.messages,
        user_id=user.user_id,
        db=db,
    )
    return ok(data)


@router.post("/plans/promote-from-yesterday")
def promote_from_yesterday(body: PromoteIn,
                           user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """将昨日未完成任务提升到今日活跃计划。自动查找今日计划。"""
    today_plan = service.get_today_plan(db, user_id=user.user_id)
    if not today_plan:
        raise APIError(30050, "今日还没有计划，请先创建计划", 400)
    data = service.promote_tasks(
        db, plan_id=today_plan["id"], user_id=user.user_id,
        task_ids=body.task_ids, source="yesterday_unfinished",
    )
    return ok(data)
