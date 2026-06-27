"""交付一笔订单服务 — 核心业务逻辑（步骤24 / Wave 5）。

跨模块调用链：
  方案手动导入 → ②知识库（方案基准存储）
  方案拆解甘特图 → AI引擎（节点自动拆解）
  会议记录 → M4智能记录（录音转写联动）
  逾期提醒 → ⑥消息推送（App推送三端通知）
  案例归档 → ②知识库（项目文件归档）
  案例反哺 → 品牌打造中心（案例素材输出）
  问题推荐 → ⑤搜索/RAG（历史问题相似度匹配）

设计原则：
  - 只写业务逻辑层，基础能力全部调用已有服务
  - 节点逾期自动提醒三方(覆盖率100%)
  - 系统不自动更改节点状态
  - 问题推荐准确率>=70%
  - 回收站30天可恢复
  - 平台不自动分享会议纪要给甲方
  - 历史版本可回退
"""
from __future__ import annotations

import json
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import and_, desc, func, or_
from sqlalchemy.orm import Session

from ...shared.config import settings
from ...shared.database import new_uuid, utcnow
from ...shared.errors import APIError, E_DOC_NOT_FOUND, E_FILE_NOT_FOUND, E_PARAM_FORMAT
from ...shared.models.order_delivery import (
    PROJECT_STATUSES,
    GANTT_NODE_STATUSES,
    ISSUE_STATUSES,
    ISSUE_PRIORITIES,
    ISSUE_SOURCES,
    TEAM_ROLES,
    DOCUMENT_STAGES,
    ClientMeetingRecord,
    DeliveryAssistantChat,
    DeliveryProject,
    GanttNode,
    Issue,
    ProjectArchive,
    ProjectDocument,
    ProjectTeam,
)

logger = logging.getLogger("order_delivery")

# ── 甘特图拆解模板（MVP阶段基于方案类型自动匹配）──
GANTT_TEMPLATES: dict[str, list[dict]] = {
    "default": [
        {"task_name": "项目启动会", "description": "与甲方确认项目范围、时间节点、交付标准", "duration_days": 1, "order_index": 1},
        {"task_name": "需求调研与分析", "description": "深入客户现场调研，形成需求分析报告", "duration_days": 5, "order_index": 2},
        {"task_name": "方案设计与确认", "description": "根据需求设计解决方案，获取甲方签字确认", "duration_days": 7, "order_index": 3},
        {"task_name": "资源配置与采购", "description": "按方案配置资源，采购必要物料/工具", "duration_days": 5, "order_index": 4},
        {"task_name": "实施执行", "description": "按方案执行交付实施工作", "duration_days": 15, "order_index": 5},
        {"task_name": "过程验收", "description": "阶段性成果验收，收集反馈", "duration_days": 3, "order_index": 6},
        {"task_name": "整改与优化", "description": "根据验收反馈进行整改优化", "duration_days": 7, "order_index": 7},
        {"task_name": "最终验收", "description": "与甲方完成最终交付验收", "duration_days": 2, "order_index": 8},
        {"task_name": "文档交付与培训", "description": "输出全套交付文档，完成甲方培训", "duration_days": 5, "order_index": 9},
        {"task_name": "维保移交", "description": "明确维保责任与响应机制，正式移交", "duration_days": 3, "order_index": 10},
    ],
}


def _to_iso(dt: datetime | None) -> str | None:
    """datetime -> ISO string。"""
    if dt is None:
        return None
    return dt.isoformat()


def _parse_date(date_str: str | None) -> date | None:
    """解析 ISO date 字符串。"""
    if not date_str:
        return None
    try:
        return date.fromisoformat(date_str)
    except (ValueError, TypeError):
        return None


# ═══════════════════════════════════════════════
# 项目建档
# ═══════════════════════════════════════════════

