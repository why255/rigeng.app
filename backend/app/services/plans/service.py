"""计划服务 业务逻辑层。

实现：创建计划/获取今日计划/更新任务/移动象限/归档/统计/离线同步。
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger("plans")

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from ...engines.persona import build_persona_prompt
from ...engines.llm_orchestrator import llm_generate_with_orchestration
from ...engines.security_compliance import desensitize
from ...engines.data_foundation import emit_event
from ...shared import errors
from ...shared.database import utcnow
from ...shared.llm_utils import safe_extract_json
from ...shared.models.plan import Plan, PlanTask, QUADRANTS, TASK_SOURCES, TASK_STATUSES

logger = logging.getLogger("plans_service")


def _enum_guard(value, allowed, field_name):
    if value is not None and value not in allowed:
        raise errors.APIError(errors.E_PARAM_FORMAT.code, f"{field_name} 取值非法: {value}", 400)


def _today_range():
    """返回今日 UTC 起止（naive datetime，与 created_at 的 utcnow 一致）。"""
    today = datetime.now(timezone.utc).date()
    start = datetime(today.year, today.month, today.day, 0, 0, 0)
    end = datetime(today.year, today.month, today.day, 23, 59, 59)
    return start, end


def _task_out(t: PlanTask) -> dict:
    return {
        "id": t.id, "plan_id": t.plan_id, "title": t.title,
        "description": t.description, "quadrant": t.quadrant,
        "source": t.source, "status": t.status, "sort_order": t.sort_order,
        "time_estimate": t.time_estimate,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


def _plan_out(p: Plan, tasks: list[PlanTask] | None = None) -> dict:
    return {
        "id": p.id, "user_id": p.user_id, "title": p.title, "status": p.status,
        "stats": p.stats_json or _compute_stats(tasks or []),
        "tasks": [_task_out(t) for t in (tasks or [])],
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


def _compute_stats(tasks: list[PlanTask]) -> dict:
    total = len(tasks)
    completed = sum(1 for t in tasks if t.status == "completed")
    rate = round(completed / total * 100) if total > 0 else 0
    pending = total - completed
    return {"total_tasks": total, "completed_tasks": completed, "completion_rate": rate, "pending_tasks": pending}


# ═══════ 计划 CRUD ═══════

def create_plan(db: Session, *, user_id: str, title: str, tasks_in: list[dict]) -> dict:
    """创建新计划（含任务）。如果今日已有活跃计划则返回冲突错误。"""
    start, end = _today_range()
    existing = db.scalar(
        select(Plan).where(
            and_(
                Plan.user_id == user_id,
                Plan.created_at >= start,
                Plan.created_at <= end,
                Plan.status.in_(["draft", "active"]),
            )
        )
    )
    if existing:
        raise errors.APIError(errors.E_PARAM_FORMAT.code, "今日已有计划，请先归档后再创建", 409)

    plan = Plan(user_id=user_id, title=title, status="active")
    db.add(plan)
    db.flush()

    tasks = []
    for i, ti in enumerate(tasks_in):
        _enum_guard(ti.get("quadrant", "not_urgent_important"), QUADRANTS, "quadrant")
        _enum_guard(ti.get("source", "user_input"), TASK_SOURCES, "source")
        t = PlanTask(
            plan_id=plan.id, user_id=user_id,
            title=ti["title"], description=ti.get("description"),
            quadrant=ti.get("quadrant", "not_urgent_important"),
            source=ti.get("source", "user_input"),
            time_estimate=ti.get("time_estimate"),
            sort_order=i,
        )
        db.add(t)
        tasks.append(t)

    plan.stats_json = _compute_stats(tasks)
    db.commit()
    return _plan_out(plan, tasks)


def get_today_plan(db: Session, *, user_id: str) -> dict | None:
    """获取今日活跃计划。"""
    start, end = _today_range()
    plan = db.scalar(
        select(Plan).where(
            and_(
                Plan.user_id == user_id,
                Plan.created_at >= start,
                Plan.created_at <= end,
                Plan.status.in_(["draft", "active", "completed"]),
            )
        ).order_by(Plan.created_at.desc())
    )
    if not plan:
        return None
    tasks = list(
        db.scalars(
            select(PlanTask).where(
                and_(PlanTask.plan_id == plan.id, PlanTask.deleted_at.is_(None))
            ).order_by(PlanTask.sort_order)
        )
    )
    return _plan_out(plan, tasks)


def get_plan(db: Session, *, plan_id: str, user_id: str) -> dict:
    plan = db.get(Plan, plan_id)
    if not plan or plan.user_id != user_id:
        raise errors.APIError(30050, "计划不存在", 404)
    tasks = list(
        db.scalars(
            select(PlanTask).where(
                and_(PlanTask.plan_id == plan_id, PlanTask.deleted_at.is_(None))
            ).order_by(PlanTask.sort_order)
        )
    )
    return _plan_out(plan, tasks)


def update_plan(db: Session, *, plan_id: str, user_id: str, title: str | None) -> dict:
    plan = db.get(Plan, plan_id)
    if not plan or plan.user_id != user_id:
        raise errors.APIError(30050, "计划不存在", 404)
    if title is not None:
        plan.title = title
    db.commit()
    tasks = list(
        db.scalars(
            select(PlanTask).where(
                and_(PlanTask.plan_id == plan_id, PlanTask.deleted_at.is_(None))
            ).order_by(PlanTask.sort_order)
        )
    )
    return _plan_out(plan, tasks)


def update_task(db: Session, *, task_id: str, plan_id: str, user_id: str,
                title: str | None, description: str | None, quadrant: str | None,
                status: str | None, sort_order: int | None, time_estimate: str | None) -> dict:
    task = db.get(PlanTask, task_id)
    if not task or task.plan_id != plan_id or task.user_id != user_id:
        raise errors.APIError(30051, "任务不存在", 404)

    _enum_guard(quadrant, QUADRANTS, "quadrant")
    _enum_guard(status, TASK_STATUSES, "status")

    if title is not None:
        task.title = title
    if description is not None:
        task.description = description
    if quadrant is not None:
        task.quadrant = quadrant
    if status is not None:
        task.status = status
    if sort_order is not None:
        task.sort_order = sort_order
    if time_estimate is not None:
        task.time_estimate = time_estimate

    db.flush()  # 先flush让task变更可见，但不提交

    # 在同一事务中更新计划统计（排除已软删除的任务）
    tasks = list(
        db.scalars(
            select(PlanTask).where(
                and_(PlanTask.plan_id == plan_id, PlanTask.deleted_at.is_(None))
            )
        )
    )
    plan = db.get(Plan, plan_id)
    if plan:
        plan.stats_json = _compute_stats(tasks)
    db.commit()  # 原子提交：task变更 + stats更新

    return _task_out(task)


def move_task_quadrant(db: Session, *, task_id: str, plan_id: str, user_id: str,
                       new_quadrant: str) -> dict:
    """拖拽移动任务到新象限。"""
    _enum_guard(new_quadrant, QUADRANTS, "new_quadrant")
    task = db.get(PlanTask, task_id)
    if not task or task.plan_id != plan_id or task.user_id != user_id:
        raise errors.APIError(30051, "任务不存在", 404)
    task.quadrant = new_quadrant
    db.commit()
    return _task_out(task)


def confirm_plan(db: Session, *, plan_id: str, user_id: str) -> dict:
    """确认今日计划（设为active状态，不标记任何任务为已完成）。

    对应新流程：用户在list页点击「确认今日计划」后调用，
    计划从draft变为active，所有任务保持pending状态。
    """
    plan = db.get(Plan, plan_id)
    if not plan or plan.user_id != user_id:
        raise errors.APIError(30050, "计划不存在", 404)
    plan.status = "active"
    tasks = list(
        db.scalars(
            select(PlanTask).where(
                and_(PlanTask.plan_id == plan_id, PlanTask.deleted_at.is_(None))
            )
        )
    )
    plan.stats_json = _compute_stats(tasks)
    db.commit()
    return _plan_out(plan, tasks)


def complete_plan(db: Session, *, plan_id: str, user_id: str) -> dict:
    """标记计划为已完成，计算最终统计。"""
    plan = db.get(Plan, plan_id)
    if not plan or plan.user_id != user_id:
        raise errors.APIError(30050, "计划不存在", 404)
    plan.status = "completed"
    tasks = list(
        db.scalars(
            select(PlanTask).where(
                and_(PlanTask.plan_id == plan_id, PlanTask.deleted_at.is_(None))
            )
        )
    )
    plan.stats_json = _compute_stats(tasks)
    db.commit()
    return _plan_out(plan, tasks)


def archive_plan(db: Session, *, plan_id: str, user_id: str, date_str: str | None) -> dict:
    """归档计划（软删除）。"""
    plan = db.get(Plan, plan_id)
    if not plan or plan.user_id != user_id:
        raise errors.APIError(30050, "计划不存在", 404)
    plan.status = "archived"
    plan.deleted_at = utcnow()
    db.commit()
    return {"archived": True, "plan_id": plan_id}


# ═══════ 任务 CRUD 补充 ═══════

def delete_task(db: Session, *, task_id: str, plan_id: str, user_id: str) -> dict:
    """删除任务（软删除）。"""
    task = db.get(PlanTask, task_id)
    if not task or task.plan_id != plan_id or task.user_id != user_id:
        raise errors.APIError(30051, "任务不存在", 404)
    task.deleted_at = utcnow()
    db.flush()

    # 更新计划统计
    tasks = list(
        db.scalars(select(PlanTask).where(
            and_(PlanTask.plan_id == plan_id, PlanTask.deleted_at.is_(None))
        ))
    )
    plan = db.get(Plan, plan_id)
    if plan:
        plan.stats_json = _compute_stats(tasks)
    db.commit()
    return {"deleted": True, "task_id": task_id}


def add_task(db: Session, *, plan_id: str, user_id: str,
             title: str, description: str | None, quadrant: str,
             source: str, time_estimate: str | None) -> dict:
    """向已有计划添加任务。"""
    plan = db.get(Plan, plan_id)
    if not plan or plan.user_id != user_id:
        raise errors.APIError(30050, "计划不存在", 404)

    _enum_guard(quadrant, QUADRANTS, "quadrant")
    _enum_guard(source, TASK_SOURCES, "source")

    # 计算当前最大 sort_order
    max_order = db.scalar(
        select(PlanTask.sort_order).where(PlanTask.plan_id == plan_id).order_by(PlanTask.sort_order.desc())
    ) or -1

    task = PlanTask(
        plan_id=plan_id, user_id=user_id,
        title=title, description=description,
        quadrant=quadrant, source=source,
        time_estimate=time_estimate,
        sort_order=max_order + 1,
    )
    db.add(task)
    db.flush()

    # 更新计划统计
    tasks = list(
        db.scalars(select(PlanTask).where(
            and_(PlanTask.plan_id == plan_id, PlanTask.deleted_at.is_(None))
        ))
    )
    plan.stats_json = _compute_stats(tasks)
    db.commit()
    return _task_out(task)


def promote_tasks(db: Session, *, plan_id: str, user_id: str,
                  task_ids: list[str], source: str = "yesterday_unfinished") -> dict:
    """将任务提升到今日计划（从昨日未完成或智能记录同步）。"""
    plan = db.get(Plan, plan_id)
    if not plan or plan.user_id != user_id:
        raise errors.APIError(30050, "计划不存在", 404)

    if source not in TASK_SOURCES:
        raise errors.APIError(errors.E_PARAM_FORMAT.code, f"source 取值非法: {source}", 400)

    promoted = []
    for task_id in task_ids:
        source_task = db.get(PlanTask, task_id)
        if not source_task or source_task.user_id != user_id:
            continue
        # 复制为今日任务
        new_task = PlanTask(
            plan_id=plan_id, user_id=user_id,
            title=source_task.title,
            description=source_task.description,
            quadrant=source_task.quadrant,
            source=source,
            time_estimate=source_task.time_estimate,
            sort_order=999 + len(promoted),  # 排到末尾
        )
        db.add(new_task)
        promoted.append(new_task)

    if promoted:
        db.flush()
        # 重新计算所有任务的 sort_order（确保连续）
        all_tasks = list(
            db.scalars(select(PlanTask).where(
                and_(PlanTask.plan_id == plan_id, PlanTask.deleted_at.is_(None))
            ).order_by(PlanTask.sort_order))
        )
        for i, t in enumerate(all_tasks):
            t.sort_order = i
        plan.stats_json = _compute_stats(all_tasks)

    db.commit()
    return {"promoted": len(promoted), "task_ids": [t.id for t in promoted]}


def sync_offline(db: Session, *, user_id: str, items: list[dict]) -> dict:
    """批量同步离线操作。简单策略：逐条应用，冲突时跳过。"""
    results = []
    for item in items:
        action = item.get("action")
        payload = item.get("payload", {})
        try:
            if action == "create_plan":
                tasks_in = payload.get("tasks", [])
                r = create_plan(db, user_id=user_id, title=payload.get("title", "今日计划"), tasks_in=tasks_in)
                results.append({"action": action, "status": "ok", "plan_id": r["id"]})
            elif action == "update_task":
                r = update_task(
                    db, task_id=payload.get("task_id"), plan_id=payload.get("plan_id"),
                    user_id=user_id, title=payload.get("title"), description=payload.get("description"),
                    quadrant=payload.get("quadrant"), status=payload.get("status"),
                    sort_order=payload.get("sort_order"), time_estimate=payload.get("time_estimate"),
                )
                results.append({"action": action, "status": "ok", "task_id": r["id"]})
            elif action == "complete_plan":
                r = complete_plan(db, plan_id=payload.get("plan_id"), user_id=user_id)
                results.append({"action": action, "status": "ok", "plan_id": r["id"]})
            else:
                results.append({"action": action, "status": "skipped", "reason": "unknown action"})
        except errors.APIError as e:
            results.append({"action": action, "status": "conflict", "message": e.message})
    return {"synced": len([r for r in results if r.get("status") == "ok"]), "results": results}


# ═══════ 统计查询 ═══════

def get_plan_stats(db: Session, *, user_id: str) -> dict:
    """今日计划概览统计（P1 入口页用）。"""
    plan_data = get_today_plan(db, user_id=user_id)
    if not plan_data:
        return {"task_count": 0, "completion_rate": 0, "pending_count": 0}
    stats = plan_data.get("stats", {})
    return {
        "task_count": stats.get("total_tasks", 0),
        "completion_rate": stats.get("completion_rate", 0),
        "pending_count": stats.get("pending_tasks", 0),
    }


def get_yesterday_unfinished(db: Session, *, user_id: str) -> dict:
    """昨日未完成任务列表（P1 入口页用）。"""
    yesterday = datetime.now(timezone.utc).date() - timedelta(days=1)
    y_start = datetime(yesterday.year, yesterday.month, yesterday.day, 0, 0, 0)
    y_end = datetime(yesterday.year, yesterday.month, yesterday.day, 23, 59, 59)

    plan = db.scalar(
        select(Plan).where(
            and_(
                Plan.user_id == user_id,
                Plan.created_at >= y_start,
                Plan.created_at <= y_end,
                Plan.status != "archived",
            )
        ).order_by(Plan.created_at.desc())
    )
    if not plan:
        return {"tasks": []}

    tasks = list(
        db.scalars(
            select(PlanTask).where(
                and_(PlanTask.plan_id == plan.id, PlanTask.status == "pending")
            ).order_by(PlanTask.sort_order)
        )
    )
    return {"tasks": [_task_out(t) for t in tasks]}


def get_smart_record_sync(db: Session, *, user_id: str) -> dict:
    """智能记录同步的任务列表（P1 入口页用）。"""
    tasks = list(
        db.scalars(
            select(PlanTask).where(
                and_(
                    PlanTask.user_id == user_id,
                    PlanTask.source == "smart_record_sync",
                    PlanTask.status == "pending",
                )
            ).order_by(PlanTask.created_at.desc()).limit(10)
        )
    )
    return {"tasks": [_task_out(t) for t in tasks]}


# ═══════ AI 算法引擎（日耕模块算法设计文档 V2.0） ═══════

_MODULE_KEY = "morning_plan"
_MODULE_TEMPERATURE = 0.3


def get_carryover_context(db: Session, *, user_id: str) -> dict:
    """收集昨日未完成任务和智能记录行动项，作为 LLM 上下文。

    Returns:
        {"yesterday_tasks": [...], "smart_record_items": [...], "context_text": str}
    """
    # 昨日未完成任务
    yesterday = datetime.now(timezone.utc).date() - timedelta(days=1)
    y_start = datetime(yesterday.year, yesterday.month, yesterday.day, 0, 0, 0)
    y_end = datetime(yesterday.year, yesterday.month, yesterday.day, 23, 59, 59)

    y_plan = db.scalar(
        select(Plan).where(
            and_(
                Plan.user_id == user_id,
                Plan.created_at >= y_start,
                Plan.created_at <= y_end,
                Plan.status != "archived",
            )
        ).order_by(Plan.created_at.desc())
    )

    yesterday_tasks: list[dict] = []
    if y_plan:
        y_tasks = list(
            db.scalars(
                select(PlanTask).where(
                    and_(
                        PlanTask.plan_id == y_plan.id,
                        PlanTask.deleted_at.is_(None),
                        PlanTask.status == "pending",
                    )
                ).order_by(PlanTask.sort_order)
            )
        )
        yesterday_tasks = [_task_out(t) for t in y_tasks]

    # 智能记录同步的待处理行动项
    sr_tasks = list(
        db.scalars(
            select(PlanTask).where(
                and_(
                    PlanTask.user_id == user_id,
                    PlanTask.source == "smart_record_sync",
                    PlanTask.status == "pending",
                    PlanTask.deleted_at.is_(None),
                )
            ).order_by(PlanTask.created_at.desc()).limit(10)
        )
    )
    smart_record_items = [_task_out(t) for t in sr_tasks]

    # 构建 LLM 可用的上下文文本
    parts: list[str] = []
    if yesterday_tasks:
        parts.append("昨日未完成事项：")
        for t in yesterday_tasks:
            parts.append(f"  - {t['title']}")
    if smart_record_items:
        parts.append("智能记录待处理行动项：")
        for t in smart_record_items:
            parts.append(f"  - {t['title']}")

    context_text = "\n".join(parts) if parts else ""

    return {
        "yesterday_tasks": yesterday_tasks,
        "smart_record_items": smart_record_items,
        "context_text": context_text,
    }


def parse_plan_from_speech(transcript: str, user_id: str | None = None, db=None) -> dict:
    """口语化描述解析算法。

    从用户自由语音转写文本中提取结构化计划事项。

    Args:
        transcript: 用户口语化描述的转写文本
        user_id: 用户ID
        db: 数据库会话

    Returns:
        {"items": [...], "raw_response": str}
        每个 item: {title, time_hint, type, is_continuation}
    """
    try:
        # 安全脱敏
        safe_transcript = desensitize(transcript, module=_MODULE_KEY)

        # 获取延续上下文
        carryover_text = ""
        if db and user_id:
            try:
                ctx = get_carryover_context(db, user_id=user_id)
                if ctx["context_text"]:
                    carryover_text = f"\n\n用户昨日/之前的未完成事项参考：\n{ctx['context_text']}"
            except Exception:
                pass  # 上下文获取失败不阻塞主流程

        system_prompt = build_persona_prompt(module=_MODULE_KEY)

        prompt = (
            "从以下口语化描述中提取所有计划事项。每项必须含:\n"
            " 1. 事项名称(简洁，≤15字)\n"
            " 2. 时间意图(上午/下午/全天/无明确时间)\n"
            " 3. 类型标签(会议/方案/面试/汇报/日常/学习/沟通/其他)\n"
            " 4. 是否为延续事项(提到'上次/之前/继续/还没/昨天/上回'→标记为延续)\n"
            f" 返回JSON数组 [{{title, time_hint, type, is_continuation}}]\n\n"
            f"用户描述:\n{safe_transcript}"
            f"{carryover_text}"
        )

        result = llm_generate_with_orchestration(
            prompt=prompt,
            system_prompt=system_prompt,
            module=_MODULE_KEY,
            task_complexity="medium",
            temperature=_MODULE_TEMPERATURE,
            user_id=user_id,
            db=db,
        )

        parsed = safe_extract_json(result.get("content", ""), default=[])
        if not isinstance(parsed, list):
            parsed = []

        items = []
        for item in parsed:
            if isinstance(item, dict):
                items.append({
                    "title": str(item.get("title", "")).strip()[:15],
                    "time_hint": item.get("time_hint", "无明确时间"),
                    "type": item.get("type", "日常"),
                    "is_continuation": bool(item.get("is_continuation", False)),
                })

        # 事件发射
        if user_id:
            emit_event(user_id, "plans", "plan.created",
                       {"task_count": len(items), "source": "speech_parsing"})

        return {"items": items, "raw_response": result.get("content", "")}

    except Exception as e:
        logger.warning("口语化描述解析失败: %s", e)
        return {"items": [], "raw_response": ""}


def classify_quadrant(items: list[dict], user_id: str | None = None, db=None) -> list[dict]:
    """四象限自动分类算法。

    为每件事项标注艾森豪威尔四象限并给出分类理由。

    Args:
        items: 待分类事项列表，每项至少含 {title}
        user_id: 用户ID
        db: 数据库会话

    Returns:
        增强后的事项列表，每项新增 quadrant 和 reason 字段
    """
    if not items:
        return items

    try:
        # 格式化待分类事项
        items_text = "\n".join(
            f"{i + 1}. {item.get('title', '')}"
            f"{' (延续事项)' if item.get('is_continuation') else ''}"
            for i, item in enumerate(items)
        )

        system_prompt = build_persona_prompt(module=_MODULE_KEY)

        prompt = (
            "为以下每件事标注艾森豪威尔四象限，并给出分类理由:\n"
            " 重要紧急(urgent_important): 影响核心目标+Ddl在24h内\n"
            " 重要不紧急(not_urgent_important): 影响核心目标+可规划\n"
            " 紧急不重要(urgent_not_important): 不直接影响核心目标+必须今天处理\n"
            " 不重要不紧急(not_urgent_not_important): 既不重要也不紧急"
            "(标注后温和建议是否可以不做/委派)\n\n"
            "已知用户身份为HR经理，她的核心目标通常包括:\n"
            " - 完成招聘KPI / 薪酬体系优化 / 绩效体系落地 / 员工关系维护 / 向上汇报\n\n"
            f"待分类事项:\n{items_text}\n\n"
            "返回JSON数组 [{index: 序号, quadrant: 象限key, reason: 分类理由(≤30字)}]"
        )

        result = llm_generate_with_orchestration(
            prompt=prompt,
            system_prompt=system_prompt,
            module=_MODULE_KEY,
            task_complexity="medium",
            temperature=_MODULE_TEMPERATURE,
            user_id=user_id,
            db=db,
        )

        parsed = safe_extract_json(result.get("content", ""), default=[])
        if not isinstance(parsed, list):
            parsed = []

        # 将分类结果回填到原 items
        quadrant_map: dict[int, dict] = {}
        for entry in parsed:
            if isinstance(entry, dict):
                idx = entry.get("index", -1)
                if isinstance(idx, int) and 1 <= idx <= len(items):
                    quadrant_map[idx - 1] = {
                        "quadrant": entry.get("quadrant", "not_urgent_important"),
                        "reason": str(entry.get("reason", ""))[:30],
                    }

        enriched = []
        for i, item in enumerate(items):
            enriched_item = dict(item)
            if i in quadrant_map:
                enriched_item["quadrant"] = quadrant_map[i]["quadrant"]
                enriched_item["reason"] = quadrant_map[i]["reason"]
            else:
                enriched_item["quadrant"] = "not_urgent_important"
                enriched_item["reason"] = "自动默认分类"
            enriched.append(enriched_item)

        return enriched

    except Exception as e:
        logger.warning("四象限分类失败，使用默认分类: %s", e)
        # 安全降级：全部归入"重要不紧急"
        return [
            {**item, "quadrant": "not_urgent_important", "reason": "分类服务暂不可用"}
            for item in items
        ]


# ═══════ 朝有规划对话 — 意图识别与分流 ═══════

_INTENT_PROMPT = """判断用户输入属于哪种类型，返回JSON: {"intent": "plan"|"chat", "confidence": 0.0-1.0}

