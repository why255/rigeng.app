"""计划服务 业务逻辑层。

实现：创建计划/获取今日计划/更新任务/移动象限/归档/统计/离线同步。
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from ...shared import errors
from ...shared.database import utcnow
from ...shared.models.plan import Plan, PlanTask, QUADRANTS, TASK_SOURCES, TASK_STATUSES


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