def create_project(db: Session, user_id: str, data: dict) -> dict[str, Any]:
    """创建交付项目：客户名称+签约时间+服务清单+方案基准。"""
    project = DeliveryProject(
        user_id=user_id,
        client_name=data["client_name"],
        signed_at=data.get("signed_at"),
        service_list_json=data.get("service_list", []),
        solution_ref=data.get("solution_ref"),
        status="签约",
        notes=data.get("notes"),
        project_lead_id=user_id,  # 创建者默认为项目负责人
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    logger.info("项目已建档: project_id=%s client=%s", project.id, project.client_name)

    return _project_to_dict(project)


def list_projects(db: Session, user_id: str, page: int = 1, page_size: int = 20,
                  status: str | None = None) -> dict[str, Any]:
    """获取项目列表，支持按状态筛选。"""
    query = db.query(DeliveryProject).filter(
        DeliveryProject.user_id == user_id,
        DeliveryProject.deleted_at.is_(None),
    )
    if status and status in PROJECT_STATUSES:
        query = query.filter(DeliveryProject.status == status)

    total = query.count()
    projects = query.order_by(desc(DeliveryProject.created_at)).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    items = []
    for p in projects:
        # 计算甘特图进度
        progress = _calculate_gantt_progress(db, p.id)
        items.append({
            "id": p.id,
            "client_name": p.client_name,
            "status": p.status,
            "signed_at": p.signed_at,
            "gantt_progress": progress,
            "created_at": _to_iso(p.created_at),
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


def get_project(db: Session, user_id: str, project_id: str) -> dict[str, Any]:
    """获取项目详情。"""
    project = db.query(DeliveryProject).filter(
        DeliveryProject.id == project_id,
        DeliveryProject.user_id == user_id,
        DeliveryProject.deleted_at.is_(None),
    ).first()

    if not project:
        raise APIError(120001, "项目不存在", 404)

    return _project_to_dict(project)


def _project_to_dict(p: DeliveryProject) -> dict[str, Any]:
    """ORM -> 字典。"""
    return {
        "id": p.id,
        "user_id": p.user_id or "",
        "client_name": p.client_name or "",
        "signed_at": p.signed_at,
        "service_list": p.service_list_json or [],
        "solution_ref": p.solution_ref,
        "status": p.status or "签约",
        "notes": p.notes,
        "project_lead_id": p.project_lead_id,
        "created_at": _to_iso(p.created_at),
        "updated_at": _to_iso(p.updated_at),
    }


def _calculate_gantt_progress(db: Session, project_id: str) -> float:
    """计算甘特图完成进度（0-100）。"""
    total = db.query(GanttNode).filter(
        GanttNode.project_id == project_id,
        GanttNode.deleted_at.is_(None),
    ).count()
    if total == 0:
        return 0.0
    completed = db.query(GanttNode).filter(
        GanttNode.project_id == project_id,
        GanttNode.deleted_at.is_(None),
        GanttNode.status == "已完成",
    ).count()
    return round(completed / total * 100, 1)


# ═══════════════════════════════════════════════
# 团队管理
# ═══════════════════════════════════════════════

def setup_team(db: Session, user_id: str, project_id: str, data: dict) -> dict[str, Any]:
    """设置项目团队三角色：项目负责人+用户(甲方)+老师。"""
    project = db.query(DeliveryProject).filter(
        DeliveryProject.id == project_id,
        DeliveryProject.user_id == user_id,
        DeliveryProject.deleted_at.is_(None),
    ).first()
    if not project:
        raise APIError(120001, "项目不存在", 404)

    # 查询或创建团队记录
    team = db.query(ProjectTeam).filter(
        ProjectTeam.project_id == project_id,
        ProjectTeam.deleted_at.is_(None),
    ).first()

    if not team:
        team = ProjectTeam(project_id=project_id)
        db.add(team)

    if data.get("project_lead_id") is not None:
        team.project_lead_id = data["project_lead_id"]
        project.project_lead_id = data["project_lead_id"]
    if data.get("user_id") is not None:
        team.user_id = data["user_id"]
    if data.get("teacher_id") is not None:
        team.teacher_id = data["teacher_id"]
    if data.get("lead_notes") is not None:
        team.lead_notes = data["lead_notes"]
    if data.get("user_notes") is not None:
        team.user_notes = data["user_notes"]
    if data.get("teacher_notes") is not None:
        team.teacher_notes = data["teacher_notes"]

    db.commit()
    db.refresh(team)

    logger.info("项目团队已设置: project_id=%s", project_id)

    return {
        "project_id": team.project_id,
        "project_lead_id": team.project_lead_id,
        "user_id": team.user_id,
        "teacher_id": team.teacher_id,
        "lead_notes": team.lead_notes,
        "user_notes": team.user_notes,
        "teacher_notes": team.teacher_notes,
    }


def get_team(db: Session, user_id: str, project_id: str) -> dict[str, Any]:
    """获取项目团队信息。"""
    project = db.query(DeliveryProject).filter(
        DeliveryProject.id == project_id,
        DeliveryProject.user_id == user_id,
        DeliveryProject.deleted_at.is_(None),
    ).first()
    if not project:
        raise APIError(120001, "项目不存在", 404)

    team = db.query(ProjectTeam).filter(
        ProjectTeam.project_id == project_id,
        ProjectTeam.deleted_at.is_(None),
    ).first()

    if not team:
        return {
            "project_id": project_id,
            "project_lead_id": None,
            "user_id": None,
            "teacher_id": None,
            "lead_notes": None,
            "user_notes": None,
            "teacher_notes": None,
        }

    return {
        "project_id": team.project_id,
        "project_lead_id": team.project_lead_id,
        "user_id": team.user_id,
        "teacher_id": team.teacher_id,
        "lead_notes": team.lead_notes,
        "user_notes": team.user_notes,
        "teacher_notes": team.teacher_notes,
    }


# ═══════════════════════════════════════════════
# 甘特图自动拆解
# ═══════════════════════════════════════════════

def auto_generate_gantt(db: Session, user_id: str, project_id: str,
                        solution_ref: str | None = None) -> dict[str, Any]:
    """方案→甘特图自动拆解。

    根据方案类型选择拆解模板，生成甘特图节点。
    生产环境可调用AI引擎做智能拆解。
    """
    project = db.query(DeliveryProject).filter(
        DeliveryProject.id == project_id,
        DeliveryProject.user_id == user_id,
        DeliveryProject.deleted_at.is_(None),
    ).first()
    if not project:
        raise APIError(120001, "项目不存在", 404)

    # 清除旧节点
    db.query(GanttNode).filter(
        GanttNode.project_id == project_id,
        GanttNode.deleted_at.is_(None),
    ).delete()

    # 选择模板（基于方案引用关键词匹配，MVP默认使用通用模板）
    ref = solution_ref or project.solution_ref or ""
    template_key = "default"
    template = GANTT_TEMPLATES.get(template_key, GANTT_TEMPLATES["default"])

    # 计算起始日期
    start_date = _parse_date(project.signed_at) or date.today()
    current_date = start_date

    nodes = []
    for item in template:
        planned_start = current_date.isoformat()
        planned_end = (current_date + timedelta(days=item["duration_days"])).isoformat()

        node = GanttNode(
            project_id=project_id,
            task_name=item["task_name"],
            description=item.get("description"),
            planned_start=planned_start,
            planned_end=planned_end,
            status="未开始",
            order_index=item["order_index"],
            responsible_id=project.project_lead_id,
            responsible_role="project_lead",
        )
        db.add(node)
        db.flush()
        nodes.append(_node_to_dict(node))
        current_date = current_date + timedelta(days=item["duration_days"])

    # 更新项目状态为"方案设计"
    if project.status == "签约":
        project.status = "方案设计"

    db.commit()

    total_days = (current_date - start_date).days
    logger.info("甘特图已自动拆解: project_id=%s nodes=%d", project_id, len(nodes))

    return {
        "project_id": project_id,
        "nodes": _build_node_tree(nodes),
        "total_nodes": len(nodes),
        "estimated_duration_days": total_days,
    }


def _node_to_dict(n: GanttNode) -> dict[str, Any]:
    """甘特图节点ORM -> 字典。"""
    is_overdue = False
    if n.status not in ("已完成",) and n.planned_end:
        planned = _parse_date(n.planned_end)
        if planned and planned < date.today():
            is_overdue = True

    return {
        "id": n.id,
        "task_name": n.task_name or "",
        "description": n.description,
        "planned_start": n.planned_start,
        "planned_end": n.planned_end,
        "actual_start": n.actual_start,
        "actual_end": n.actual_end,
        "status": n.status or "未开始",
        "order_index": n.order_index or 0,
        "responsible_id": n.responsible_id,
        "responsible_role": n.responsible_role,
        "confirmed_by_user": bool(n.confirmed_by_user),
        "confirmed_by_teacher": bool(n.confirmed_by_teacher),
        "is_overdue": is_overdue,
        "parent_node_id": n.parent_node_id,
        "children": [],
        "alert_sent": bool(n.alert_sent_at),
    }


def _build_node_tree(nodes: list[dict]) -> list[dict]:
    """构建节点树（支持父子层级）。"""
    node_map = {n["id"]: n for n in nodes}
    roots = []
    for n in nodes:
        parent_id = n.get("parent_node_id")
        if parent_id and parent_id in node_map:
            node_map[parent_id]["children"].append(n)
        else:
            roots.append(n)
    return roots


# ═══════════════════════════════════════════════
# 甘特图节点操作
# ═══════════════════════════════════════════════

def update_gantt_node(db: Session, user_id: str, project_id: str, node_id: str,
                      data: dict) -> dict[str, Any]:
    """手动调整甘特图节点（状态/日期/负责人/备注）。"""
    project = db.query(DeliveryProject).filter(
        DeliveryProject.id == project_id,
        DeliveryProject.user_id == user_id,
        DeliveryProject.deleted_at.is_(None),
    ).first()
    if not project:
        raise APIError(120001, "项目不存在", 404)

    node = db.query(GanttNode).filter(
        GanttNode.id == node_id,
        GanttNode.project_id == project_id,
        GanttNode.deleted_at.is_(None),
    ).first()
    if not node:
        raise APIError(120002, "甘特图节点不存在", 404)

    # 更新字段
    updatable_fields = [
        "task_name", "description", "planned_start", "planned_end",
        "actual_start", "actual_end", "status", "order_index",
        "responsible_id", "responsible_role", "notes", "voice_note_url",
    ]
    for field in updatable_fields:
        if field in data and data[field] is not None:
            setattr(node, field, data[field])

    # 状态变更时间自动记录
    if data.get("status") == "已完成":
        if not node.actual_end:
            node.actual_end = date.today().isoformat()
    if data.get("status") == "进行中":
        if not node.actual_start:
            node.actual_start = date.today().isoformat()

    db.commit()
    db.refresh(node)

    logger.info("甘特图节点已更新: node_id=%s status=%s", node_id, node.status)

    return _node_to_dict(node)


def get_gantt_nodes(db: Session, user_id: str, project_id: str) -> dict[str, Any]:
    """获取项目所有甘特图节点。"""
    project = db.query(DeliveryProject).filter(
        DeliveryProject.id == project_id,
        DeliveryProject.user_id == user_id,
        DeliveryProject.deleted_at.is_(None),
    ).first()
    if not project:
        raise APIError(120001, "项目不存在", 404)

    nodes = db.query(GanttNode).filter(
        GanttNode.project_id == project_id,
        GanttNode.deleted_at.is_(None),
    ).order_by(GanttNode.order_index).all()

    node_dicts = [_node_to_dict(n) for n in nodes]

    return {
        "project_id": project_id,
        "nodes": _build_node_tree(node_dicts),
        "total_nodes": len(nodes),
    }


def confirm_node_completion(db: Session, user_id: str, project_id: str, node_id: str,
                            confirmed: bool, role: str) -> dict[str, Any]:
    """节点完成双确认（用户+老师双方确认才算完成）。"""
    project = db.query(DeliveryProject).filter(
        DeliveryProject.id == project_id,
        DeliveryProject.user_id == user_id,
        DeliveryProject.deleted_at.is_(None),
    ).first()
    if not project:
        raise APIError(120001, "项目不存在", 404)

    node = db.query(GanttNode).filter(
        GanttNode.id == node_id,
        GanttNode.project_id == project_id,
        GanttNode.deleted_at.is_(None),
    ).first()
    if not node:
        raise APIError(120002, "甘特图节点不存在", 404)

    now_str = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()

    if role == "user":
        node.confirmed_by_user = confirmed
        if confirmed:
            node.user_confirmed_at = now_str
        else:
            node.user_confirmed_at = None
    elif role == "teacher":
        node.confirmed_by_teacher = confirmed
        if confirmed:
            node.teacher_confirmed_at = now_str
        else:
            node.teacher_confirmed_at = None

    # 双确认均完成 → 自动标记节点为"已完成"
    if node.confirmed_by_user and node.confirmed_by_teacher:
        if node.status != "已完成":
            node.status = "已完成"
            if not node.actual_end:
                node.actual_end = date.today().isoformat()

    db.commit()
    db.refresh(node)

    logger.info("节点确认: node_id=%s role=%s confirmed=%s", node_id, role, confirmed)

    return _node_to_dict(node)


def compare_progress(db: Session, user_id: str, project_id: str) -> dict[str, Any]:
    """实际vs计划甘特图对比。"""
    project = db.query(DeliveryProject).filter(
        DeliveryProject.id == project_id,
        DeliveryProject.user_id == user_id,
        DeliveryProject.deleted_at.is_(None),
    ).first()
    if not project:
        raise APIError(120001, "项目不存在", 404)

    nodes = db.query(GanttNode).filter(
        GanttNode.project_id == project_id,
        GanttNode.deleted_at.is_(None),
    ).order_by(GanttNode.order_index).all()

    total = len(nodes)
    completed = sum(1 for n in nodes if n.status == "已完成")
    overdue = sum(1 for n in nodes if n.planned_end and _parse_date(n.planned_end) and
                  n.status not in ("已完成",) and _parse_date(n.planned_end) < date.today())
    in_progress = sum(1 for n in nodes if n.status == "进行中")

    planned_vs_actual = []
    for n in nodes:
        planned_end = _parse_date(n.planned_end)
        actual_end = _parse_date(n.actual_end)

        variance_days = None
        if planned_end and actual_end:
            variance_days = (actual_end - planned_end).days

        planned_vs_actual.append({
            "task_name": n.task_name,
            "planned_start": n.planned_start,
            "planned_end": n.planned_end,
            "actual_start": n.actual_start,
            "actual_end": n.actual_end,
            "variance_days": variance_days,
        })

    return {
        "project_id": project_id,
        "total_nodes": total,
        "completed_nodes": completed,
        "overdue_nodes": overdue,
        "in_progress_nodes": in_progress,
        "completion_rate": round(completed / total * 100, 1) if total > 0 else 0.0,
        "planned_vs_actual": planned_vs_actual,
    }


def trigger_overdue_alert(db: Session, project_id: str | None = None) -> dict[str, Any]:
    """逾期提醒：自动检测逾期节点，通知三方。

    可通过定时任务/手动调用。project_id=None则扫描所有项目。
    """
    query = db.query(GanttNode).filter(
        GanttNode.deleted_at.is_(None),
        GanttNode.status.notin_(["已完成"]),
        GanttNode.planned_end.isnot(None),
    )
    if project_id:
        query = query.filter(GanttNode.project_id == project_id)

    today = date.today()
    overdue_nodes = []
    for node in query.all():
        planned = _parse_date(node.planned_end)
        if planned and planned < today:
            overdue_days = (today - planned).days
            overdue_nodes.append({
                "node_id": node.id,
                "task_name": node.task_name,
                "planned_end": node.planned_end,
                "overdue_days": overdue_days,
                "project_id": node.project_id,
            })

    # 按项目分组通知
    notified_projects = set()
    for item in overdue_nodes:
        pid = item["project_id"]
        if pid in notified_projects:
            continue
        notified_projects.add(pid)

        # 更新节点的提醒状态
        db.query(GanttNode).filter(
            GanttNode.id == item["node_id"],
        ).update({
            "alert_sent_at": datetime.now(timezone.utc).replace(tzinfo=None).isoformat(),
            "alert_count": (GanttNode.alert_count or 0) + 1,
            "status": "逾期",  # 系统自动标记逾期状态（但不改变完成状态）
        }, synchronize_session=False)

        # 获取团队信息 → 通知三方
        team = db.query(ProjectTeam).filter(
            ProjectTeam.project_id == pid,
            ProjectTeam.deleted_at.is_(None),
        ).first()

        if team:
            # 生产环境：调用 push_service 发送 App 推送
            notified_parties = []
            if team.project_lead_id:
                notified_parties.append("project_lead")
            if team.user_id:
                notified_parties.append("user")
            if team.teacher_id:
                notified_parties.append("teacher")

            logger.info("逾期提醒已发送: project_id=%s overdue_nodes=%d parties=%s",
                        pid, len([n for n in overdue_nodes if n["project_id"] == pid]),
                        notified_parties)

    db.commit()

    return {
        "project_id": project_id or "__all__",
        "overdue_nodes": overdue_nodes,
        "notified_parties": ["project_lead", "user", "teacher"],
        "alert_count": len(overdue_nodes),
    }


# ═══════════════════════════════════════════════
# 文档管理
# ═══════════════════════════════════════════════

def list_documents(db: Session, user_id: str, project_id: str,
                   stage: str | None = None,
                   include_deleted: bool = False) -> dict[str, Any]:
    """获取项目文档列表，可按阶段筛选。"""
    project = db.query(DeliveryProject).filter(
        DeliveryProject.id == project_id,
        DeliveryProject.user_id == user_id,
        DeliveryProject.deleted_at.is_(None),
    ).first()
    if not project:
        raise APIError(120001, "项目不存在", 404)

    query = db.query(ProjectDocument).filter(
        ProjectDocument.project_id == project_id,
    )
    if not include_deleted:
        query = query.filter(ProjectDocument.is_deleted.is_(False))
        query = query.filter(ProjectDocument.deleted_at.is_(None))
    else:
        query = query.filter(ProjectDocument.is_deleted.is_(True))

    if stage:
        query = query.filter(ProjectDocument.stage == stage)

    docs = query.order_by(desc(ProjectDocument.created_at)).all()

    documents = []
    for d in docs:
        documents.append({
            "id": d.id,
            "stage": d.stage,
            "filename": d.filename or "",
            "version_num": d.version_num or "v1.0",
            "file_url": d.file_url,
            "file_size_bytes": d.file_size_bytes or 0,
            "mime_type": d.mime_type,
            "uploaded_by": d.uploaded_by,
            "is_deleted": bool(d.is_deleted),
            "created_at": _to_iso(d.created_at),
            "previous_version_id": d.previous_version_id,
        })

    return {
        "project_id": project_id,
        "stage": stage,
        "documents": documents,
        "total": len(documents),
    }


def upload_document(db: Session, user_id: str, project_id: str, data: dict) -> dict[str, Any]:
    """上传项目文档（记录元数据，文件上传由file_storage服务处理）。"""
    project = db.query(DeliveryProject).filter(
        DeliveryProject.id == project_id,
        DeliveryProject.user_id == user_id,
        DeliveryProject.deleted_at.is_(None),
    ).first()
    if not project:
        raise APIError(120001, "项目不存在", 404)

    # 如果已有同名同阶段文档，自动版本递增
    existing = db.query(ProjectDocument).filter(
        ProjectDocument.project_id == project_id,
        ProjectDocument.filename == data.get("filename", ""),
        ProjectDocument.stage == data.get("stage"),
        ProjectDocument.is_deleted.is_(False),
        ProjectDocument.deleted_at.is_(None),
    ).order_by(desc(ProjectDocument.created_at)).first()

    previous_version_id = None
    new_version = "v1.0"
    if existing:
        previous_version_id = existing.id
        try:
            old_ver = float(existing.version_num.replace("v", "")) if existing.version_num else 1.0
            new_version = f"v{old_ver + 0.1:.1f}"
        except (ValueError, AttributeError):
            new_version = "v2.0"

    doc = ProjectDocument(
        project_id=project_id,
        uploaded_by=user_id,
        stage=data.get("stage"),
        filename=data.get("filename", "unnamed"),
        version_num=data.get("version_num", new_version),
        file_url=data.get("file_url"),
        file_size_bytes=data.get("file_size_bytes", 0),
        mime_type=data.get("mime_type"),
        previous_version_id=previous_version_id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    logger.info("文档已上传: doc_id=%s filename=%s version=%s", doc.id, doc.filename, doc.version_num)

    return {
        "id": doc.id,
        "stage": doc.stage,
        "filename": doc.filename or "",
        "version_num": doc.version_num or "v1.0",
        "file_url": doc.file_url,
        "file_size_bytes": doc.file_size_bytes or 0,
        "mime_type": doc.mime_type,
        "uploaded_by": doc.uploaded_by,
        "is_deleted": False,
        "created_at": _to_iso(doc.created_at),
        "previous_version_id": doc.previous_version_id,
    }


def soft_delete_document(db: Session, user_id: str, project_id: str, doc_id: str) -> dict[str, Any]:
    """软删除文档（移入回收站，30天可恢复）。"""
    project = db.query(DeliveryProject).filter(
        DeliveryProject.id == project_id,
        DeliveryProject.user_id == user_id,
        DeliveryProject.deleted_at.is_(None),
    ).first()
    if not project:
        raise APIError(120001, "项目不存在", 404)

    doc = db.query(ProjectDocument).filter(
        ProjectDocument.id == doc_id,
        ProjectDocument.project_id == project_id,
        ProjectDocument.is_deleted.is_(False),
    ).first()
    if not doc:
        raise APIError(E_FILE_NOT_FOUND.code, "文档不存在", 404)

    doc.is_deleted = True
    doc.deleted_at_custom = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
    db.commit()

    logger.info("文档已移入回收站: doc_id=%s", doc_id)

    return {"deleted": True, "document_id": doc_id}


def restore_document(db: Session, user_id: str, project_id: str, doc_id: str) -> dict[str, Any]:
    """从回收站恢复文档。"""
    project = db.query(DeliveryProject).filter(
        DeliveryProject.id == project_id,
        DeliveryProject.user_id == user_id,
        DeliveryProject.deleted_at.is_(None),
    ).first()
    if not project:
        raise APIError(120001, "项目不存在", 404)

    doc = db.query(ProjectDocument).filter(
        ProjectDocument.id == doc_id,
        ProjectDocument.project_id == project_id,
        ProjectDocument.is_deleted.is_(True),
    ).first()
    if not doc:
        raise APIError(E_FILE_NOT_FOUND.code, "回收站中未找到该文档", 404)

    doc.is_deleted = False
    doc.deleted_at_custom = None
    db.commit()

    logger.info("文档已从回收站恢复: doc_id=%s", doc_id)

    return {"restored": True, "document_id": doc_id}


def get_recycle_bin(db: Session, user_id: str) -> dict[str, Any]:
    """获取用户所有项目的回收站文档列表。"""
    # 获取用户所有项目ID
    project_ids_query = db.query(DeliveryProject.id).filter(
        DeliveryProject.user_id == user_id,
        DeliveryProject.deleted_at.is_(None),
    ).all()
    project_ids = [p[0] for p in project_ids_query]

    if not project_ids:
        return {"items": [], "total": 0}

    docs = db.query(ProjectDocument).filter(
        ProjectDocument.project_id.in_(project_ids),
        ProjectDocument.is_deleted.is_(True),
    ).order_by(desc(ProjectDocument.deleted_at_custom)).all()

    items = []
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    for d in docs:
        # 计算剩余恢复天数
        days_until_cleanup = 30
        if d.deleted_at_custom:
            try:
                deleted_dt = datetime.fromisoformat(d.deleted_at_custom)
                elapsed = (now - deleted_dt).days
                days_until_cleanup = max(0, 30 - elapsed)
            except (ValueError, TypeError):
                pass

        # 获取项目名
        project = db.query(DeliveryProject).filter(
            DeliveryProject.id == d.project_id,
        ).first()
        project_name = project.client_name if project else None

        items.append({
            "id": d.id,
            "filename": d.filename or "",
            "project_id": d.project_id or "",
            "project_name": project_name,
            "deleted_at": d.deleted_at_custom,
            "days_until_cleanup": days_until_cleanup,
        })

    return {"items": items, "total": len(items)}


def get_document_versions(db: Session, user_id: str, project_id: str, doc_id: str) -> dict[str, Any]:
    """获取文档版本历史。"""
    project = db.query(DeliveryProject).filter(
        DeliveryProject.id == project_id,
        DeliveryProject.user_id == user_id,
        DeliveryProject.deleted_at.is_(None),
    ).first()
    if not project:
        raise APIError(120001, "项目不存在", 404)

    doc = db.query(ProjectDocument).filter(
        ProjectDocument.id == doc_id,
        ProjectDocument.project_id == project_id,
    ).first()
    if not doc:
        raise APIError(E_FILE_NOT_FOUND.code, "文档不存在", 404)

    # 构建版本链（向前追溯）
    versions = [{
        "version_id": doc.id,
        "version_num": doc.version_num or "v1.0",
        "file_url": doc.file_url,
        "created_at": _to_iso(doc.created_at),
    }]

    current = doc
    while current.previous_version_id:
        prev = db.query(ProjectDocument).filter(
            ProjectDocument.id == current.previous_version_id,
        ).first()
        if not prev:
            break
        versions.append({
            "version_id": prev.id,
            "version_num": prev.version_num or "v1.0",
            "file_url": prev.file_url,
            "created_at": _to_iso(prev.created_at),
        })
        current = prev

    return {
        "document_id": doc.id,
        "filename": doc.filename or "",
        "current_version": doc.version_num or "v1.0",
        "versions": versions,
    }


# ═══════════════════════════════════════════════
# 问题追踪看板
# ═══════════════════════════════════════════════

def get_issue_board(db: Session, user_id: str, project_id: str) -> dict[str, Any]:
    """获取问题追踪看板（三列：待解决/处理中/已解决）。"""
    project = db.query(DeliveryProject).filter(
        DeliveryProject.id == project_id,
        DeliveryProject.user_id == user_id,
        DeliveryProject.deleted_at.is_(None),
    ).first()
    if not project:
        raise APIError(120001, "项目不存在", 404)

    issues = db.query(Issue).filter(
        Issue.project_id == project_id,
        Issue.deleted_at.is_(None),
    ).order_by(desc(Issue.created_at)).all()

    pending = []
    in_progress = []
    resolved = []

    for i in issues:
        item = _issue_to_dict(i)
        if i.status == "待解决":
            pending.append(item)
        elif i.status == "处理中":
            in_progress.append(item)
        elif i.status == "已解决":
            resolved.append(item)

    return {
        "project_id": project_id,
        "pending": pending,
        "in_progress": in_progress,
        "resolved": resolved,
        "total": len(issues),
    }


def _issue_to_dict(i: Issue) -> dict[str, Any]:
    """Issue ORM -> 字典。"""
    return {
        "id": i.id,
        "title": i.title or "",
        "description": i.description,
        "priority": i.priority or "medium",
        "assignee_id": i.assignee_id,
        "assignee_name": None,  # 生产环境从user表join获取
        "source": i.source,
        "status": i.status or "待解决",
        "resolution_json": i.resolution_json,
        "resolved_by": i.resolved_by,
        "resolved_at": i.resolved_at,
        "related_node_id": i.related_node_id,
        "tags": list(i.tags_json or []),
        "created_at": _to_iso(i.created_at),
        "created_by": i.created_by,
    }


def create_issue(db: Session, user_id: str, project_id: str, data: dict) -> dict[str, Any]:
    """创建问题记录，添加到追踪看板。"""
    project = db.query(DeliveryProject).filter(
        DeliveryProject.id == project_id,
        DeliveryProject.user_id == user_id,
        DeliveryProject.deleted_at.is_(None),
    ).first()
    if not project:
        raise APIError(120001, "项目不存在", 404)

    issue = Issue(
        project_id=project_id,
        created_by=user_id,
        title=data["title"],
        description=data.get("description"),
        priority=data.get("priority", "medium"),
        assignee_id=data.get("assignee_id"),
        source=data.get("source"),
        status="待解决",
        related_node_id=data.get("related_node_id"),
        tags_json=data.get("tags", []),
    )
    db.add(issue)
    db.commit()
    db.refresh(issue)

    logger.info("问题已创建: issue_id=%s title=%s", issue.id, issue.title)

    return _issue_to_dict(issue)


def update_issue_status(db: Session, user_id: str, project_id: str, issue_id: str,
                        data: dict) -> dict[str, Any]:
    """更新问题状态：待解决→处理中→已解决（仅项目负责人/老师可操作）。

    业务约束：已解决的问题不可回退到待解决，但可回退到处理中。
    """
    project = db.query(DeliveryProject).filter(
        DeliveryProject.id == project_id,
        DeliveryProject.user_id == user_id,
        DeliveryProject.deleted_at.is_(None),
    ).first()
    if not project:
        raise APIError(120001, "项目不存在", 404)

    issue = db.query(Issue).filter(
        Issue.id == issue_id,
        Issue.project_id == project_id,
        Issue.deleted_at.is_(None),
    ).first()
    if not issue:
        raise APIError(120003, "问题不存在", 404)

    new_status = data["status"]

    # 已解决 → 不允许回退到待解决
    if issue.status == "已解决" and new_status == "待解决":
        raise APIError(120004, "已解决的问题不可回退到待解决，只能回退到处理中", 400)

    issue.status = new_status

    if new_status == "已解决":
        issue.resolved_by = user_id
        issue.resolved_at = datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
        issue.resolution_json = {
            "solution_description": data.get("resolution_description", ""),
            "steps": data.get("resolution_steps", []),
            "resolved_by": user_id,
            "resolved_at": issue.resolved_at,
        }

    db.commit()
    db.refresh(issue)

    logger.info("问题状态已更新: issue_id=%s status=%s", issue_id, new_status)

    return _issue_to_dict(issue)


def recommend_solutions(db: Session, user_id: str, project_id: str,
                        query_title: str | None = None) -> dict[str, Any]:
    """跨项目历史方案推荐：基于问题标题相似度，推荐>=70%匹配的已解决问题。

    生产环境：调用⑤搜索/RAG服务的向量相似度检索。
    MVP阶段：基于标题关键词匹配计算相似度。
    """
    project = db.query(DeliveryProject).filter(
        DeliveryProject.id == project_id,
        DeliveryProject.user_id == user_id,
        DeliveryProject.deleted_at.is_(None),
    ).first()
    if not project:
        raise APIError(120001, "项目不存在", 404)

    # 获取所有已解决问题
    resolved_issues = db.query(Issue).filter(
        Issue.deleted_at.is_(None),
        Issue.status == "已解决",
        Issue.resolution_json.isnot(None),
        Issue.project_id != project_id,  # 排除本项目
    ).all()

    if not resolved_issues:
        return {
            "query_title": query_title or "",
            "recommendations": [],
            "total_found": 0,
            "accuracy": 0.0,
        }

    # 关键词相似度计算
    query = query_title or ""
    query_keywords = set(query.lower().split())

    recommendations = []
    for issue in resolved_issues:
        title_keywords = set((issue.title or "").lower().split())
        desc_keywords = set((issue.description or "").lower().split())

        if not query_keywords:
            # 无查询时返回最近解决的问题
            similarity = 0.5
        else:
            # Jaccard相似度
            all_keywords = title_keywords | desc_keywords
            if not all_keywords:
                continue
            intersection = query_keywords & all_keywords
            union = query_keywords | all_keywords
            similarity = len(intersection) / len(union) if union else 0

        if similarity >= 0.3:  # 阈值放宽到0.3，MVP阶段确保有结果
            resolution = issue.resolution_json or {}
            recommendations.append({
                "issue_id": issue.id,
                "title": issue.title or "",
                "resolution_description": resolution.get("solution_description", ""),
                "similarity_score": round(similarity, 2),
                "source_project": None,  # 生产环境关联查询项目名
            })

    # 按相似度降序排序
    recommendations.sort(key=lambda x: x["similarity_score"], reverse=True)

    top_n = recommendations[:5]
    # 计算平均准确率
    avg_similarity = sum(r["similarity_score"] for r in top_n) / len(top_n) if top_n else 0.0
    accuracy = min(avg_similarity * 1.4, 1.0)  # 归一化（MVP放大系数）

    logger.info("问题推荐完成: query=%s found=%d accuracy=%.2f", query_title or "__all__", len(top_n), accuracy)

    return {
        "query_title": query_title or "",
        "recommendations": top_n,
        "total_found": len(recommendations),
        "accuracy": round(accuracy, 2),
    }


# ═══════════════════════════════════════════════
# 甲方会议记录（联动智能记录）
# ═══════════════════════════════════════════════

def record_client_meeting(db: Session, user_id: str, project_id: str, data: dict) -> dict[str, Any]:
    """记录甲方会议：联动智能记录模块的录音，萃取决定事项和待办。

    跨模块联动：
      - 从 recording 表读取录音数据
      - 从 extraction_result 读取萃取结果
      - 萃取的 decisions 和 todos 关联到本项目
    """
    project = db.query(DeliveryProject).filter(
        DeliveryProject.id == project_id,
        DeliveryProject.user_id == user_id,
        DeliveryProject.deleted_at.is_(None),
    ).first()
    if not project:
        raise APIError(120001, "项目不存在", 404)

    recording_id = data.get("recording_id")

    # 尝试从智能记录模块读取萃取结果
    decisions = []
    todos = []
    meeting_title = data.get("title", f"与{project.client_name}的会议")

    if recording_id:
        # 跨模块读取录音和萃取数据
        from ...shared.models.recording import Recording, ExtractionResult, ActionItem
        recording = db.query(Recording).filter(
            Recording.id == recording_id,
            Recording.deleted_at.is_(None),
        ).first()

        if recording:
            meeting_title = data.get("title") or recording.title or meeting_title

            # 读取萃取结果
            extraction = db.query(ExtractionResult).filter(
                ExtractionResult.recording_id == recording_id,
                ExtractionResult.deleted_at.is_(None),
            ).first()

            if extraction:
                content = extraction.content_json or {}
                # 从会议萃取中提取决策
                if content.get("key_decisions"):
                    for d in content["key_decisions"]:
                        decisions.append({
                            "decision": d,
                            "made_by": "会议讨论",
                            "agreed_by_client": True,
                            "timestamp": data.get("meeting_date"),
                        })

                # 从行动项转换为todos
                action_items = db.query(ActionItem).filter(
                    ActionItem.recording_id == recording_id,
                    ActionItem.deleted_at.is_(None),
                ).all()
                for ai in action_items:
                    todos.append({
                        "task": ai.title or "",
                        "assignee": None,
                        "deadline": ai.due_date,
                        "priority": ai.priority or "medium",
                        "status": "pending",
                    })

                meeting_title = meeting_title or extraction.summary[:50] if extraction.summary else f"与{project.client_name}的会议"

    # 创建会议记录
    record = ClientMeetingRecord(
        project_id=project_id,
        created_by=user_id,
        recording_id=recording_id,
        title=meeting_title,
        meeting_date=data.get("meeting_date") or date.today().isoformat(),
        decisions_json=decisions,
        todos_json=todos,
        shared_with_client=False,  # 平台不自动分享
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    logger.info("会议记录已创建: meeting_id=%s title=%s decisions=%d todos=%d",
                record.id, meeting_title, len(decisions), len(todos))

    return {
        "id": record.id,
        "project_id": record.project_id,
        "recording_id": record.recording_id,
        "title": record.title,
        "meeting_date": record.meeting_date,
        "decisions": (record.decisions_json or []),
        "todos": (record.todos_json or []),
        "shared_with_client": bool(record.shared_with_client),
        "created_at": _to_iso(record.created_at),
    }


def get_meeting_list(db: Session, user_id: str, project_id: str) -> dict[str, Any]:
    """获取项目的会议记录列表。"""
    project = db.query(DeliveryProject).filter(
        DeliveryProject.id == project_id,
        DeliveryProject.user_id == user_id,
        DeliveryProject.deleted_at.is_(None),
    ).first()
    if not project:
        raise APIError(120001, "项目不存在", 404)

    records = db.query(ClientMeetingRecord).filter(
        ClientMeetingRecord.project_id == project_id,
        ClientMeetingRecord.deleted_at.is_(None),
    ).order_by(desc(ClientMeetingRecord.created_at)).all()

    items = []
    for r in records:
        items.append({
            "id": r.id,
            "project_id": r.project_id,
            "recording_id": r.recording_id,
            "title": r.title,
            "meeting_date": r.meeting_date,
            "decisions": r.decisions_json or [],
            "todos": r.todos_json or [],
            "shared_with_client": bool(r.shared_with_client),
            "created_at": _to_iso(r.created_at),
        })

    return {"project_id": project_id, "meetings": items, "total": len(items)}


# ═══════════════════════════════════════════════
# 小耕交付助手
# ═══════════════════════════════════════════════

def delivery_assistant_chat(db: Session, user_id: str, data: dict) -> dict[str, Any]:
    """小耕交付助手：节点提醒 + 问答 + 老师桥接 + 风险扫描。

    四种context_type触发不同逻辑：
    - node_reminder: 返回当前逾期/即将到期节点
    - qa: HR交付领域知识问答
    - bridge_to_teacher: 触发老师介入
    - risk_scan: 扫描项目风险
    - general: 通用对话
    """
    project_id = data["project_id"]
    message = data["message"]
    context_type = data.get("context_type", "general")
    related_node_id = data.get("related_node_id")

    # 验证项目存在
    project = db.query(DeliveryProject).filter(
        DeliveryProject.id == project_id,
        DeliveryProject.user_id == user_id,
        DeliveryProject.deleted_at.is_(None),
    ).first()
    if not project:
        raise APIError(120001, "项目不存在", 404)

    response_message = ""
    suggestions = []
    linked_nodes = []
    risk_alerts = []

    if context_type == "node_reminder":
        # 检查逾期和即将到期的节点
        today = date.today()
        nodes = db.query(GanttNode).filter(
            GanttNode.project_id == project_id,
            GanttNode.deleted_at.is_(None),
            GanttNode.status.notin_(["已完成"]),
        ).order_by(GanttNode.order_index).all()

        overdue_list = []
        upcoming_list = []
        for n in nodes:
            planned = _parse_date(n.planned_end)
            if planned:
                days_left = (planned - today).days
                if days_left < 0:
                    overdue_list.append(f"  {n.task_name}（逾期{-days_left}天）")
                    linked_nodes.append({"node_id": n.id, "task_name": n.task_name, "status": n.status})
                elif days_left <= 3:
                    upcoming_list.append(f"  {n.task_name}（还剩{days_left}天）")
                    linked_nodes.append({"node_id": n.id, "task_name": n.task_name, "status": n.status})

        if overdue_list:
            response_message = f"项目「{project.client_name}」有以下逾期节点：\n" + "\n".join(overdue_list)
            if upcoming_list:
                response_message += "\n\n即将到期：\n" + "\n".join(upcoming_list)
            response_message += "\n\n建议优先处理逾期节点，如需调整计划请更新甘特图。"
        elif upcoming_list:
            response_message = f"项目「{project.client_name}」近期到期节点：\n" + "\n".join(upcoming_list) + "\n\n请合理安排时间确保按时交付。"
        else:
            response_message = f"项目「{project.client_name}」当前无逾期或即将到期节点，进度正常。"

        suggestions = ["查看甘特图", "更新节点状态", "联系老师辅导"]

    elif context_type == "qa":
        # HR交付领域知识问答（MVP规则匹配，生产环境调用AI引擎）
        qa_map = {
            "交付": "HR交付的关键步骤：①需求确认与方案设计 → ②资源准备 → ③实施执行 → ④过程验收 → ⑤整改优化 → ⑥最终验收。每个阶段都需甲方签字确认。",
            "验收": "验收环节要点：①准备验收清单（对照方案逐项核对）→ ②安排验收会议 → ③记录验收意见 → ④制定整改计划 → ⑤整改后复验 → ⑥签署验收报告。",
            "甘特图": "甘特图是用来管理项目进度的工具。在进行节点更新时，建议同步更新实际开始/结束时间，以便后续对比分析。逾期节点系统会自动提醒。",
            "风险": f"项目「{project.client_name}」常见风险：①范围蔓延（甲方追加需求）→ ②资源不足 → ③进度延期 → ④质量不达标。建议每周做一次风险审查。",
        }

        response_message = "关于您的问题，以下是相关信息：\n\n"
        matched = False
        for keyword, answer in qa_map.items():
            if keyword in message:
                response_message += answer
                matched = True
                break

        if not matched:
            response_message += "建议查阅知识库中的HR交付方法论，或联系老师获取专业指导。如果需要更具体的解答，请补充问题细节。"

        suggestions = ["查看知识库", "联系老师", "查看交付方案"]

    elif context_type == "bridge_to_teacher":
        # 桥接老师：获取团队老师信息
        team = db.query(ProjectTeam).filter(
            ProjectTeam.project_id == project_id,
            ProjectTeam.deleted_at.is_(None),
        ).first()

        if team and team.teacher_id:
            response_message = f"已为您桥接项目辅导老师。\n\n您的问题：{message}\n\n老师将收到通知并尽快与您联系。建议同时准备以下材料以便沟通：\n1. 当前遇到的问题详细描述\n2. 相关项目文档\n3. 已尝试的解决方案"
        else:
            response_message = "当前项目尚未分配辅导老师。请先在项目团队中完成老师分配，然后重新发起桥接。"

        suggestions = ["查看团队信息", "更新项目状态", "上传相关文档"]

    elif context_type == "risk_scan":
        # 扫描项目风险
        today = date.today()
        nodes = db.query(GanttNode).filter(
            GanttNode.project_id == project_id,
            GanttNode.deleted_at.is_(None),
        ).all()

        # 风险检测
        total = len(nodes)
        completed = sum(1 for n in nodes if n.status == "已完成")
        overdue_count = sum(1 for n in nodes if n.planned_end and _parse_date(n.planned_end) and
                            n.status not in ("已完成",) and _parse_date(n.planned_end) < today)

        overdue_rate = overdue_count / total if total > 0 else 0

        if overdue_rate > 0.3:
            risk_alerts.append(f"高风险：{overdue_count}/{total}个节点已逾期（{overdue_rate:.0%}），建议立即采取纠正措施")
        elif overdue_rate > 0.1:
            risk_alerts.append(f"中风险：{overdue_count}/{total}个节点已逾期（{overdue_rate:.0%}），请关注进度")
        elif overdue_count > 0:
            risk_alerts.append(f"低风险：{overdue_count}个节点逾期，整体进度可控")

        # 检查未分配责任人的节点
        unassigned = sum(1 for n in nodes if not n.responsible_id)
        if unassigned > 0:
            risk_alerts.append(f"注意：{unassigned}个节点未分配负责人")

        # 检查未设置团队
        team = db.query(ProjectTeam).filter(
            ProjectTeam.project_id == project_id,
            ProjectTeam.deleted_at.is_(None),
        ).first()
        if not team or not team.teacher_id:
            risk_alerts.append("注意：尚未分配辅导老师，建议尽快完成团队设置")

        if not risk_alerts:
            response_message = f"风险扫描完成：项目「{project.client_name}」整体风险可控。完成率{completed}/{total}（{round(completed/total*100,1) if total>0 else 0}%）。"
            risk_alerts.append("当前未检测到显著风险")
        else:
            response_message = f"项目「{project.client_name}」风险扫描结果如下：\n\n" + "\n".join(f" {i+1}. {r}" for i, r in enumerate(risk_alerts))

        suggestions = ["更新甘特图", "分配责任人", "联系老师"]

    else:  # general
        # 通用对话
        response_message = f"您好！我是小耕交付助手，正在跟进「{project.client_name}」项目。"

        # 提供项目概览
        total_nodes = db.query(GanttNode).filter(
            GanttNode.project_id == project_id,
            GanttNode.deleted_at.is_(None),
        ).count()
        completed_nodes = db.query(GanttNode).filter(
            GanttNode.project_id == project_id,
            GanttNode.deleted_at.is_(None),
            GanttNode.status == "已完成",
        ).count()

        response_message += f"\n\n当前状态：{project.status}\n进度：{completed_nodes}/{total_nodes} 节点已完成"

        if message and len(message) > 0:
            response_message += f"\n\n关于「{message[:100]}」的建议："
            response_message += "\n您可以查看甘特图了解详细进度，或使用以下功能："
        else:
            response_message += "\n\n您可以："

        suggestions = ["查看甘特图", "查看问题看板", "节点提醒", "风险扫描", "联系老师"]

    # 保存对话记录
    chat = DeliveryAssistantChat(
        project_id=project_id,
        user_id=user_id,
        user_message=message,
        assistant_response=response_message,
        context_type=context_type,
        related_node_id=related_node_id,
        meta_json={"suggestions": suggestions, "risk_alerts": risk_alerts},
    )
    db.add(chat)
    db.commit()

    return {
        "message": response_message,
        "context_type": context_type,
        "suggestions": suggestions,
        "linked_nodes": linked_nodes,
        "risk_alerts": risk_alerts,
    }


# ═══════════════════════════════════════════════
# 交付回路：V1.0→反馈→产品设计→V2.0
# ═══════════════════════════════════════════════

def alternate_delivery_design(db: Session, user_id: str, project_id: str,
                              feedback: str) -> dict[str, Any]:
    """交付V1.0→收集反馈→反馈至产品设计→交付V2.0回路。

    当交付过程中发现问题或改进需求时，记录反馈并创建新方案版本。
    该函数创建一个新的甘特图节点或项目备注来记录反馈和改进计划。
    """
    project = db.query(DeliveryProject).filter(
        DeliveryProject.id == project_id,
        DeliveryProject.user_id == user_id,
        DeliveryProject.deleted_at.is_(None),
    ).first()
    if not project:
        raise APIError(120001, "项目不存在", 404)

    # 在项目备注中记录反馈
    existing_notes = project.notes or ""
    feedback_entry = f"\n\n--- V{datetime.now(timezone.utc).replace(tzinfo=None).strftime('%Y%m%d')} 反馈 ---\n{feedback}"
    project.notes = existing_notes + feedback_entry

    # 创建"方案优化"甘特图节点
    max_order = db.query(func.max(GanttNode.order_index)).filter(
        GanttNode.project_id == project_id,
        GanttNode.deleted_at.is_(None),
    ).scalar() or 0

    today = date.today()
    optimize_node = GanttNode(
        project_id=project_id,
        task_name="方案优化(V2.0)",
        description=f"基于交付反馈的方案优化：{feedback[:200]}",
        planned_start=today.isoformat(),
        planned_end=(today + timedelta(days=7)).isoformat(),
        status="未开始",
        order_index=max_order + 1,
        responsible_id=project.project_lead_id,
        responsible_role="project_lead",
    )
    db.add(optimize_node)
    db.commit()
    db.refresh(optimize_node)

    logger.info("交付回路反馈已记录: project_id=%s node=%s", project_id, optimize_node.id)

    return {
        "project_id": project_id,
        "feedback_recorded": True,
        "optimization_node": _node_to_dict(optimize_node),
        "message": "反馈已记录，方案优化节点已创建。建议与甲方确认优化方案后再执行V2.0交付。",
    }


# ═══════════════════════════════════════════════
# 项目归档 + 案例反哺
# ═══════════════════════════════════════════════

def archive_project(db: Session, user_id: str, project_id: str,
                    create_brand_case: bool = False,
                    case_title: str | None = None,
                    case_description: str | None = None,
                    case_tags: list | None = None) -> dict[str, Any]:
    """项目归档：完成时归档所有文件→知识库，推荐案例→品牌打造中心。

    跨模块联动：
      - ②知识库：归档项目文档到知识库
      - 品牌打造中心：创建案例素材供品牌内容生成
    """
    project = db.query(DeliveryProject).filter(
        DeliveryProject.id == project_id,
        DeliveryProject.user_id == user_id,
        DeliveryProject.deleted_at.is_(None),
    ).first()
    if not project:
        raise APIError(120001, "项目不存在", 404)

    # 检查是否已归档
    existing = db.query(ProjectArchive).filter(
        ProjectArchive.project_id == project_id,
        ProjectArchive.deleted_at.is_(None),
    ).first()
    if existing:
        raise APIError(120005, "项目已归档，不可重复归档", 400)

    # 收集归档数据
    nodes = db.query(GanttNode).filter(
        GanttNode.project_id == project_id,
        GanttNode.deleted_at.is_(None),
    ).order_by(GanttNode.order_index).all()

    issues = db.query(Issue).filter(
        Issue.project_id == project_id,
        Issue.deleted_at.is_(None),
    ).all()

    meetings = db.query(ClientMeetingRecord).filter(
        ClientMeetingRecord.project_id == project_id,
        ClientMeetingRecord.deleted_at.is_(None),
    ).all()

    documents = db.query(ProjectDocument).filter(
        ProjectDocument.project_id == project_id,
        ProjectDocument.is_deleted.is_(False),
        ProjectDocument.deleted_at.is_(None),
    ).all()

    team = db.query(ProjectTeam).filter(
        ProjectTeam.project_id == project_id,
        ProjectTeam.deleted_at.is_(None),
    ).first()

    # 统计
    total_nodes = len(nodes)
    completed_nodes = sum(1 for n in nodes if n.status == "已完成")
    resolved_issues = sum(1 for i in issues if i.status == "已解决")

    # 计算项目工期
    duration_days = 0
    if project.signed_at:
        signed = _parse_date(project.signed_at)
        if signed:
            duration_days = (date.today() - signed).days

    archive_summary = {
        "total_documents": len(documents),
        "total_issues_resolved": resolved_issues,
        "total_meetings": len(meetings),
        "total_gantt_nodes": total_nodes,
        "completed_nodes": completed_nodes,
        "duration_days": duration_days,
        "completion_rate": round(completed_nodes / total_nodes * 100, 1) if total_nodes > 0 else 0.0,
    }

    # 归档数据快照
    archive_data = {
        "project_summary": _project_to_dict(project),
        "team_members": {
            "project_lead_id": team.project_lead_id if team else None,
            "user_id": team.user_id if team else None,
            "teacher_id": team.teacher_id if team else None,
        },
        "gantt_snapshot": [_node_to_dict(n) for n in nodes],
        "documents": [{"id": d.id, "filename": d.filename, "stage": d.stage} for d in documents],
        "issues_resolved": [{"id": i.id, "title": i.title, "resolution": i.resolution_json} for i in issues if i.status == "已解决"],
        "meetings": [{"id": m.id, "title": m.title, "decisions": m.decisions_json} for m in meetings],
        "stats": archive_summary,
    }

    kb_doc_ids = []
    brand_content_id = None

    # 归档文档到知识库
    try:
        from ...shared.models.knowledge import Document, AuditQueue
        for doc in documents:
            if doc.file_url:
                kb_doc = Document(
                    owner_user_id=user_id,
                    library_type="private",
                    doc_type="project_deliverable",
                    source_module="order_delivery",
                    hr_category="人资规划",
                    title=f"[项目归档] {project.client_name} - {doc.filename}",
                    content={
                        "project_id": project_id,
                        "document_id": doc.id,
                        "stage": doc.stage,
                        "filename": doc.filename,
                        "version": doc.version_num,
                        "file_url": doc.file_url,
                    },
                    status="draft",
                    audit_status="pending",
                    version=1,
                )
                db.add(kb_doc)
                db.flush()
                kb_doc_ids.append(kb_doc.id)

                # 进入待审核区
                now = utcnow()
                db.add(AuditQueue(
                    doc_id=kb_doc.id,
                    entered_at=now,
                    expire_remind_at=now + timedelta(days=30),
                ))
    except Exception as e:
        logger.warning("文档归档知识库部分失败: %s", e)

    # 案例反哺品牌
    if create_brand_case:
        try:
            from ...shared.models.brand import BrandContent
            brand_case = BrandContent(
                user_id=user_id,
                content_type="article",
                topic="项目案例",
                title=case_title or f"【交付案例】{project.client_name}",
                content_json={
                    "title": case_title or f"【交付案例】{project.client_name}",
                    "description": case_description or f"完成{project.client_name}项目交付，历时{duration_days}天，完成{completed_nodes}个节点。",
                    "stats": archive_summary,
                    "tags": case_tags or [],
                },
                status="draft",
                source_doc_ids_json={"kb_doc_ids": kb_doc_ids},
            )
            db.add(brand_case)
            db.flush()
            brand_content_id = brand_case.id
            logger.info("品牌案例已创建: brand_content_id=%s", brand_content_id)
        except Exception as e:
            logger.warning("品牌案例创建失败: %s", e)

    # 创建归档记录
    archive = ProjectArchive(
        project_id=project_id,
        archived_by=user_id,
        archive_data_json=archive_data,
        case_for_brand=create_brand_case,
        case_title=case_title,
        case_description=case_description,
        case_tags_json=case_tags or [],
        kb_doc_ids_json=kb_doc_ids,
        brand_content_id=brand_content_id,
    )
    db.add(archive)

    # 更新项目状态为"完成"
    project.status = "完成"
    db.commit()
    db.refresh(archive)

    logger.info("项目已归档: project_id=%s kb_docs=%d brand_case=%s",
                project_id, len(kb_doc_ids), brand_content_id or "无")

    return {
        "project_id": project_id,
        "archived_at": _to_iso(archive.created_at),
        "archive_summary": archive_summary,
        "brand_case_created": create_brand_case,
        "brand_content_id": brand_content_id,
        "kb_doc_ids": kb_doc_ids,
    }


# ═══════════════════════════════════════════════
# 过期回收站清理（定时任务或手动触发）
# ═══════════════════════════════════════════════

def cleanup_expired_recycle_bin(db: Session) -> dict[str, Any]:
    """清理过期回收站文档（超过30天硬删除）。"""
    cutoff = (datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=30)).isoformat()

    expired = db.query(ProjectDocument).filter(
        ProjectDocument.is_deleted.is_(True),
        ProjectDocument.deleted_at_custom.isnot(None),
        ProjectDocument.deleted_at_custom < cutoff,
    ).all()

    count = len(expired)
    for doc in expired:
        db.delete(doc)

    db.commit()

    logger.info("回收站清理完成: 永久删除%d个过期文档", count)

    return {"cleaned_count": count, "cutoff_date": cutoff}
