"""知识库域 ORM（步骤2 V1.1 §3.3）—— 统一文档模型为核心。

携君智库接入（2026-07-15）：新增合同字段映射 + 入库流水线模型。
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import GUID, Base, PortableJSON, TimestampMixin

# 文档类型枚举（步骤2 §4.1；新增类型=扩展枚举，不新增表）
DOC_TYPES = (
    "sop", "improvement_strategy", "improvement_guide", "growth_manual",
    "extraction_report", "meeting_minutes", "interview_eval", "interview_review",
    "skill_crystal", "resume", "interview_strategy", "negotiation_strategy",
    "brand_content", "consultant_diagnosis", "abs_solution", "project_doc",
    "user_note", "prestudy_draft", "growth_story", "plan",
)
LIBRARY_TYPES = ("private", "public")
DOC_STATUS = ("draft", "published", "recycled")
AUDIT_STATUS = ("pending", "passed", "rejected")

# ═══════════════════════════════════════════════
# 携君智库接入 — 合同约定枚举（2026-07-15）
# ═══════════════════════════════════════════════

# 12个一级分类（hr_module字段，严格锁定）
HR_MODULES = (
    "00_职场经营智慧", "01_战略规划", "02_人力资源规划", "03_招聘配置",
    "04_培训开发", "05_薪酬福利", "06_绩效激励", "07_人效增长",
    "08_组织建设", "09_员工关系", "10_企业文化", "11_通用工具",
)

# 内容类型枚举
CONTENT_TYPES = (
    "观点", "方法论", "SOP", "流程", "制度", "表单", "数据", "案例", "技能晶体",
)

# 敏感度级别
SENSITIVITY_LEVELS = ("L0", "L1", "L2", "L3")

# 来源类型
ORIGIN_TYPES = ("manual", "auto-reflux", "user-shared")

# 软引擎标签（仅 is_wisdom=True 时有效）
WISDOM_TAGS = (
    "连环思维", "节点思维", "叠加思维",
    "是什么", "为什么", "怎么做", "怎么办",
    "谋局", "布局", "破局", "控局", "掌局",
    "能力", "杠杆", "规模",
)

# 结晶类型
CRYSTAL_TYPES = ("技能晶体", "经验晶体", "智慧晶体")

# 入库任务状态
INGESTION_STATUS = (
    "uploaded", "parsing", "processing", "completed", "completed_with_warnings", "failed",
)


class Document(TimestampMixin, Base):
    """统一文档模型——全局最重要实体。一份数据·多模块展示。

    携君智库接入（2026-07-15）：新增合同约定的17个YAML映射字段。
    """

    __tablename__ = "document"

    owner_user_id: Mapped[str | None] = mapped_column(GUID, index=True)  # 携君库=平台NULL
    library_type: Mapped[str] = mapped_column(String(16), default="private", index=True)
    doc_type: Mapped[str] = mapped_column(String(32), index=True)
    source_module: Mapped[str | None] = mapped_column(String(8), index=True)  # M1..M13
    hr_category: Mapped[str | None] = mapped_column(String(32), index=True)  # 后台可配置（旧字段，保留兼容）
    title: Mapped[str | None] = mapped_column(String(255))
    content: Mapped[dict | None] = mapped_column(PortableJSON())  # 结构化内容
    folder_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("folder.id"))
    status: Mapped[str] = mapped_column(String(16), default="draft", index=True)
    audit_status: Mapped[str] = mapped_column(String(16), default="pending")
    is_desensitized: Mapped[bool] = mapped_column(Boolean, default=False)
    is_negative_blocked: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    watermark_required: Mapped[bool] = mapped_column(Boolean, default=False)
    copy_char_limit: Mapped[int | None] = mapped_column(Integer)  # 携君库=500，私有库NULL
    trace_marker: Mapped[dict | None] = mapped_column(PortableJSON())
    file_object_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("file_object.id"))
    vector_status: Mapped[str] = mapped_column(String(16), default="pending")
    version: Mapped[int] = mapped_column(Integer, default=1)
    is_starred: Mapped[bool] = mapped_column(Boolean, default=False)
    growth_confirmed_by: Mapped[str | None] = mapped_column(GUID)

    # ═══════════════════════════════════════════════
    # 携君智库接入 — 合同约定YAML映射字段（A3）
    # ═══════════════════════════════════════════════
    citation_title: Mapped[str | None] = mapped_column(String(255))  # 答案引用标注
    source_id: Mapped[str | None] = mapped_column(String(64))  # 源号(W/Q/C/S前缀)
    hr_module: Mapped[str | None] = mapped_column(String(32), index=True)  # ★ 12一级分类(替代旧hr_category)
    content_type: Mapped[str | None] = mapped_column(String(32))  # 观点/方法论/SOP/流程/制度/表单/数据/案例/技能晶体
    is_wisdom: Mapped[bool] = mapped_column(Boolean, default=False, index=True)  # ★ 是否软引擎
    wisdom_tags: Mapped[dict | None] = mapped_column(PortableJSON())  # 软内容标签(JSON数组)
    crystal_type: Mapped[str | None] = mapped_column(String(32))  # 结晶类型
    sensitivity: Mapped[str] = mapped_column(String(8), default="L1", index=True)  # L0/L1/L2/L3
    origin_type: Mapped[str] = mapped_column(String(32), default="manual")  # manual/auto-reflux/user-shared
    keywords: Mapped[dict | None] = mapped_column(PortableJSON())  # 关键词(JSON数组)
    summary: Mapped[str | None] = mapped_column(Text)  # 摘要
    # 6组关联字段
    related_upstream: Mapped[dict | None] = mapped_column(PortableJSON())
    related_downstream: Mapped[dict | None] = mapped_column(PortableJSON())
    related_scenario: Mapped[dict | None] = mapped_column(PortableJSON())
    related_industry: Mapped[dict | None] = mapped_column(PortableJSON())
    related_source: Mapped[dict | None] = mapped_column(PortableJSON())
    related_version: Mapped[dict | None] = mapped_column(PortableJSON())
    # 双引擎交叉
    wisdom_applied: Mapped[dict | None] = mapped_column(PortableJSON())
    professional_applied: Mapped[dict | None] = mapped_column(PortableJSON())
    # 版本与索引
    version_number: Mapped[str | None] = mapped_column(String(32))  # YAML语义版本号(区别于version整数)
    is_indexed: Mapped[bool] = mapped_column(Boolean, default=False)  # 是否已完成向量化


class DocumentVersion(TimestampMixin, Base):
    __tablename__ = "document_version"

    doc_id: Mapped[str] = mapped_column(GUID, ForeignKey("document.id"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    content_snapshot: Mapped[dict | None] = mapped_column(PortableJSON())
    edited_by: Mapped[str | None] = mapped_column(GUID)


class Folder(TimestampMixin, Base):
    __tablename__ = "folder"

    owner_user_id: Mapped[str] = mapped_column(GUID, index=True)
    name: Mapped[str] = mapped_column(String(128))
    parent_id: Mapped[str | None] = mapped_column(GUID)
    hr_category: Mapped[str | None] = mapped_column(String(32))


class DocTag(TimestampMixin, Base):
    __tablename__ = "doc_tag"

    doc_id: Mapped[str] = mapped_column(GUID, ForeignKey("document.id"), index=True)
    tag: Mapped[str] = mapped_column(String(64))


class FileObject(TimestampMixin, Base):
    """文件对象元数据（大文件走对象存储，库内只存元数据）。"""

    __tablename__ = "file_object"

    storage_url: Mapped[str | None] = mapped_column(String(512))
    file_type: Mapped[str] = mapped_column(String(16))
    size_bytes: Mapped[int | None] = mapped_column(Integer)
    duration_sec: Mapped[int | None] = mapped_column(Integer)
    compress_status: Mapped[str] = mapped_column(String(16), default="raw")
    storage_layer: Mapped[str] = mapped_column(String(16), default="cloud")  # cloud/local_encrypted
    checksum: Mapped[str | None] = mapped_column(String(128))


class AuditQueue(TimestampMixin, Base):
    """待审核区（超30天提醒·不自动删除）。"""

    __tablename__ = "audit_queue"

    doc_id: Mapped[str] = mapped_column(GUID, ForeignKey("document.id"), unique=True, index=True)
    entered_at: Mapped[datetime | None] = mapped_column(DateTime)
    expire_remind_at: Mapped[datetime | None] = mapped_column(DateTime)


class GrowthReplayMaterial(TimestampMixin, Base):
    """成长型复盘素材（M3挫折→M8品牌，须用户主动确认）。"""

    __tablename__ = "growth_replay_material"

    user_id: Mapped[str] = mapped_column(GUID, index=True)
    source_doc_id: Mapped[str] = mapped_column(GUID, ForeignKey("document.id"))
    confirmed_by_user: Mapped[bool] = mapped_column(Boolean, default=False)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime)
    brand_doc_id: Mapped[str | None] = mapped_column(GUID)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)


class ContentPolicyRule(TimestampMixin, Base):
    """内容安全规则配置（品牌禁用词/分级路由/脱敏，统一规则引擎）。"""

    __tablename__ = "content_policy_rule"

    rule_type: Mapped[str] = mapped_column(String(32))
    category: Mapped[str | None] = mapped_column(String(32))
    keyword_or_pattern: Mapped[str | None] = mapped_column(String(255))
    action: Mapped[str] = mapped_column(String(16))  # block/warn/desensitize/route
    priority: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_by: Mapped[str | None] = mapped_column(GUID)


# ═══════════════════════════════════════════════
# 携君智库接入 — 入库流水线模型（2026-07-15）
# ═══════════════════════════════════════════════

class IngestionTask(TimestampMixin, Base):
    """zip上传处理任务跟踪（A1→A5流水线）。"""

    __tablename__ = "ingestion_task"

    upload_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)  # upl_20260719_2200_abc123
    package_id: Mapped[str | None] = mapped_column(String(64))  # 2026-W29（来自manifest）
    filename: Mapped[str | None] = mapped_column(String(255))  # 原始zip文件名
    file_size_bytes: Mapped[int | None] = mapped_column(Integer)  # zip文件大小
    status: Mapped[str] = mapped_column(String(32), default="uploaded", index=True)
    # uploaded → parsing → processing → completed / completed_with_warnings / failed
    total_files: Mapped[int] = mapped_column(Integer, default=0)
    processed_files: Mapped[int] = mapped_column(Integer, default=0)
    success_count: Mapped[int] = mapped_column(Integer, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, default=0)
    pending_review_count: Mapped[int] = mapped_column(Integer, default=0)
    report_id: Mapped[str | None] = mapped_column(GUID)  # 关联IngestionReport
    error_message: Mapped[str | None] = mapped_column(Text)  # 整体失败时的错误信息
    operator_id: Mapped[str | None] = mapped_column(GUID)  # 操作人


class IngestionReport(TimestampMixin, Base):
    """A5结构化入库报告。"""

    __tablename__ = "ingestion_report"

    task_id: Mapped[str] = mapped_column(GUID, ForeignKey("ingestion_task.id"), index=True)
    package_id: Mapped[str | None] = mapped_column(String(64))
    process_time: Mapped[datetime | None] = mapped_column(DateTime)  # 处理完成时间
    status: Mapped[str | None] = mapped_column(String(32))
    # completed / completed_with_warnings / failed
    counts: Mapped[dict | None] = mapped_column(PortableJSON())
    # {"processed": 60, "success": 57, "failed": 2, "pending_review": 1}
    failures: Mapped[list | None] = mapped_column(PortableJSON())
    # [{"path": "...", "reason": "YAML缺失必填字段citation_title"}]
    pending_review: Mapped[list | None] = mapped_column(PortableJSON())
    # [{"path": "...", "reason": "sensitivity=L2,需人工审核"}]


class DemandInsight(TimestampMixin, Base):
    """B3需求洞察记录（迭代1：双库缺失时自动记录）。"""

    __tablename__ = "demand_insight"

    user_id: Mapped[str] = mapped_column(GUID, index=True)
    question: Mapped[str | None] = mapped_column(Text)
    hr_module_tag: Mapped[str | None] = mapped_column(String(32))
    miss_level: Mapped[str | None] = mapped_column(String(16))  # both / l1_only / l2_only
    l3_summary: Mapped[str | None] = mapped_column(Text)
    cluster_id: Mapped[str | None] = mapped_column(String(64), index=True)
    frequency: Mapped[int] = mapped_column(Integer, default=1)
    closed: Mapped[bool] = mapped_column(Boolean, default=False)
