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


# ── 朝有规划对话 ──

class MorningChatIn(BaseModel):
    """朝有规划对话请求 — 用户输入文本。"""
    message: str = Field(min_length=1, max_length=4096, description="用户消息文本")


class PlanItemOut(BaseModel):
    """提取出的计划项。"""
    title: str = ""
    time_hint: str = "无明确时间"       # 上午/下午/全天/无明确时间
    type: str = "日常"                   # 会议/方案/面试/汇报/日常/学习/沟通/其他
    is_continuation: bool = False       # 是否为延续事项
    quadrant: str | None = None          # 四象限分类(需二次调用 classify_quadrant)
    reason: str | None = None            # 象限分类理由


class MorningChatOut(BaseModel):
    """朝有规划对话响应。"""
    intent: str                          # "plan"(有计划项) | "chat"(一般对话)
    reply: str                           # 小耕回复文本
    plan_items: list[PlanItemOut] = Field(default_factory=list)  # 提取的计划项
    item_count: int = 0                  # 计划项数量


# ── 提炼计划 ──

class ExtractPlanIn(BaseModel):
    """从对话上下文中提炼计划请求。"""
    messages: list[dict] = Field(default_factory=list, description="对话消息列表 [{role, text}]")


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
