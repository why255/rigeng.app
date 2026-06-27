"""交付一笔订单域 — ORM 模型（步骤24 / Wave 5）。

八张表：
- DeliveryProject: 项目主表（客户/签约/方案/状态）
- ProjectTeam: 项目团队三角色（项目负责人+用户+老师）
- GanttNode: 甘特图节点（计划/实际/双确认）
- ProjectDocument: 输出文档管理（阶段/版本/回收站）
- Issue: 问题追踪看板（待解决→处理中→已解决）
- ClientMeetingRecord: 甲方会议记录（联动智能记录）
- DeliveryAssistantChat: 小耕交付助手对话
- ProjectArchive: 项目归档+案例反哺

跨模块调用链：
  方案导入 → ②知识库（方案基准存储）
  会议记录 → M4智能记录（录音转写+萃取联动）
  案例归档 → ②知识库（项目文件归档）
  案例反哺 → 品牌打造中心（案例推荐）
  问题推荐 → ⑤搜索/RAG（历史问题相似度检索）
"""
from __future__ import annotations

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import GUID, Base, PortableJSON, TimestampMixin

# ── 枚举常量 ──
PROJECT_STATUSES = ("签约", "方案设计", "交付中", "完成")
GANTT_NODE_STATUSES = ("未开始", "进行中", "已完成", "逾期")
ISSUE_STATUSES = ("待解决", "处理中", "已解决")
ISSUE_PRIORITIES = ("low", "medium", "high", "urgent")
ISSUE_SOURCES = ("实施过程", "方案设计", "客户反馈", "内部审查")
TEAM_ROLES = ("project_lead", "user", "teacher")
DOCUMENT_STAGES = ("启动", "方案设计", "实施", "验收", "交付", "维保")


class DeliveryProject(TimestampMixin, Base):
    """项目主表。记录每笔订单的交付项目全生命周期。"""

    __tablename__ = "delivery_project"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    client_name: Mapped[str] = mapped_column(String(256))
    signed_at: Mapped[str | None] = mapped_column(String(32))  # 签约时间 ISO date
    service_list_json: Mapped[dict | None] = mapped_column(PortableJSON())
    # 服务清单: [{name, description, quantity, unit_price}, ...]
    solution_ref: Mapped[str | None] = mapped_column(String(512))  # 方案来源引用（方案库ID或手动描述）
    status: Mapped[str] = mapped_column(String(32), default="签约", index=True)
    # 签约 → 方案设计 → 交付中 → 完成

    # 项目备注
    notes: Mapped[str | None] = mapped_column(Text)
    # 项目交付经理（冗余，方便查询）
    project_lead_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("user_account.id"))


class ProjectTeam(TimestampMixin, Base):
    """项目团队三角色：项目负责人 + 用户(甲方决策人) + 老师(交付辅导)。"""

    __tablename__ = "project_team"

    project_id: Mapped[str] = mapped_column(GUID, ForeignKey("delivery_project.id"), unique=True, index=True)
    project_lead_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("user_account.id"))
    user_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("user_account.id"))
    teacher_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("user_account.id"))

    # 角色备注
    lead_notes: Mapped[str | None] = mapped_column(Text)
    user_notes: Mapped[str | None] = mapped_column(Text)
    teacher_notes: Mapped[str | None] = mapped_column(Text)


class GanttNode(TimestampMixin, Base):
    """甘特图节点。方案拆解后的交付任务，含双确认机制。"""

    __tablename__ = "gantt_node"

    project_id: Mapped[str] = mapped_column(GUID, ForeignKey("delivery_project.id"), index=True)

    task_name: Mapped[str] = mapped_column(String(512))
    description: Mapped[str | None] = mapped_column(Text)

    # 计划时间
    planned_start: Mapped[str | None] = mapped_column(String(32))  # ISO date
    planned_end: Mapped[str | None] = mapped_column(String(32))    # ISO date

    # 实际时间
    actual_start: Mapped[str | None] = mapped_column(String(32))
    actual_end: Mapped[str | None] = mapped_column(String(32))

    # 状态: 未开始 / 进行中 / 已完成 / 逾期
    status: Mapped[str] = mapped_column(String(32), default="未开始", index=True)

    # 排序权重
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    # 负责人
    responsible_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("user_account.id"))
    responsible_role: Mapped[str | None] = mapped_column(String(32))  # project_lead/user/teacher

    # 双确认（用户+老师）
    confirmed_by_user: Mapped[bool] = mapped_column(Boolean, default=False)
    confirmed_by_teacher: Mapped[bool] = mapped_column(Boolean, default=False)
    user_confirmed_at: Mapped[str | None] = mapped_column(String(32))
    teacher_confirmed_at: Mapped[str | None] = mapped_column(String(32))

    # 节点备注/批注
    notes: Mapped[str | None] = mapped_column(Text)
    # 语音批注URL（移动端支持）
    voice_note_url: Mapped[str | None] = mapped_column(String(512))

    # 逾期提醒记录
    alert_sent_at: Mapped[str | None] = mapped_column(String(32))
    alert_count: Mapped[int] = mapped_column(Integer, default=0)

    # 父节点（支持子任务拆分）
    parent_node_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("gantt_node.id"))


