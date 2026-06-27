"""打磨一套产品域 — ORM 模型（步骤23 / Wave 5）。

七张表：
- ProductProject: 产品方案项目主表（双路径准入：完整ABS / 产品预研）
- DiagnosisReport: 诊断报告（1.0系统诊断 / 2.0老师增强）
- QuantifiedTarget: B阶段量化目标指标
- SolutionVersion: A版/B版方案
- PreResearchProduct: 产品预研模式产出的通用产品
- SolutionReuseRecord: 跨客户方案复用记录
- CoachingRecord: 老师视频辅导预约记录

ABS模型驱动方案生成：
  A-现状诊断（标准化问卷→系统1.0→老师2.0）
  → B-目标设定（量化）
  → S-解决方案（三源调用→A/B双版）

绝对禁止跳过A→B直接做S。
"""
from __future__ import annotations

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import GUID, Base, PortableJSON, TimestampMixin

# ── 枚举常量 ──
ENTRY_TYPES = ("full_abs", "pre_research")
PROJECT_STATUSES = ("draft", "diagnosing", "targeting", "generating", "reviewing", "completed", "archived")
DIAGNOSIS_VERSIONS = ("1.0", "2.0")
DIAGNOSIS_STATUSES = ("pending", "generated", "enhanced", "confirmed")
SOLUTION_VERSION_LABELS = ("A", "B")
SOLUTION_STATUSES = ("draft", "generated", "selected", "exported")
TEMPLATE_TYPES = ("recruitment", "training", "compensation", "performance", "policy", "general")
COACHING_SESSION_NUMS = (2, 3, 4, 5)


class ProductProject(TimestampMixin, Base):
    """产品方案项目主表。每个项目对应一次完整的方案打磨流程。

    双路径准入：
    - full_abs: 完整ABS流程（有合同/服务清单 → 需求分解 → A诊断 → B目标 → S方案）
    - pre_research: 产品预研（无合同 → 模板化快速产出通用产品）
    """

    __tablename__ = "product_project"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    title: Mapped[str | None] = mapped_column(String(512))
    entry_type: Mapped[str] = mapped_column(String(32), default="full_abs")  # full_abs / pre_research
    contract_ref: Mapped[str | None] = mapped_column(String(256))  # 关联合同编号
    service_list_json: Mapped[dict | None] = mapped_column(PortableJSON())  # 服务清单

    # ABS阶段追踪
    current_phase: Mapped[str | None] = mapped_column(String(32), default="draft")  # draft/diagnosing/targeting/generating/reviewing/completed
    status: Mapped[str] = mapped_column(String(32), default="draft", index=True)

    # 需求分解结果
    hr_module_mapping_json: Mapped[dict | None] = mapped_column(PortableJSON())
    # 示例: {"招聘配置": ["岗位JD标准化", "面试流程优化"], "培训开发": ["新人入职培训体系"]}

    # 客户信息
    client_name: Mapped[str | None] = mapped_column(String(256))
    client_industry: Mapped[str | None] = mapped_column(String(128))

    # 数据隐私
    is_desensitized: Mapped[bool] = mapped_column(Boolean, default=False)
    not_for_training: Mapped[bool] = mapped_column(Boolean, default=True)

    # 报价一致性
    initial_quotation_json: Mapped[dict | None] = mapped_column(PortableJSON())
    final_quotation_json: Mapped[dict | None] = mapped_column(PortableJSON())

    notes: Mapped[str | None] = mapped_column(Text)


class DiagnosisReport(TimestampMixin, Base):
    """诊断报告表。支持1.0（系统生成）和2.0（老师增强）两个版本。

    A阶段：标准化诊断问卷 → 系统1.0报告 → 老师下载优化 → 2.0报告。
    诊断数据不完整时标注"因数据不足暂未评估"。
    """

    __tablename__ = "diagnosis_report"

    project_id: Mapped[str] = mapped_column(GUID, ForeignKey("product_project.id"), index=True)
    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)

    version: Mapped[str] = mapped_column(String(8), default="1.0")  # 1.0 / 2.0

    # 标准化问卷答案（原始提交）
    questionnaire_data_json: Mapped[dict | None] = mapped_column(PortableJSON())

    # 诊断报告内容
    report_json: Mapped[dict | None] = mapped_column(PortableJSON())
    # 结构示例: {
    #   "current_state": {"overview": "...", "modules": [...], "gaps": [...], "risks": [...]},
    #   "data_completeness": {"overall": "85%", "missing_fields": [...], "notes": "因数据不足暂未评估: ..."},
    #   "strengths": [...], "weaknesses": [...],
    #   "recommendations": [...]
    # }

    teacher_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("teacher_profile.id"))
    teacher_notes: Mapped[str | None] = mapped_column(Text)
    teacher_enhanced_at: Mapped[str | None] = mapped_column(String(64))  # ISO datetime

    status: Mapped[str] = mapped_column(String(32), default="pending")  # pending/generated/enhanced/confirmed

    parent_report_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("diagnosis_report.id"))
    # 1.0的parent为None，2.0的parent指向1.0


