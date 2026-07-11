"""高维求职服务 — 请求/响应模型（步骤20 / Wave 4）。

五步法全流程：
  一盘（简历盘点与重构）→ 二定（求职策略与资源）→ 三投（投递追踪与分析）
  → 四面（面试准备与复盘）→ 五选（Offer评估与入职）
"""
from __future__ import annotations

from pydantic import BaseModel, Field


# ═══════ 一盘：简历盘点与重构 ═══════

class ResumeUploadRequest(BaseModel):
    """简历上传请求。"""
    title: str = Field(default="我的简历", min_length=1, max_length=255)
    content: str = Field(default="", description="简历原始文本内容")
    file_object_id: str | None = None


class ResumeUploadResponse(BaseModel):
    """简历上传结果。"""
    career_progress_id: str
    current_step: int = 1
    message: str = "简历已接收，请开始STAR萃取"


class ResumeFileUploadResponse(BaseModel):
    """简历文件上传+AI解析结果。"""
    career_progress_id: str
    filename: str
    text_preview: str = ""  # 前500字预览
    text_length: int = 0
    parsed_summary: str = ""  # AI解析摘要
    key_skills: list[str] = []  # 提取的技能
    key_experiences: list[str] = []  # 提取的工作经历
    suggested_next: str = "erding"  # 建议下一步: erding(二定/策略)


class STARExtractionRequest(BaseModel):
    """STAR萃取请求——引导用户补充四要素。"""
    career_progress_id: str
    situation: str | None = None   # 情境
    task: str | None = None        # 任务
    action: str | None = None      # 行动
    result: str | None = None      # 结果
    quantified_value: str | None = None  # 量化成果
    source_type: str = "resume"    # resume / interview / manual


class STARExtractionResponse(BaseModel):
    """STAR萃取结果。"""
    extraction_id: str
    situation: str
    task: str
    action: str
    result: str
    quantified_value: str
    completeness: float  # 0.0-1.0，要求≥0.85
    missing_fields: list[str] = []  # 不完整的字段名列表
    is_complete: bool = False


# ═══════ 技能晶体 ═══════

class SkillCrystalRequest(BaseModel):
    """生成技能晶体请求。"""
    star_extraction_id: str


class SkillCrystalResponse(BaseModel):
    """技能晶体——STAR升级为结构化SOP。"""
    crystal_id: str
    what: str        # 做什么
    how: str         # 怎么做
    notes: str       # 注意事项
    outcome: str     # 成果
    reusable_sop: str  # 可复用SOP
    source_step: int = 1
    tags: list[str] = []


class SkillCrystalListItem(BaseModel):
    """技能晶体列表项。"""
    id: str
    what: str
    source_step: int
    tags: list[str]
    archived_to_kb: bool
    created_at: str


# ═══════ 二定：求职策略与资源 ═══════

class JobStrategyRequest(BaseModel):
    """求职策略请求。"""
    career_progress_id: str
    target_industry: str | None = None
    target_position: str | None = None
    salary_range: str | None = None
    location: str | None = None
    preferences: str | None = None  # 用户偏好描述


class JobStrategyResponse(BaseModel):
    """求职策略——资源清单+求职计划表。"""
    strategy_id: str
    resource_inventory: dict  # 资源清单：{ skills, experiences, network, certifications, ... }
    plan: dict  # 求职计划表：{ weekly_goals, channel_strategy, timeline }
    target_summary: str  # 目标摘要
    tips: str  # 策略提示


# ═══════ 三投：投递追踪与分析 ═══════

class ApplicationTrackingRequest(BaseModel):
    """投递追踪请求。"""
    career_progress_id: str
    channel: str = ""        # 投递渠道
    position: str = ""       # 目标岗位
    company: str = ""        # 公司名称
    date: str = ""           # 投递日期 (YYYY-MM-DD)
    status: str = "applied"  # applied / screening / interview / offer / rejected / withdrawn
    invite_received: bool = False
    notes: str | None = None


class ApplicationTrackingResponse(BaseModel):
    """投递追踪结果。"""
    application_id: str
    channel: str
    position: str
    company: str
    date: str
    status: str
    invite_received: bool


class ApplicationStatsResponse(BaseModel):
    """投递统计。"""
    total: int = 0
    by_status: dict = {}
    invite_rate: float = 0.0  # 邀约率 = 收到邀约数 / 总投递数
    invite_count: int = 0


class ApplicationListItem(BaseModel):
    """投递列表项。"""
    id: str
    channel: str
    position: str
    company: str
    date: str
    status: str
    status_label: str
    invite_received: bool


