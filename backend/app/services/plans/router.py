"""计划服务 路由层。"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...shared.database import get_db
from ...shared.errors import APIError
from ...shared.response import ok
from ...shared.security import CurrentUser, get_current_user
from . import service
from .schemas import ArchiveIn, PlanCreateIn, PlanUpdateIn, PromoteIn, SyncIn, TaskAddIn, TaskMoveIn, TaskUpdateIn

router = APIRouter(tags=["朝有规划"])


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