class QuantifiedTarget(TimestampMixin, Base):
    """B阶段量化目标。当前状态X → 目标状态Y，量化每一项指标。

    例: "员工流失率" current=18% target=<10% unit=%
    """

    __tablename__ = "quantified_target"

    project_id: Mapped[str] = mapped_column(GUID, ForeignKey("product_project.id"), index=True)
    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)

    metric_name: Mapped[str] = mapped_column(String(256))  # 指标名称
    metric_category: Mapped[str | None] = mapped_column(String(64))  # 指标分类（人力/财务/运营/...）
    current_value: Mapped[str | None] = mapped_column(String(128))  # 当前值（字符串以支持"约15%"等）
    target_value: Mapped[str] = mapped_column(String(128))  # 目标值
    unit: Mapped[str | None] = mapped_column(String(32))  # 单位（% / 人 / 天 / 万元 ...）

    baseline_source: Mapped[str | None] = mapped_column(Text)  # 基线数据来源说明
    target_rationale: Mapped[str | None] = mapped_column(Text)  # 目标设定的理由/依据

    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class SolutionVersion(TimestampMixin, Base):
    """A版/B版方案表。方案版本命名仅A/B，绝对禁止"基础版/标准版/高级版"。

    S阶段：三源调用（携君库+私有库+智能办公）→ gap分析 → A版/B版方案。
    制度升级可追溯：标注"本方案参照了原XX制度第X条升级..."。
    """

    __tablename__ = "solution_version"

    project_id: Mapped[str] = mapped_column(GUID, ForeignKey("product_project.id"), index=True)
    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)

    version_label: Mapped[str] = mapped_column(String(8))  # A / B
    # 命名规则：仅A版/B版，绝对禁止"基础版/标准版/高级版"

    # 方案内容
    content_json: Mapped[dict | None] = mapped_column(PortableJSON())
    # 结构示例: {
    #   "overview": "...",
    #   "sections": [
    #     {"title": "...", "content": "...", "upgrade_annotation": "本方案参照了原XX制度第X条升级..."}
    #   ],
    #   "implementation_plan": {...},
    #   "risk_mitigation": [...],
    #   "cost_estimate": {...}
    # }

    # 三源调用记录
    source_calls_json: Mapped[dict | None] = mapped_column(PortableJSON())
    # {"xiejun_library": {"query": "...", "results": 5, "used": [...]},
    #  "private_library": {"query": "...", "results": 3, "used": [...]},
    #  "smart_office": {"query": "...", "results": 2, "used": [...]}}

    # gap分析结果
    gap_analysis_json: Mapped[dict | None] = mapped_column(PortableJSON())

    # 版本差异说明（A版 vs B版的区别）
    version_diff_summary: Mapped[str | None] = mapped_column(Text)

    status: Mapped[str] = mapped_column(String(32), default="draft")  # draft/generated/selected/exported

    # 被选中为最终版本
    is_selected: Mapped[bool] = mapped_column(Boolean, default=False)

    # 导出信息
    export_format: Mapped[str | None] = mapped_column(String(16))  # pdf / word
    export_file_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("file_object.id"))

    # 采纳的老师ID（联合确认）
    selected_by_teacher_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("teacher_profile.id"))


class PreResearchProduct(TimestampMixin, Base):
    """产品预研模式产出的通用产品（无合同 → 模板化快速产出）。"""

    __tablename__ = "pre_research_product"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)

    template_type: Mapped[str] = mapped_column(String(32))  # recruitment/training/compensation/performance/policy/general
    product_name: Mapped[str] = mapped_column(String(512))
    description: Mapped[str | None] = mapped_column(Text)

    content_json: Mapped[dict | None] = mapped_column(PortableJSON())
    # 基于模板填充的通用产品内容

    status: Mapped[str] = mapped_column(String(32), default="draft")  # draft/completed/archived

    # 如果后续关联到正式项目
    linked_project_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("product_project.id"))


class SolutionReuseRecord(TimestampMixin, Base):
    """跨客户方案复用记录。从客户A的方案框架适配到客户B。"""

    __tablename__ = "solution_reuse_record"

    source_solution_id: Mapped[str] = mapped_column(GUID, ForeignKey("solution_version.id"), index=True)
    target_project_id: Mapped[str] = mapped_column(GUID, ForeignKey("product_project.id"), index=True)
    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)

    # 适配后的框架
    adapted_framework_json: Mapped[dict | None] = mapped_column(PortableJSON())
    # {"mapped_sections": [...], "modified_sections": [...], "new_sections": [...]}

    adaptation_notes: Mapped[str | None] = mapped_column(Text)

    is_desensitized: Mapped[bool] = mapped_column(Boolean, default=True)
    # 复用必须脱敏（去除客户A的具体信息）


class CoachingRecord(TimestampMixin, Base):
    """老师视频辅导预约记录。通常2-5次辅导为一个完整周期。"""

    __tablename__ = "coaching_record"

    project_id: Mapped[str] = mapped_column(GUID, ForeignKey("product_project.id"), index=True)
    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    teacher_id: Mapped[str] = mapped_column(GUID, ForeignKey("teacher_profile.id"), index=True)

    session_num: Mapped[int] = mapped_column(Integer)  # 第几次辅导（1-5）
    total_sessions: Mapped[int] = mapped_column(Integer, default=3)  # 总辅导次数（2-5）

    scheduled_at: Mapped[str | None] = mapped_column(String(64))  # 预约时间 ISO datetime
    duration_minutes: Mapped[int | None] = mapped_column(Integer, default=60)  # 单次时长（分钟）

    meeting_link: Mapped[str | None] = mapped_column(String(512))  # 视频会议链接
    recording_url: Mapped[str | None] = mapped_column(String(512))  # 录制回放链接

    status: Mapped[str] = mapped_column(String(32), default="scheduled")  # scheduled/completed/cancelled/missed

    # 辅导纪要
    session_notes: Mapped[str | None] = mapped_column(Text)
    action_items_json: Mapped[dict | None] = mapped_column(PortableJSON())

    # 辅导主题
    focus_topics: Mapped[str | None] = mapped_column(Text)  # 逗号分隔的主题列表