【plan 计划类】用户在描述今天要做的事、待办事项、任务安排、工作计划。包括:
- 明确列出要做的事情（「今天要面试三个人」「下午开会」「把方案写完」）
- 延续之前的事项（「上次那个绩效的事还没弄完」）
- 包含时间安排的事项（「上午...下午...」）
- 日常工作任务描述

【chat 对话类】用户在提问、闲聊、咨询，不是在做计划。包括:
- 提问（「绩效面谈怎么做」「面试要注意什么」）
- 咨询建议（「帮我分析一下...」「这个方案怎么样」）
- 情绪表达（「今天好累」「不想上班」）
- 闲聊（「你好」「谢谢」）
- 任何没有明确描述待办事项的消息

只返回JSON，不要添加其他文字。"""


def classify_message_intent(message: str, user_id: str | None = None, db=None) -> dict:
    """识别用户输入意图：plan(计划类) 或 chat(对话类)。

    使用轻量级LLM快速分类，失败时用规则兜底。

    Returns:
        {"intent": "plan"|"chat", "confidence": float}
    """
    # 规则快速预判（减少LLM调用成本）
    quick_plan_keywords = ["今天", "上午", "下午", "要", "需要", "得", "打算", "准备",
                          "先", "然后", "再", "还有", "另外", "对了"]
    quick_chat_keywords = ["怎么", "如何", "什么", "为什么", "帮我", "分析", "建议",
                          "推荐", "介绍", "解释", "你好", "谢谢", "累", "烦"]

    plan_hints = sum(1 for kw in quick_plan_keywords if kw in message)
    chat_hints = sum(1 for kw in quick_chat_keywords if kw in message)

    # 规则强信号 → 直接判定，不走LLM
    if plan_hints >= 3 and chat_hints == 0:
        return {"intent": "plan", "confidence": 0.85, "method": "rule"}
    if chat_hints >= 3 and plan_hints == 0:
        return {"intent": "chat", "confidence": 0.85, "method": "rule"}

    # 调用LLM精细分类
    try:
        result = llm_generate_with_orchestration(
            prompt=f"用户消息：{message}\n\n{_INTENT_PROMPT}",
            system_prompt=build_persona_prompt(module="morning_plan"),
            module="morning_plan",
            task_complexity="simple",
            temperature=0.1,  # 分类任务需要确定性
            user_id=user_id,
            db=db,
        )
        parsed = safe_extract_json(result.get("content", ""), default={})
        if isinstance(parsed, dict) and "intent" in parsed:
            return {
                "intent": parsed.get("intent", "chat"),
                "confidence": float(parsed.get("confidence", 0.7)),
                "method": "llm",
            }
    except Exception as e:
        logger.warning("意图分类LLM调用失败: %s", e)

    # 兜底：按规则判定
    if plan_hints > chat_hints:
        return {"intent": "plan", "confidence": 0.6, "method": "rule_fallback"}
    return {"intent": "chat", "confidence": 0.6, "method": "rule_fallback"}


def process_morning_chat(message: str, user_id: str, db) -> dict:
    """朝有规划对话 — 纯AI聊天模式。

    用户说任何话都直接走模型回复，小耕以温暖专业的HR闺蜜姐姐身份回应。
    不做意图分流、不提取计划项。

    Returns:
        {"reply": str, "model_used": str}
    """
    try:
        safe_message = desensitize(message, module="morning_plan")
        system_prompt = build_persona_prompt(module="morning_plan")

        prompt = (
            f"用户说：{safe_message}\n\n"
            f"请用小耕的身份（温暖专业的HR闺蜜姐姐）自然回复。\n"
            f"要求：\n"
            f"- 称呼用户「姐」，自称「小耕」\n"
            f"- 语气温暖亲切，自然随和\n"
            f"- 如果用户说的是今天的待办事项/计划类内容，帮ta梳理提炼\n"
            f"- 如果用户问的是HR专业问题，给出专业、实用的建议\n"
            f"- 如果用户表达情绪，先共情再回应\n"
            f"- 回复2-4句话为宜，不要太长"
        )

        result = llm_generate_with_orchestration(
            prompt=prompt,
            system_prompt=system_prompt,
            module="morning_plan",
            task_complexity="medium",
            temperature=0.7,
            user_id=user_id,
            db=db,
        )

        reply = result.get("content", "").strip()
        if not reply:
            reply = "姐，您说的小耕都听到了～有什么我可以帮您的吗？"

        return {
            "reply": reply,
            "model_used": result.get("model_used", ""),
        }

    except Exception as e:
        logger.warning("朝有规划对话LLM失败: %s", e)
        return {
            "reply": "姐，小耕正在努力思考中，稍等一下哦～",
            "model_used": "",
        }


def extract_plan_from_context(messages: list[dict], user_id: str, db) -> dict:
    """从对话上下文中提炼计划项。

    将所有用户消息拼接后调用 parse_plan_from_speech 提取计划。
    也会带上小耕的回复作为上下文，帮助AI更准确理解。

    Returns:
        {"reply": str, "plan_items": [...], "item_count": int}
    """
    if not messages:
        return {"reply": "姐，还没有聊天内容呢，先说点什么吧~", "plan_items": [], "item_count": 0}

    # 拼接所有用户消息为一段文本
    user_texts = []
    for m in messages:
        role = m.get("role", "")
        text = (m.get("text") or m.get("content") or "").strip()
        if text:
            if role == "user":
                user_texts.append(text)
            elif role == "assistant":
                # 小耕的回复作为轻量上下文参考
                user_texts.append(f"(小耕之前回复: {text[:80]})")

    combined = "。".join(user_texts)

    # 调用已有的口语化解析
    parsed = parse_plan_from_speech(combined, user_id=user_id, db=db)
    items = parsed.get("items", [])

    if items:
        count = len(items)
        items_preview = "、".join(item["title"] for item in items[:8])
        if count > 8:
            items_preview += f"等{count}项"
        reply = f"姐，小耕根据咱们刚才聊的内容，梳理出了 {count} 项计划：{items_preview}。要确认这些计划吗？"
    else:
        reply = "姐，小耕仔细看了一遍咱们的聊天，好像还没有明确要做的事呢。再跟我说说今天打算做什么？"

    emit_event(user_id, "plans", "plan.created",
               {"task_count": len(items), "source": "extract_from_context"})

    return {
        "reply": reply,
        "plan_items": items,
        "item_count": len(items),
    }


class GentleFollowUp:
    """三层温柔追问引擎。

    在计划创建/确认流程中，根据上下文温和引导用户补充和优化计划。

    Usage:
        gf = GentleFollowUp()
        if gf.should_ask("完整性确认", context):
            prompt = gf.get_prompt("完整性确认", context)
    """

    def __init__(self):
        self.layers = [
            {
                "name": "完整性确认",
                "trigger": "always",
                "prompt": "姐，还有别的吗？比如昨天没弄完的事、今天临时加的任务？",
            },
            {
                "name": "优先级澄清",
                "trigger": "items_count >= 4",
                "prompt": "姐，这里面哪个最急？小耕帮您排个序~",
            },
            {
                "name": "工作量校验",
                "trigger": "items_count >= 6 or total_hours > 8",
                "prompt": "姐，今天安排了{count}件事，估计要{hours}个小时。会不会太满？要不要把不急的先往后挪？",
            },
        ]

    def should_ask(self, layer_name: str, context: dict | None = None) -> bool:
        """判断当前上下文是否应该触发该层追问。

        Args:
            layer_name: 追问层名称
            context: {items_count, total_hours, user_preference, skip_follow_up}

        Returns:
            是否应该追问
        """
        context = context or {}

        if context.get("skip_follow_up"):
            return False

        layer = next((l for l in self.layers if l["name"] == layer_name), None)
        if not layer:
            return False

        trigger = layer["trigger"]
        if trigger == "always":
            return True

        # 简易 trigger 评估
        items_count = context.get("items_count", 0)
        total_hours = context.get("total_hours", 0)

        try:
            # 替换变量后评估布尔表达式
            expr = trigger.replace("items_count", str(items_count)).replace("total_hours", str(total_hours))
            # 安全评估：仅限比较运算符
            return bool(eval(expr, {"__builtins__": {}}, {}))
        except Exception:
            return True  # 解析失败时默认追问

    def get_prompt(self, layer_name: str, context: dict | None = None) -> str:
        """获取追问提示文案。

        Args:
            layer_name: 追问层名称
            context: {items_count, total_hours}

        Returns:
            追问提示字符串
        """
        context = context or {}
        layer = next((l for l in self.layers if l["name"] == layer_name), None)
        if not layer:
            return ""

        prompt = layer["prompt"]
        prompt = prompt.replace("{count}", str(context.get("items_count", 0)))
        prompt = prompt.replace("{hours}", str(context.get("total_hours", 0)))
        return prompt

    def get_all_prompts(self, context: dict | None = None) -> list[dict]:
        """获取当前上下文下所有应触发的追问提示。

        Returns:
            [{name, prompt}] 列表
        """
        results = []
        for layer in self.layers:
            if self.should_ask(layer["name"], context):
                results.append({
                    "name": layer["name"],
                    "prompt": self.get_prompt(layer["name"], context),
                })
        return results
