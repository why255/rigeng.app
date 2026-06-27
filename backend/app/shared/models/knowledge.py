"""知识库域 ORM（步骤2 V1.1 §3.3）—— 统一文档模型为核心。"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
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


class Document(TimestampMixin, Base):
    """统一文档模型——全局最重要实体。一份数据·多模块展示。"""

    __tablename__ = "document"

    owner_user_id: Mapped[str | None] = mapped_column(GUID, index=True)  # 携君库=平台NULL
    library_type: Mapped[str] = mapped_column(String(16), default="private", index=True)
    doc_type: Mapped[str] = mapped_column(String(32), index=True)
    source_module: Mapped[str | None] = mapped_column(String(8), index=True)  # M1..M13
    hr_category: Mapped[str | None] = mapped_column(String(32), index=True)  # 后台可配置
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
