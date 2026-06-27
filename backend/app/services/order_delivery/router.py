"""交付一笔订单服务 — 路由层（步骤24 / Wave 5）。

API 端点（匹配前端 delivery.ts API封装）：
  POST   /delivery/projects                          — 创建项目
  GET    /delivery/projects                          — 项目列表
  GET    /delivery/projects/{id}                     — 项目详情
  POST   /delivery/projects/{id}/team                — 设置团队
  GET    /delivery/projects/{id}/team                — 获取团队
  POST   /delivery/projects/{id}/gantt/auto          — 自动生成甘特图
  GET    /delivery/projects/{id}/gantt               — 获取甘特图节点
  PUT    /delivery/projects/{id}/gantt/nodes/{nid}   — 更新甘特图节点
  POST   /delivery/projects/{id}/gantt/nodes/{nid}/confirm — 确认节点完成
  GET    /delivery/projects/{id}/progress            — 进度对比
  GET    /delivery/projects/{id}/documents           — 文档列表
  POST   /delivery/projects/{id}/documents/upload    — 上传文档
  GET    /delivery/projects/{id}/documents/{did}/versions — 文档版本历史
  DELETE /delivery/projects/{id}/documents/{did}     — 软删除文档
  POST   /delivery/projects/{id}/documents/{did}/restore — 恢复文档
  GET    /delivery/projects/{id}/issues              — 问题看板
  POST   /delivery/projects/{id}/issues              — 创建问题
  PUT    /delivery/projects/{id}/issues/{iid}/status — 更新问题状态
  GET    /delivery/projects/{id}/issues/recommendations — 问题推荐
  POST   /delivery/projects/{id}/meetings/record     — 记录会议
  GET    /delivery/projects/{id}/meetings            — 会议列表
  POST   /delivery/assistant/chat                    — 小耕助手对话
  POST   /delivery/projects/{id}/alternate-design    — 交付回路反馈
  POST   /delivery/projects/{id}/archive             — 项目归档
  GET    /delivery/recycle-bin                       — 回收站
  POST   /delivery/cleanup-expired                   — 清理过期回收站
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ...shared.database import get_db
from ...shared.response import ok, page as page_response
from ...shared.security import CurrentUser, get_current_user
from . import service
from .schemas import (
    ClientMeetingRecordRequest,
    DeliveryAssistantRequest,
    GanttAutoGenerateRequest,
    GanttNodeUpdateRequest,
    IssueCreateRequest,
    IssueUpdateStatusRequest,
    NodeConfirmRequest,
    ProjectArchiveRequest,
    ProjectCreateRequest,
    TeamMemberRequest,
)

router = APIRouter(tags=["交付一笔订单"], prefix="/delivery")


# ═══════════════════════════════════════════════
# 项目 CRUD
# ═══════════════════════════════════════════════

@router.post("/projects")
def create_project(
    body: ProjectCreateRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """创建交付项目：客户名称+签约时间+服务清单+方案基准。"""
    return ok(service.create_project(db, user.user_id, body.model_dump()))


@router.get("/projects")
def list_projects(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: str | None = Query(None),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取项目列表，支持按状态筛选和分页。"""
    result = service.list_projects(db, user.user_id, page, page_size, status)
    return page_response(result["items"], result["total"], page, page_size)