class ProjectDocument(TimestampMixin, Base):
    """输出文档管理。按阶段/版本管理，支持回收站30天可恢复。"""

    __tablename__ = "project_document"

    project_id: Mapped[str] = mapped_column(GUID, ForeignKey("delivery_project.id"), index=True)
    uploaded_by: Mapped[str | None] = mapped_column(GUID, ForeignKey("user_account.id"))

    stage: Mapped[str | None] = mapped_column(String(32))  # 启动/方案设计/实施/验收/交付/维保
    filename: Mapped[str] = mapped_column(String(512))
    version_num: Mapped[str | None] = mapped_column(String(32), default="v1.0")
    file_url: Mapped[str | None] = mapped_column(String(1024))
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, default=0)
    mime_type: Mapped[str | None] = mapped_column(String(128))

    # 版本链（指向上一个版本的文档ID）
    previous_version_id: Mapped[str | None] = mapped_column(GUID)

    # 软删除（回收站）
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    deleted_at_custom: Mapped[str | None] = mapped_column(String(32))  # 回收站删除时间，30天后硬删除

    # 标签
    tags_json: Mapped[dict | None] = mapped_column(PortableJSON())


class Issue(TimestampMixin, Base):
    """问题追踪看板。交付过程中的问题记录和追踪。"""

    __tablename__ = "issue"

    project_id: Mapped[str] = mapped_column(GUID, ForeignKey("delivery_project.id"), index=True)
    created_by: Mapped[str | None] = mapped_column(GUID, ForeignKey("user_account.id"))

    title: Mapped[str] = mapped_column(String(512))
    description: Mapped[str | None] = mapped_column(Text)

    priority: Mapped[str] = mapped_column(String(32), default="medium")  # low/medium/high/urgent
    assignee_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("user_account.id"))
    source: Mapped[str | None] = mapped_column(String(32))  # 实施过程/方案设计/客户反馈/内部审查

    # 状态: 待解决 / 处理中 / 已解决
    status: Mapped[str] = mapped_column(String(32), default="待解决", index=True)

    # 解决方案
    resolution_json: Mapped[dict | None] = mapped_column(PortableJSON())
    # {solution_description, steps, resolved_by, resolved_at, reference_issue_ids: [...]}
    resolved_by: Mapped[str | None] = mapped_column(GUID, ForeignKey("user_account.id"))
    resolved_at: Mapped[str | None] = mapped_column(String(32))

    # 关联的甘特图节点
    related_node_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("gantt_node.id"))

    # 标签
    tags_json: Mapped[dict | None] = mapped_column(PortableJSON())


class ClientMeetingRecord(TimestampMixin, Base):
    """甲方会议记录。联动智能记录，萃取决定事项和待办。"""

    __tablename__ = "client_meeting_record"

    project_id: Mapped[str] = mapped_column(GUID, ForeignKey("delivery_project.id"), index=True)
    created_by: Mapped[str | None] = mapped_column(GUID, ForeignKey("user_account.id"))

    # 关联的录音记录ID（来自智能记录模块）
    recording_id: Mapped[str | None] = mapped_column(GUID, index=True)

    # 萃取的决定事项
    decisions_json: Mapped[dict | None] = mapped_column(PortableJSON())
    # [{decision, made_by, agreed_by_client, timestamp}, ...]

    # 萃取的待办事项
    todos_json: Mapped[dict | None] = mapped_column(PortableJSON())
    # [{task, assignee, deadline, priority, status}, ...]

    # 会议主题/标题
    title: Mapped[str | None] = mapped_column(String(512))
    # 会议日期
    meeting_date: Mapped[str | None] = mapped_column(String(32))

    # 是否已分享给甲方
    shared_with_client: Mapped[bool] = mapped_column(Boolean, default=False)


class DeliveryAssistantChat(TimestampMixin, Base):
    """小耕交付助手对话记录。节点提醒 + 问答 + 老师桥接 + 风险扫描。"""

    __tablename__ = "delivery_assistant_chat"

    project_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("delivery_project.id"), index=True)
    user_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)

    user_message: Mapped[str | None] = mapped_column(Text)
    assistant_response: Mapped[str | None] = mapped_column(Text)

    # 上下文类型: node_reminder / qa / bridge_to_teacher / risk_scan / general
    context_type: Mapped[str | None] = mapped_column(String(32))

    # 关联的甘特图节点
    related_node_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("gantt_node.id"))

    # 对话元数据
    meta_json: Mapped[dict | None] = mapped_column(PortableJSON())


class ProjectArchive(TimestampMixin, Base):
    """项目归档。完成后归档所有文件+案例反哺品牌。"""

    __tablename__ = "project_archive"

    project_id: Mapped[str] = mapped_column(GUID, ForeignKey("delivery_project.id"), unique=True, index=True)
    archived_by: Mapped[str | None] = mapped_column(GUID, ForeignKey("user_account.id"))

    # 归档数据（项目快照JSON）
    archive_data_json: Mapped[dict | None] = mapped_column(PortableJSON())
    # {project_summary, team_members, gantt_snapshot, documents, issues_resolved, meetings, stats}

    # 案例反哺品牌
    case_for_brand: Mapped[bool] = mapped_column(Boolean, default=False)
    case_title: Mapped[str | None] = mapped_column(String(512))
    case_description: Mapped[str | None] = mapped_column(Text)
    case_tags_json: Mapped[dict | None] = mapped_column(PortableJSON())

    # 归档的知识库文档ID
    kb_doc_ids_json: Mapped[dict | None] = mapped_column(PortableJSON())
    # 关联的品牌内容ID
    brand_content_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("brand_content.id"))