# ═══════ 四面：面试准备与复盘 ═══════

class InterviewPrepRequest(BaseModel):
    """面试准备请求。"""
    career_progress_id: str
    application_id: str | None = None
    company: str = ""
    position: str = ""
    interview_stage: str | None = None  # 初面/技术面/HR面/终面


class InterviewPrepResponse(BaseModel):
    """面试准备结果——企业情报+匹配度分析+面试策略+问题清单。"""
    prep_id: str
    company_intel: dict  # 企业情报
    match_analysis: str  # 匹配度分析
    strategy_doc: str    # 面试策略
    question_list: list[dict]  # 问题清单
    warm_up_questions: list[dict]  # 暖场问题


class InterviewRecordingLinkRequest(BaseModel):
    """关联录音到求职面试请求。"""
    prep_id: str
    recording_id: str  # 来自智能记录的录音ID


class InterviewRecordingLinkResponse(BaseModel):
    """录音关联结果。"""
    review_id: str
    prep_id: str
    recording_id: str
    status: str = "linked"
    message: str = "录音已关联，可进行面试复盘分析"


class InterviewReviewResponse(BaseModel):
    """面试复盘结果——亮点/改进/复盘SOP。"""
    review_id: str
    prep_id: str
    highlights: str     # 亮点
    improvements: str   # 改进方向
    review_sop: str     # 复盘SOP
    overall_rating: int = 0  # 1-5 总体评分


class InterviewPrepListItem(BaseModel):
    """面试准备列表项。"""
    id: str
    company: str
    position: str
    has_review: bool
    created_at: str


# ═══════ 五选：Offer评估与入职 ═══════

class OfferItem(BaseModel):
    """单个Offer信息。"""
    offer_label: str = ""  # 如 "Offer A"
    company: str = ""
    salary: str = ""       # 如 "25K * 14薪"
    level: str = ""        # 职级
    growth: str = ""       # 发展空间评估
    commute: str = ""      # 通勤
    culture: str = ""      # 文化匹配
    stability: str = ""    # 稳定性


class OfferComparisonRequest(BaseModel):
    """Offer对比请求。"""
    career_progress_id: str
    offers: list[OfferItem]
    notes: str | None = None


class OfferComparisonResponse(BaseModel):
    """Offer对比结果——多维度陈列，不替用户做决策。"""
    comparison_id: str
    offers: list[dict]
    dimension_analysis: dict  # 各维度分析
    tips: str  # 决策建议（通用原则，不指向具体Offer）


class OfferAcceptRequest(BaseModel):
    """接受Offer请求——触发试用期计划生成。"""
    comparison_id: str
    selected_offer_label: str


class ProbationPlanResponse(BaseModel):
    """试用期30/60/90天计划。"""
    plan_id: str
    offer_label: str
    company: str
    position: str
    milestones: dict  # { day_30: [...], day_60: [...], day_90: [...] }
    overall_goal: str


# ═══════ 企业情报（老师后台） ═══════

class CompanyIntelRequest(BaseModel):
    """企业情报采编请求。"""
    company_name: str
    user_id: str | None = None  # 关联的用户（可选）


class CompanyIntelResponse(BaseModel):
    """企业情报结果——AI初稿+公开信息源。"""
    intel_id: str
    company_name: str
    intel_report: dict  # 结构化情报
    source_urls: list[str]
    teacher_verified: bool = False
    generation_time_ms: int = 0


# ═══════ 五步法进度 ═══════

class FiveStepProgressResponse(BaseModel):
    """五步法整体进度。"""
    career_progress_id: str
    current_step: int  # 1-5
    step_labels: dict = {
        1: "一盘·简历盘点与重构",
        2: "二定·求职策略与资源",
        3: "三投·投递追踪与分析",
        4: "四面·面试准备与复盘",
        5: "五选·Offer评估与入职",
    }
    status: str  # active / paused / completed
    teacher_assigned: bool = False
    step_details: dict = {}  # 各步骤的详细信息


# ── AI 高维求职对话 ──

class CareerChatIn(BaseModel):
    """高维求职 AI 对话请求 — 所有小耕回复由AI模型生成。"""
    message: str = Field(default="", max_length=4096, description="用户当前消息（初始问候可为空）")
    step: str = Field(default="yipan", description="当前步骤: yipan|erding|santou|simian|wuxuan")
    context: list[dict] = Field(default_factory=list, description="对话历史 [{role, text}]")
    sub_index: int = Field(default=0, description="一盘子进度 0-4（履历梳理/STAR追问/技能晶体/人脉资源/岗位建议）")
    has_resume: bool = Field(default=False, description="是否已上传简历")