@router.get("/projects/{project_id}")
def get_project(
    project_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取项目详情。"""
    return ok(service.get_project(db, user.user_id, project_id))


# ═══════════════════════════════════════════════
# 团队管理
# ═══════════════════════════════════════════════

@router.post("/projects/{project_id}/team")
def setup_team(
    project_id: str,
    body: TeamMemberRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """设置项目团队三角色：项目负责人+用户(甲方)+老师。"""
    return ok(service.setup_team(db, user.user_id, project_id, body.model_dump()))


@router.get("/projects/{project_id}/team")
def get_team(
    project_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取项目团队信息。"""
    return ok(service.get_team(db, user.user_id, project_id))


# ═══════════════════════════════════════════════
# 甘特图管理
# ═══════════════════════════════════════════════

@router.post("/projects/{project_id}/gantt/auto")
def auto_generate_gantt(
    project_id: str,
    body: GanttAutoGenerateRequest | None = None,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """方案→甘特图自动拆解：根据方案类型自动生成交付节点。"""
    solution_ref = body.solution_ref if body else None
    return ok(service.auto_generate_gantt(db, user.user_id, project_id, solution_ref))


@router.get("/projects/{project_id}/gantt")
def get_gantt_nodes(
    project_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取项目所有甘特图节点（含层级树）。"""
    return ok(service.get_gantt_nodes(db, user.user_id, project_id))


@router.put("/projects/{project_id}/gantt/nodes/{node_id}")
def update_gantt_node(
    project_id: str,
    node_id: str,
    body: GanttNodeUpdateRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """手动调整甘特图节点（状态/日期/负责人/备注）。"""
    return ok(service.update_gantt_node(db, user.user_id, project_id, node_id, body.model_dump(exclude_none=True)))


@router.post("/projects/{project_id}/gantt/nodes/{node_id}/confirm")
def confirm_node_completion(
    project_id: str,
    node_id: str,
    body: NodeConfirmRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """节点完成双确认（用户+老师双方确认后节点自动标记为已完成）。"""
    return ok(service.confirm_node_completion(
        db, user.user_id, project_id, node_id, body.confirmed, body.role,
    ))


# ═══════════════════════════════════════════════
# 进度对比 & 逾期提醒
# ═══════════════════════════════════════════════

@router.get("/projects/{project_id}/progress")
def compare_progress(
    project_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """实际vs计划甘特图对比：完成率、逾期数、节点偏差。"""
    return ok(service.compare_progress(db, user.user_id, project_id))


@router.post("/projects/{project_id}/overdue-alert")
def trigger_overdue_alert(
    project_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """手动触发逾期提醒（通知项目负责人+用户+老师三方）。"""
    return ok(service.trigger_overdue_alert(db, project_id))


# ═══════════════════════════════════════════════
# 文档管理
# ═══════════════════════════════════════════════

@router.get("/projects/{project_id}/documents")
def list_documents(
    project_id: str,
    stage: str | None = Query(None),
    include_deleted: bool = Query(False),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取项目文档列表，可按阶段筛选。"""
    return ok(service.list_documents(db, user.user_id, project_id, stage, include_deleted))


@router.post("/projects/{project_id}/documents/upload")
def upload_document(
    project_id: str,
    body: dict,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """上传项目文档（记录元数据，文件存储由file_storage服务处理）。"""
    return ok(service.upload_document(db, user.user_id, project_id, body))


@router.get("/projects/{project_id}/documents/{doc_id}/versions")
def get_document_versions(
    project_id: str,
    doc_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取文档版本历史（支持回退查看）。"""
    return ok(service.get_document_versions(db, user.user_id, project_id, doc_id))


@router.delete("/projects/{project_id}/documents/{doc_id}")
def soft_delete_document(
    project_id: str,
    doc_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """软删除文档（移入回收站，30天可恢复）。"""
    return ok(service.soft_delete_document(db, user.user_id, project_id, doc_id))


@router.post("/projects/{project_id}/documents/{doc_id}/restore")
def restore_document(
    project_id: str,
    doc_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """从回收站恢复文档。"""
    return ok(service.restore_document(db, user.user_id, project_id, doc_id))


# ═══════════════════════════════════════════════
# 问题追踪看板
# ═══════════════════════════════════════════════

@router.get("/projects/{project_id}/issues")
def get_issue_board(
    project_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取问题追踪看板（三列：待解决/处理中/已解决）。"""
    return ok(service.get_issue_board(db, user.user_id, project_id))


@router.post("/projects/{project_id}/issues")
def create_issue(
    project_id: str,
    body: IssueCreateRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """创建问题记录，添加到追踪看板。"""
    return ok(service.create_issue(db, user.user_id, project_id, body.model_dump()))


@router.put("/projects/{project_id}/issues/{issue_id}/status")
def update_issue_status(
    project_id: str,
    issue_id: str,
    body: IssueUpdateStatusRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """更新问题状态：待解决→处理中→已解决。"""
    return ok(service.update_issue_status(db, user.user_id, project_id, issue_id, body.model_dump()))


@router.get("/projects/{project_id}/issues/recommendations")
def recommend_solutions(
    project_id: str,
    query_title: str | None = Query(None),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """跨项目历史方案推荐（准确率>=70%）。"""
    return ok(service.recommend_solutions(db, user.user_id, project_id, query_title))


# ═══════════════════════════════════════════════
# 甲方会议记录（联动智能记录）
# ═══════════════════════════════════════════════

@router.post("/projects/{project_id}/meetings/record")
def record_client_meeting(
    project_id: str,
    body: ClientMeetingRecordRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """记录甲方会议（联动智能记录，萃取决定事项+待办）。
    平台不自动分享会议纪要给甲方。
    """
    return ok(service.record_client_meeting(db, user.user_id, project_id, body.model_dump()))


@router.get("/projects/{project_id}/meetings")
def get_meeting_list(
    project_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取项目会议记录列表。"""
    return ok(service.get_meeting_list(db, user.user_id, project_id))


# ═══════════════════════════════════════════════
# 小耕交付助手
# ═══════════════════════════════════════════════

@router.post("/assistant/chat")
def delivery_assistant_chat(
    body: DeliveryAssistantRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """小耕交付助手对话：节点提醒/问答/老师桥接/风险扫描。"""
    return ok(service.delivery_assistant_chat(db, user.user_id, body.model_dump()))


# ═══════════════════════════════════════════════
# 交付回路 & 归档
# ═══════════════════════════════════════════════

@router.post("/projects/{project_id}/alternate-design")
def alternate_delivery_design(
    project_id: str,
    body: dict,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """交付V1.0→反馈→产品设计→交付V2.0回路。"""
    feedback = body.get("feedback", "")
    return ok(service.alternate_delivery_design(db, user.user_id, project_id, feedback))


@router.post("/projects/{project_id}/archive")
def archive_project(
    project_id: str,
    body: ProjectArchiveRequest | None = None,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """项目归档：归档所有文件到知识库 + 可选案例反哺品牌。"""
    create_brand_case = body.create_brand_case if body else False
    case_title = body.case_title if body else None
    case_description = body.case_description if body else None
    case_tags = body.case_tags if body else None
    return ok(service.archive_project(
        db, user.user_id, project_id, create_brand_case, case_title, case_description, case_tags,
    ))


# ═══════════════════════════════════════════════
# 回收站
# ═══════════════════════════════════════════════

@router.get("/recycle-bin")
def get_recycle_bin(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取所有项目的回收站文档（30天可恢复）。"""
    return ok(service.get_recycle_bin(db, user.user_id))


@router.post("/cleanup-expired")
def cleanup_expired(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """手动触发清理过期回收站（超过30天的文档永久删除）。"""
    return ok(service.cleanup_expired_recycle_bin(db))
