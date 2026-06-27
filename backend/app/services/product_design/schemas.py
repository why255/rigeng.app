"""打磨一套产品服务 — 请求/响应模型（步骤23 / Wave 5）。"""
from __future__ import annotations

from pydantic import BaseModel, Field


# ═══════ 双路径准入 ═══════

class ProductEntryRequest(BaseModel):
    """选择产品方案入口路径。"""
    entry_type: str = Field(pattern="^(full_abs|pre_research)$")
    title: str | None = None
    contract_ref: str | None = None  # full_abs模式需要
    client_name: str | None = None
    client_industry: str | None = None


class ProductEntryResponse(BaseModel):
    """入口选择结果。"""
    project_id: str
    entry_type: str
    current_phase: str = "draft"
    status: str = "draft"


# ═══════ 需求分解（上游数据接入） ═══════

class DemandAnalysisRequest(BaseModel):
    """上游数据接入：合同+服务清单 → 自动分解 → HR模块映射。"""
    project_id: str
    contract_text: str | None = None  # 合同文本或摘要
    service_items: list[str] = []  # 服务清单列表


class HRModuleMapping(BaseModel):
    """单个HR模块的分解结果。"""
    module_name: str  # 如"招聘配置"
    extracted_items: list[str] = []  # 从合同中提取的相关条款
    related_services: list[str] = []  # 对应的服务项


class DemandAnalysisResponse(BaseModel):
    """需求分解结果。"""
    project_id: str
    hr_modules: list[HRModuleMapping] = []
    unmapped_items: list[str] = []  # 未能自动映射的条目
    summary: str = ""


# ═══════ A阶段：诊断 ═══════

class DiagnosticQuestionnaireRequest(BaseModel):
    """标准化诊断问卷答案。"""
    project_id: str
    answers: list[DiagnosticAnswer] = []


class DiagnosticAnswer(BaseModel):
    """单个诊断问题及答案。"""
    question_id: str
    question_text: str = ""
    category: str = ""  # 人力规划/招聘配置/培训开发/绩效管理/薪酬福利/员工关系
    answer: str = ""
    score: int | None = None  # 1-5评分（如有）
    evidence: str | None = None  # 支撑证据/附件链接


class DiagnosisReportResponse(BaseModel):
    """诊断报告（1.0系统版 或 2.0老师增强版）。"""
    report_id: str
    project_id: str
    version: str  # "1.0" / "2.0"
    status: str
    current_state: dict = {}
    data_completeness: dict = {}
    strengths: list[str] = []
    weaknesses: list[str] = []
    gaps: list[dict] = []
    recommendations: list[dict] = []
    teacher_notes: str | None = None
    teacher_id: str | None = None


class TeacherEnhanceRequest(BaseModel):
    """老师增强诊断请求（下载1.0 → 优化 → 产出2.0）。"""
    report_id: str  # 1.0报告的ID
    teacher_notes: str | None = None
    enhanced_sections: list[EnhancedSection] = []


class EnhancedSection(BaseModel):
    """老师增强的诊断段落。"""
    section_key: str  # 对应的报告段落key
    original_content: str = ""
    enhanced_content: str = ""
    reason: str = ""  # 优化理由


# ═══════ B阶段：目标设定量化 ═══════

class TargetSettingRequest(BaseModel):
    """B阶段量化目标设定。"""
    project_id: str
    targets: list[TargetMetric] = []


class TargetMetric(BaseModel):
    """单项目标指标。"""
    metric_name: str
    metric_category: str | None = None
    current_value: str  # "约15%" / "300人" / "60天"
    target_value: str
    unit: str  # % / 人 / 天 / 万元
    baseline_source: str | None = None
    target_rationale: str | None = None


class TargetSettingResponse(BaseModel):
    """目标设定结果。"""
    project_id: str
    targets: list[TargetMetric] = []
    summary: str = ""


# ═══════ S阶段：方案生成 ═══════

class SolutionGenerateRequest(BaseModel):
    """S阶段方案生成请求（三源调用）。"""
    project_id: str
    # 可指定偏好的知识源
    source_engines: list[str] | None = None  # ["xiejun", "private", "smart_office"]
    # 可指定重点方向
    focus_areas: list[str] | None = None
    # 是否需要生成A/B双版（默认True）
    generate_both_versions: bool = True


class SolutionVersionResponse(BaseModel):
    """A版/B版方案响应。"""
    solution_id: str
    project_id: str
    version_label: str  # "A" / "B"
    status: str
    content: dict = {}
    source_calls: dict = {}
    gap_analysis: dict = {}
    version_diff_summary: str | None = None
    is_selected: bool = False


class VersionSelectRequest(BaseModel):
    """选择最终版本。"""
    project_id: str
    solution_id: str  # 选中的A版或B版ID
    selected_by_teacher_id: str | None = None


class VersionSelectResponse(BaseModel):
    """版本选择结果。"""
    project_id: str
    selected_solution_id: str
    selected_version: str  # "A" / "B"


# ═══════ 方案导出 ═══════

class SolutionExportRequest(BaseModel):
    """方案格式化导出请求。"""
    solution_id: str
    export_format: str = Field(pattern="^(pdf|word)$")
    include_brand_watermark: bool = True
    include_upgrade_annotations: bool = True


class SolutionExportResponse(BaseModel):
    """导出结果。"""
    solution_id: str
    export_format: str
    download_url: str = ""
    file_id: str = ""


# ═══════ 产品预研 ═══════

class ProductPreResearchRequest(BaseModel):
    """产品预研模式请求（无合同 → 模板化快速产出）。"""
    template_type: str = Field(pattern="^(recruitment|training|compensation|performance|policy|general)$")
    product_name: str
    description: str | None = None
    reference_materials: list[str] | None = None  # 参考材料的key或描述


class ProductPreResearchResponse(BaseModel):
    """产品预研产出。"""
    product_id: str
    template_type: str
    product_name: str
    status: str
    content: dict = {}
    can_upgrade_to_full: bool = True  # 可升级为完整ABS项目


# ═══════ 跨客户方案复用 ═══════

class SolutionReuseRequest(BaseModel):
    """跨客户方案复用请求。"""
    source_solution_id: str  # 客户A的方案版本ID
    target_project_id: str  # 客户B的项目ID
    sections_to_reuse: list[str] | None = None  # 指定复用的段落，None=全框架
    adaptation_notes: str | None = None


class SolutionReuseResponse(BaseModel):
    """方案复用结果。"""
    reuse_record_id: str
    source_solution_id: str
    target_project_id: str
    adapted_framework: dict = {}
    is_desensitized: bool = True


# ═══════ 老师辅导预约 ═══════

class CoachingSessionRequest(BaseModel):
    """老师视频辅导预约请求。"""
    project_id: str
    teacher_id: str
    total_sessions: int = Field(ge=2, le=5, default=3)
    scheduled_at: str  # 首次辅导时间 ISO datetime
    duration_minutes: int = 60
    focus_topics: str | None = None  # 辅导重点主题


class CoachingSessionResponse(BaseModel):
    """辅导预约结果。"""
    coaching_id: str
    project_id: str
    teacher_id: str
    session_num: int = 1
    total_sessions: int
    scheduled_at: str
    meeting_link: str = ""
    status: str = "scheduled"
