"""交付一笔订单服务 — 请求/响应模型（步骤24 / Wave 5）。"""
from __future__ import annotations

from pydantic import BaseModel, Field


# ═══════ 项目建档 ═══════

class ServiceItem(BaseModel):
    """服务清单项。"""
    name: str = ""
    description: str | None = None
    quantity: int = 1
    unit_price: float | None = None


class ProjectCreateRequest(BaseModel):
    """项目建档请求。"""
    client_name: str = Field(..., min_length=1, max_length=256)
    signed_at: str | None = None  # ISO date
    service_list: list[ServiceItem] = []
    solution_ref: str | None = None  # 方案来源引用
    notes: str | None = None


class ProjectResponse(BaseModel):
    """项目详情响应。"""
    id: str
    user_id: str
    client_name: str
    signed_at: str | None = None
    service_list: list[ServiceItem] = []
    solution_ref: str | None = None
    status: str
    notes: str | None = None
    project_lead_id: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class ProjectListItem(BaseModel):
    """项目列表项。"""
    id: str
    client_name: str
    status: str
    signed_at: str | None = None
    gantt_progress: float = 0.0  # 0-100
    created_at: str | None = None


class ProjectListResponse(BaseModel):
    """项目列表。"""
    items: list[ProjectListItem] = []
    total: int = 0
    page: int = 1
    page_size: int = 20


# ═══════ 团队管理 ═══════

class TeamMemberRequest(BaseModel):
    """项目团队设置请求。"""
    project_lead_id: str | None = None  # 项目负责人
    user_id: str | None = None          # 甲方用户
    teacher_id: str | None = None       # 辅导老师
    lead_notes: str | None = None
    user_notes: str | None = None
    teacher_notes: str | None = None


class TeamMemberResponse(BaseModel):
    """团队信息响应。"""
    project_id: str
    project_lead_id: str | None = None
    user_id: str | None = None
    teacher_id: str | None = None
    lead_notes: str | None = None
    user_notes: str | None = None
    teacher_notes: str | None = None


# ═══════ 甘特图 ═══════

class GanttAutoGenerateRequest(BaseModel):
    """甘特图自动拆解请求。"""
    solution_ref: str | None = None  # 方案引用，不传则使用项目已绑定的方案


class GanttNodeItem(BaseModel):
    """甘特图节点项。"""
    id: str
    task_name: str
    description: str | None = None
    planned_start: str | None = None
    planned_end: str | None = None
    actual_start: str | None = None
    actual_end: str | None = None
    status: str  # 未开始/进行中/已完成/逾期
    order_index: int = 0
    responsible_id: str | None = None
    responsible_role: str | None = None
    confirmed_by_user: bool = False
    confirmed_by_teacher: bool = False
    is_overdue: bool = False
    parent_node_id: str | None = None
    children: list[GanttNodeItem] = []
    alert_sent: bool = False


class GanttAutoGenerateResponse(BaseModel):
    """甘特图自动拆解结果。"""
    project_id: str
    nodes: list[GanttNodeItem] = []
    total_nodes: int = 0
    estimated_duration_days: int = 0


class GanttNodeUpdateRequest(BaseModel):
    """甘特图节点更新请求。"""
    task_name: str | None = None
    description: str | None = None
    planned_start: str | None = None
    planned_end: str | None = None
    actual_start: str | None = None
    actual_end: str | None = None
    status: str | None = Field(None, pattern="^(未开始|进行中|已完成|逾期)$")
    order_index: int | None = None
    responsible_id: str | None = None
    responsible_role: str | None = None
    notes: str | None = None
    voice_note_url: str | None = None


class NodeConfirmRequest(BaseModel):
    """节点完成确认请求。"""
    confirmed: bool = True
    role: str = Field(..., pattern="^(user|teacher)$")  # 谁在确认


class ProgressComparisonResponse(BaseModel):
    """实际vs计划甘特图对比。"""
    project_id: str
    total_nodes: int = 0
    completed_nodes: int = 0
    overdue_nodes: int = 0
    in_progress_nodes: int = 0
    completion_rate: float = 0.0
    planned_vs_actual: list[dict] = []  # [{task_name, planned_start, planned_end, actual_start, actual_end, variance_days}]


class OverdueAlertResponse(BaseModel):
    """逾期提醒响应。"""
    project_id: str
    overdue_nodes: list[dict] = []  # [{node_id, task_name, planned_end, overdue_days}]
    notified_parties: list[str] = []  # project_lead / user / teacher
    alert_count: int = 0


# ═══════ 文档管理 ═══════

class DocumentItem(BaseModel):
    """文档项。"""
    id: str
    stage: str | None = None
    filename: str
    version_num: str | None = "v1.0"
    file_url: str | None = None
    file_size_bytes: int | None = 0
    mime_type: str | None = None
    uploaded_by: str | None = None
    is_deleted: bool = False
    created_at: str | None = None
    previous_version_id: str | None = None


