"""智能办公域 — ORM 模型（步骤19）。

五张表：
- OfficeDocument: 智能文档主表（工具库/体系库生成文档）
- SystemBuildState: 体系搭建6步进度状态
- OfficeDraft: 草稿箱（每步自动保存，30天保留）
- DocumentVersion: 文档版本历史（支持回滚）
- PolicyUpload: 用户上传的现有制度文件（仅私有库，不用于训练）

跨模块调用链：
  工具库/体系库 → ②知识库（三源检索） + ③AI引擎（文档生成）
  文档确认 → ②知识库（归档入库）
  多人协作 → ⑥消息推送（协作邀请通知）

数据规范（需求洞察）：
  - 双库（工具库/体系库）全部对用户可见，不按职级隐藏
  - 用户上传制度仅存储私有库，不用于模型训练
  - 草稿箱保留30天，每步自动保存
  - 统一确认入库（非每步弹窗）
  - 品牌标识可关闭
"""
from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import GUID, Base, PortableJSON, TimestampMixin

# ── 枚举常量 ──
HR_MODULE_KEYS = (
    "strategy_decode",   # 战略解码
    "hr_planning",       # 人资规划
    "recruitment",       # 招聘配置
    "training_dev",      # 培训开发
    "compensation",      # 薪酬福利
    "performance",       # 绩效管理
    "employee_relations", # 员工关系
    "corp_culture",      # 企业文化
)

DOC_TYPES = ("tool", "system")  # 工具库文档 / 体系库文档
DOC_STATUSES = ("draft", "generated", "archived")
BUILD_STATUSES = ("in_progress", "completed", "draft")


class OfficeDocument(TimestampMixin, Base):
    """智能办公文档主表。由工具库或体系库生成，可归档到知识库。"""

    __tablename__ = "office_document"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    title: Mapped[str] = mapped_column(String(512))
    module_key: Mapped[str | None] = mapped_column(String(64), index=True)  # HR八大模块key
    doc_type: Mapped[str] = mapped_column(String(16), default="tool")  # tool / system
    content_json: Mapped[dict | None] = mapped_column(PortableJSON())
    # 示例: {
    #   "document_title": "招聘JD模板",
    #   "sections": [{"heading": "...", "body": "..."}],
    #   "source_tags": ["私有库", "携君库"],
    #   "brand_logo_visible": True,
    # }
    status: Mapped[str] = mapped_column(String(16), default="draft", index=True)
    # draft → generated → archived
    version: Mapped[int] = mapped_column(Integer, default=1)
    regenerate_count: Mapped[int] = mapped_column(Integer, default=0)  # 免费重生成次数（最多3次）
    brand_logo_visible: Mapped[bool] = mapped_column(Boolean, default=True)  # 品牌标识是否可见
    kb_doc_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("document.id"))  # 归档后关联知识库文档
    archived_at: Mapped[str | None] = mapped_column(String(32))  # 归档时间


class SystemBuildState(TimestampMixin, Base):
    """体系搭建6步进度状态。每步的问答数据记录在 step_data_json 中。

    6步闭环：
      1. 战略输入 → 2. 战略萃取 → 3. 战略解码 →
      4. 人资规划 → 5. 模块搭建 → 6. 制度比对升级
    """

    __tablename__ = "system_build_state"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    title: Mapped[str | None] = mapped_column(String(512))  # 项目名称，如"2025年HR体系搭建"
    current_step: Mapped[int] = mapped_column(Integer, default=1)  # 1-6
    step_data_json: Mapped[dict | None] = mapped_column(PortableJSON())
    # 示例: {
    #   "1": {"question": "贵公司3-5年战略目标是什么？", "answer": "...", "completed": true},
    #   "2": {"question": "请提炼核心竞争力...", "answer": null, "completed": false},
    #   ...
    # }
    status: Mapped[str] = mapped_column(String(16), default="in_progress", index=True)
    # in_progress → completed → draft
    completed_at: Mapped[str | None] = mapped_column(String(32))  # 完成时间


class OfficeDraft(TimestampMixin, Base):
    """草稿箱。每步自动保存，保留30天后自动清理。"""

    __tablename__ = "office_draft"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    doc_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("office_document.id"), index=True)
    title: Mapped[str | None] = mapped_column(String(512))
    doc_type: Mapped[str | None] = mapped_column(String(16))  # tool / system
    module_key: Mapped[str | None] = mapped_column(String(64))  # HR八大模块key
    step_num: Mapped[int | None] = mapped_column(Integer)  # 当前步骤号（体系库1-6，工具库null）
    content_snapshot_json: Mapped[dict | None] = mapped_column(PortableJSON())
    # 保存时的内容快照，包括已填入的字段和生成的文本


class DocumentVersion(TimestampMixin, Base):
    """文档版本历史。每次重生成或编辑保存时记录版本。"""

    __tablename__ = "office_document_version"

    doc_id: Mapped[str] = mapped_column(GUID, ForeignKey("office_document.id"), index=True)
    version_num: Mapped[int] = mapped_column(Integer, default=1)
    content_json: Mapped[dict | None] = mapped_column(PortableJSON())
    created_by: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"))


class PolicyUpload(TimestampMixin, Base):
    """用户上传的现有制度文件。仅存储到私有库，不用于模型训练。"""

    __tablename__ = "policy_upload"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    doc_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("office_document.id"), index=True)
    original_filename: Mapped[str] = mapped_column(String(512))
    content_text: Mapped[str | None] = mapped_column(Text)
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, default=0)
    for_training: Mapped[bool] = mapped_column(Boolean, default=False)
    # 用户上传制度不用于模型训练，由隐私承诺保证
