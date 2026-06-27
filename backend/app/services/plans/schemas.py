"""计划服务 请求/响应模型。"""
from __future__ import annotations

from pydantic import BaseModel, Field


class TaskCreateIn(BaseModel):
    title: str = Field(min_length=1, max_length=512)
    description: str | None = None
    quadrant: str = "not_urgent_important"
    source: str = "user_input"
    time_estimate: str | None = None


class PlanCreateIn(BaseModel):
    title: str = "今日计划"
    tasks: list[TaskCreateIn] = Field(default_factory=list)


class PlanUpdateIn(BaseModel):
    title: str | None = None


class TaskUpdateIn(BaseModel):
    title: str | None = None
    description: str | None = None
    quadrant: str | None = None
    status: str | None = None
    sort_order: int | None = None
    time_estimate: str | None = None


class TaskMoveIn(BaseModel):
    new_quadrant: str


class ArchiveIn(BaseModel):
    date: str | None = None  # YYYY-MM-DD


class SyncItem(BaseModel):
    action: str  # create_plan | update_task | complete_plan
    payload: dict
    timestamp: float


class SyncIn(BaseModel):
    items: list[SyncItem] = Field(default_factory=list)


class TaskAddIn(BaseModel):
    title: str = Field(min_length=1, max_length=512)
    description: str | None = None
    quadrant: str = "not_urgent_important"
    source: str = "user_input"
    time_estimate: str | None = None


class PromoteIn(BaseModel):
    task_ids: list[str] = Field(default_factory=list)
    source: str = "yesterday_unfinished"  # yesterday_unfinished | smart_record_sync


class TaskOut(BaseModel):
    id: str
    plan_id: str
    title: str
    description: str | None = None
    quadrant: str
    source: str
    status: str
    sort_order: int = 0
    time_estimate: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class PlanOut(BaseModel):
    id: str
    user_id: str
    title: str
    status: str
    stats: dict | None = None
    tasks: list[TaskOut] = Field(default_factory=list)
    created_at: str | None = None
    updated_at: str | None = None