class DocumentListResponse(BaseModel):
    """文档列表。"""
    project_id: str
    stage: str | None = None
    documents: list[DocumentItem] = []
    total: int = 0


class DocumentVersionItem(BaseModel):
    """文档版本历史项。"""
    version_id: str
    version_num: str
    file_url: str | None = None
    created_at: str | None = None


class DocumentVersionResponse(BaseModel):
    """文档版本历史。"""
    document_id: str
    filename: str
    current_version: str
    versions: list[DocumentVersionItem] = []


# ═══════ 问题追踪看板 ═══════

class IssueCreateRequest(BaseModel):
    """创建问题请求。"""
    title: str = Field(..., min_length=1, max_length=512)
    description: str | None = None
    priority: str = Field("medium", pattern="^(low|medium|high|urgent)$")
    assignee_id: str | None = None
    source: str | None = Field(None, pattern="^(实施过程|方案设计|客户反馈|内部审查)$")
    related_node_id: str | None = None
    tags: list[str] = []


class IssueUpdateStatusRequest(BaseModel):
    """更新问题状态请求。"""
    status: str = Field(..., pattern="^(待解决|处理中|已解决)$")
    resolution_description: str | None = None
    resolution_steps: list[str] = []


class IssueItem(BaseModel):
    """问题看板项。"""
    id: str
    title: str
    description: str | None = None
    priority: str
    assignee_id: str | None = None
    assignee_name: str | None = None
    source: str | None = None
    status: str
    resolution_json: dict | None = None
    resolved_by: str | None = None
    resolved_at: str | None = None
    related_node_id: str | None = None
    tags: list[str] = []
    created_at: str | None = None
    created_by: str | None = None


class IssueBoardResponse(BaseModel):
    """问题追踪看板。"""
    project_id: str
    pending: list[IssueItem] = []      # 待解决
    in_progress: list[IssueItem] = []  # 处理中
    resolved: list[IssueItem] = []     # 已解决
    total: int = 0


class IssueRecommendationItem(BaseModel):
    """问题推荐项。"""
    issue_id: str
    title: str
    resolution_description: str
    similarity_score: float = 0.0  # 0-1
    source_project: str | None = None


class IssueRecommendationResponse(BaseModel):
    """问题推荐结果。"""
    query_title: str
    recommendations: list[IssueRecommendationItem] = []
    total_found: int = 0
    accuracy: float = 0.0


# ═══════ 甲方会议记录 ═══════

class MeetingDecision(BaseModel):
    """会议决定事项。"""
    decision: str
    made_by: str | None = None
    agreed_by_client: bool = True
    timestamp: str | None = None


class MeetingTodo(BaseModel):
    """会议待办事项。"""
    task: str
    assignee: str | None = None
    deadline: str | None = None
    priority: str = "medium"
    status: str = "pending"


class ClientMeetingRecordRequest(BaseModel):
    """记录甲方会议请求。"""
    recording_id: str  # 关联智能记录的录音ID
    title: str | None = None
    meeting_date: str | None = None


class ClientMeetingRecordResponse(BaseModel):
    """会议记录响应。"""
    id: str
    project_id: str
    recording_id: str | None = None
    title: str | None = None
    meeting_date: str | None = None
    decisions: list[MeetingDecision] = []
    todos: list[MeetingTodo] = []
    shared_with_client: bool = False
    created_at: str | None = None


# ═══════ 小耕交付助手 ═══════

class DeliveryAssistantRequest(BaseModel):
    """小耕助手对话请求。"""
    project_id: str
    message: str = Field(..., min_length=1)
    context_type: str | None = Field(None, pattern="^(node_reminder|qa|bridge_to_teacher|risk_scan|general)$")
    related_node_id: str | None = None


class DeliveryAssistantResponse(BaseModel):
    """小耕助手对话响应。"""
    message: str
    context_type: str | None = None
    suggestions: list[str] = []  # 建议的后续问题或操作
    linked_nodes: list[dict] = []  # [{node_id, task_name, status}]
    risk_alerts: list[str] = []  # 风险警告


# ═══════ 项目归档 ═══════

class ProjectArchiveRequest(BaseModel):
    """项目归档请求。"""
    create_brand_case: bool = False  # 是否创建品牌案例
    case_title: str | None = None
    case_description: str | None = None
    case_tags: list[str] = []


class ProjectArchiveResponse(BaseModel):
    """项目归档响应。"""
    project_id: str
    archived_at: str | None = None
    archive_summary: dict | None = None
    # {total_documents, total_issues_resolved, total_meetings, duration_days, completion_rate}
    brand_case_created: bool = False
    brand_content_id: str | None = None
    kb_doc_ids: list[str] = []


# ═══════ 回收站 ═══════

class RecycleBinItem(BaseModel):
    """回收站项。"""
    id: str
    filename: str
    project_id: str
    project_name: str | None = None
    deleted_at: str | None = None
    days_until_cleanup: int = 30


class RecycleBinResponse(BaseModel):
    """回收站列表。"""
    items: list[RecycleBinItem] = []
    total: int = 0
