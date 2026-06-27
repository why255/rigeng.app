"""拿下一个客户服务 — 请求/响应模型（步骤22 / Wave 4）。

六步签约流程 + 角色转换模拟训练 的完整 Pydantic 模型。
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════
# 1. 智能转型触发
# ═══════════════════════════════════════════════

class TransitionTriggerRequest(BaseModel):
    """扫描对话中的转型信号请求。"""
    context_text: str = Field(..., description="对话上下文文本")
    conversation_id: str | None = Field(None, description="关联对话ID")


class TransitionTriggerResponse(BaseModel):
    """转型信号检测结果。"""
    detected: bool = False
    signal_type: str | None = None  # 意向咨询/岗位需求/薪资讨论等
    confidence: float = 0.0  # 0.0-1.0
    suggestion: str | None = None  # 温和引导文案
    guided_flow: str | None = None  # 建议进入的流程


# ═══════════════════════════════════════════════
# 2. 自我诊断
# ═══════════════════════════════════════════════

class SelfDiagnosisRequest(BaseModel):
    """开始自我诊断请求。"""
    resume_url: str | None = Field(None, description="简历文件URL")
    interview_mode: str = Field(default="guided", description="访谈模式：guided/free")


class InterviewQuestion(BaseModel):
    """引导访谈问题。"""
    question_id: str
    question: str
    category: str  # 经验背景/能力评估/职业规划/目标期望
    hint: str | None = None


class InterviewAnswer(BaseModel):
    """访谈答案提交。"""
    diagnosis_id: str
    question_id: str
    answer: str


class DiagnosisReport(BaseModel):
    """诊断报告。"""
    diagnosis_id: str
    user_summary: dict[str, Any]  # 用户背景摘要
    strengths: list[str]  # 优势
    gaps: list[str]  # 短板
    recommendations: list[str]  # 建议
    target_companies: list[str] = []  # 建议目标公司
    self_rating: dict[str, Any] | None = None  # 自我评估
    teacher_reviewed: bool = False


class SelfDiagnosisResponse(BaseModel):
    """自我诊断响应。"""
    diagnosis_id: str
    status: str
    resume_upload_url: str | None = None
    interview_questions: list[InterviewQuestion] = []
    report: DiagnosisReport | None = None


class DiagnosisReviewRequest(BaseModel):
    """老师审核诊断请求。"""
    diagnosis_id: str
    action: str = Field(..., pattern="^(confirm|reject)$")
    teacher_notes: str | None = None


# ═══════════════════════════════════════════════
# 3. 客户情报采集
# ═══════════════════════════════════════════════

class CompanyIntelRequest(BaseModel):
    """AI采集企业情报请求（老师后台）。"""
    company_name: str = Field(..., description="公司全称")
    company_aliases: list[str] = Field(default_factory=list, description="公司别名")
    user_id: str = Field(..., description="为哪个用户采集")


class CompanyIntelResponse(BaseModel):
    """企业情报响应。"""
    intel_id: str
    company_name: str
    status: str  # collected/reviewed/delivered
    intel_report: dict[str, Any] | None = None
    source_urls: list[str] = []
    source_types: list[str] = []  # 招聘网站/官网/公众号/天眼查/看准网/脉脉
    reviewed: bool = False
    delivered: bool = False


class IntelDeliverRequest(BaseModel):
    """交付情报给用户请求。"""
    intel_id: str


class IntelReviewRequest(BaseModel):
    """老师审核情报请求。"""
    intel_id: str
    action: str = Field(..., pattern="^(approve|reject|modify)$")
    teacher_notes: str | None = None
    modified_report: dict[str, Any] | None = None


# ═══════════════════════════════════════════════
# 4. 面谈策略
# ═══════════════════════════════════════════════

class MeetingStrategyRequest(BaseModel):
    """生成面谈策略请求。"""
    intel_id: str
    diagnosis_id: str | None = None
    meeting_type: str = Field(default="first_visit", description="面谈类型")


class StrategyOutlineItem(BaseModel):
    """策略提纲项。"""
    section_title: str
    talking_points: list[str] = []
    time_allocation: int = 5  # 建议时间分配（分钟）


class MeetingStrategyResponse(BaseModel):
    """面谈策略响应。"""
    strategy_id: str
    status: str
    goals: list[str] = []
    approach: str = ""
    key_points: list[str] = []
    risks: list[str] = []
    alternatives: list[str] = []
    outline: list[StrategyOutlineItem] = []
    teacher_approved: bool = False
    teacher_notes: str | None = None


class StrategyReviewRequest(BaseModel):
    """老师审核策略请求。"""
    strategy_id: str
    action: str = Field(..., pattern="^(approve|reject|modify)$")
    teacher_notes: str | None = None
    modified_strategy: dict[str, Any] | None = None


# ═══════════════════════════════════════════════
# 5. 客户面谈
# ═══════════════════════════════════════════════

class MeetingRecordRequest(BaseModel):
    """关联录音到面谈请求。"""
    strategy_id: str
    recording_id: str
    client_name: str | None = None
    client_position: str | None = None
    meeting_date: str | None = None
    round_num: int = Field(default=1, ge=1, le=10)


class MeetingItemAnalysis(BaseModel):
    """逐条达成率分析。"""
    item: str  # 策略目标项
    achieved: bool  # 是否达成
    rate: float = 0.0  # 达成程度 0.0-1.0
    comment: str = ""  # 分析评语


class MeetingAnalysisResponse(BaseModel):
    """面谈达成率分析响应。"""
    meeting_id: str
    achievement_rate: float = 0.0  # 总达成率 0.0-1.0
    item_analysis: list[MeetingItemAnalysis] = []
    highlights: list[str] = []  # 亮点
    improvements: list[str] = []  # 改进点
    review_sop: list[str] = []  # 复盘SOP步骤


class MeetingStartResponse(BaseModel):
    """开始面谈响应。"""
    meeting_id: str
    strategy_id: str
    recording_id: str
    round_num: int = 1
    status: str = "in_progress"


# ═══════════════════════════════════════════════
# 6. 多轮谈判
# ═══════════════════════════════════════════════

class NegotiationRoundResponse(BaseModel):
    """多轮谈判响应。"""
    meeting_id: str
    rounds: list[dict[str, Any]] = []  # 各轮详情
    current_round: int = 1
    total_rounds: int = 1
    overall_achievement_rate: float = 0.0


class NextRoundStrategyRequest(BaseModel):
    """下一轮策略生成请求。"""
    meeting_id: str
    focus_areas: list[str] = []  # 下一轮重点议题


class NextRoundStrategyResponse(BaseModel):
    """下一轮策略响应。"""
    meeting_id: str
    round_num: int
    strategy: dict[str, Any] = {}
    advice: str = ""


# ═══════════════════════════════════════════════
# 7. 角色转换模拟训练
# ═══════════════════════════════════════════════

class RoleplayStartRequest(BaseModel):
    """开始角色扮演训练请求。"""
    scenario_type: str = Field(
        default="custom",
        description="场景类型：cold_call/first_visit/objection_handling/closing/custom"
    )
    client_company: str | None = None
    client_position: str | None = None
    client_personality: str | None = None
    client_pain_points: list[str] = Field(default_factory=list)
    custom_context: str | None = None  # 自定义场景描述


class RoleplayResponse(BaseModel):
    """角色扮演响应。"""
    session_id: str
    scenario_type: str
    current_role: str  # client/expert/teacher
    client_profile: dict[str, Any] | None = None
    opening_message: str = ""  # 开场白（小耕作为客户的第一句话）
    dialogue: list[dict[str, Any]] = []
    session_status: str = "active"  # active/completed/scored


class RoleplayTurnRequest(BaseModel):
    """角色扮演回合请求（用户发言）。"""
    session_id: str
    user_message: str


class RoleplayTurnResponse(BaseModel):
    """角色扮演回合响应（小耕回复）。"""
    session_id: str
    role: str  # 当前角色：client/expert/teacher
    response_text: str
    dialogue_length: int


class RoleplayScoreResponse(BaseModel):
    """角色扮演评分响应（A+B双维度）。"""
    session_id: str
    # A维度：关键词命中率
    score_a: float = 0.0  # 0-100
    score_a_detail: dict[str, Any] = {}  # { total_keywords, hit_keywords, hit_rate, missed_keywords }
    # B维度：四维评分
    score_b: float = 0.0  # 0-100
    score_b_detail: dict[str, Any] = {}  # { completeness, logic, depth, relevance } 各0-25
    # 综合
    total_score: float = 0.0  # A*0.3 + B*0.7
    passed: bool = False  # >= 合格线
    pass_threshold: float = 80.0
    expert_feedback: str | None = None
    teacher_guidance: str | None = None
    improvement_suggestions: list[str] = []


class RoleplayRoleSwitchRequest(BaseModel):
    """切换角色请求。"""
    session_id: str
    target_role: str = Field(..., pattern="^(client|expert|teacher)$")


# ═══════════════════════════════════════════════
# 8. 签约 & 合规
# ═══════════════════════════════════════════════

class ContractUploadRequest(BaseModel):
    """上传签约合同请求。"""
    meeting_id: str | None = None
    contract_url: str = Field(..., description="合同文件URL")
    contract_title: str | None = None
    contract_amount: str | None = None
    client_company: str | None = None
    service_list: list[dict[str, Any]] = Field(default_factory=list)


class ContractUploadResponse(BaseModel):
    """签约合同上传响应。"""
    contract_id: str
    meeting_id: str | None = None
    contract_url: str
    status: str = "uploaded"
    synced_to_product: bool = False
    product_doc_id: str | None = None


class ComplianceReminderResponse(BaseModel):
    """合规提示响应。"""
    user_id: str
    first_time: bool = True  # 是否为首次使用
    need_reminder: bool = True  # 是否需要弹出合规提示
    reminder_text: str = ""
    accepted: bool = False


class ProposalGenerateRequest(BaseModel):
    """生成提案框架请求。"""
    meeting_id: str
    proposal_type: str = Field(default="service_proposal", description="提案类型")
    custom_requirements: str | None = None


class ProposalGenerateResponse(BaseModel):
    """提案框架响应。"""
    proposal_id: str
    meeting_id: str
    title: str = ""
    sections: list[dict[str, Any]] = []
    key_services: list[dict[str, Any]] = []
    estimated_budget: str = ""
    next_steps: list[str] = []


# ═══════════════════════════════════════════════
# 通用分页/列表
# ═══════════════════════════════════════════════

class DiagnosisListItem(BaseModel):
    """诊断列表项。"""
    id: str
    status: str
    created_at: str = ""
    company_focus: str | None = None
    teacher_reviewed: bool = False


class IntelListItem(BaseModel):
    """情报列表项。"""
    id: str
    company_name: str
    industry: str | None = None
    status: str
    created_at: str = ""


class MeetingListItem(BaseModel):
    """面谈列表项。"""
    id: str
    client_name: str | None = None
    round_num: int = 1
    achievement_rate: float = 0.0
    status: str
    meeting_date: str | None = None


class RoleplayListItem(BaseModel):
    """角色扮演列表项。"""
    id: str
    scenario_type: str
    total_score: float | None = None
    passed: bool = False
    created_at: str = ""
