"""⑦数据仪表盘服务 — 请求/响应模型。"""
from __future__ import annotations

from pydantic import BaseModel, Field


class KpiResponse(BaseModel):
    """核心指标。"""
    completion_rate: float = 0.0  # 计划完成率
    sop_count: int = 0
    streak_days: int = 0  # 连续使用天数
    emotion_score: float = 0.0  # 平均情绪分 [-10, +10]
    total_recordings: int = 0
    total_docs: int = 0
    courage_value: int = 0


class TrendPoint(BaseModel):
    """趋势数据点。"""
    label: str
    value: float


class TrendResponse(BaseModel):
    """趋势响应。"""
    points: list[TrendPoint]
    metric_type: str
    period: str


class DistributionItem(BaseModel):
    """分布项。"""
    name: str
    value: float
    percentage: float | None = None


class DistributionResponse(BaseModel):
    """分布响应。"""
    items: list[DistributionItem]
    dimension: str
    total: float


class ComparisonResponse(BaseModel):
    """双时段对比。"""
    current: list[TrendPoint]
    previous: list[TrendPoint]
    delta_pct: float | None = None


class SopWeeklyItem(BaseModel):
    """每周SOP产量项。"""
    week_start: str
    count: int
    avg_quality_score: float | None = None


class SopWeeklyResponse(BaseModel):
    """每周SOP响应。"""
    weeks: list[SopWeeklyItem]


class EmotionResponse(BaseModel):
    """情绪分析响应。"""
    score: float
    label: str = "平静"
    ai_analysis: str | None = None
    self_reported: int | None = None
    weekly_trend: list[TrendPoint] = []


class AlertItem(BaseModel):
    """预警项。"""
    level: str = "info"  # info/warning/critical
    title: str
    message: str
    module: str | None = None


class RecommendationItem(BaseModel):
    """推荐服务项。"""
    title: str
    description: str
    icon: str | None = None
    action_label: str | None = None
    action_url: str | None = None


class CompositionItem(BaseModel):
    """指标构成项。"""
    name: str
    value: float
    color: str | None = None


class DiagnosisResponse(BaseModel):
    """双向诊断响应（步骤13核心）。"""
    type: str = "encouraging"  # positive / encouraging / caring
    message: str  # 诊断主文案
    tone: str = "supportive"  # celebratory / supportive / gentle
    emoji: str = "🌿"
    completion_rate: float = 0.0
    sop_count: int = 0
    streak_days: int = 0
    suggestion: str | None = None  # 行动建议


# ═══════════════════════════════════════════════════════════
# Step 25 / Wave 5 — 全量扩展模型
# ═══════════════════════════════════════════════════════════

class ModuleMetric(BaseModel):
    """单模块指标（11模块全景仪表盘）。"""
    module_key: str  # M1 ~ M11
    module_name: str
    completion_rate: float = 0.0
    total_items: int = 0
    completed_items: int = 0
    trend: str = "stable"  # up / down / stable
    trend_pct: float = 0.0


class FullDashboardResponse(BaseModel):
    """11模块全景仪表盘响应。"""
    modules: list[ModuleMetric]
    overall_completion_rate: float = 0.0
    overall_trend: str = "stable"
    updated_at: str  # ISO datetime


class DrilldownNode(BaseModel):
    """下钻节点（带面包屑导航）。"""
    level: int = 1  # 1=大盘, 2=模块, 3=日明细(源头)
    label: str
    value: float
    children: list["DrilldownNode"] = []
    breadcrumb: list[str] = []
    source_data: dict | None = None  # level 3 的源头数据


class DrilldownResponse(BaseModel):
    """三级下钻响应。"""
    metric_key: str
    root: DrilldownNode
    current_level: int
    response_ms: float = 0.0


class EmotionIndexResponse(BaseModel):
    """情绪健康指数（-10 ~ +10）。"""
    score: float  # -10.0 ~ +10.0
    trend: str  # improving / stable / declining
    trend_delta: float = 0.0  # 较上周变化
    user_confirmed: bool = False
    last_updated: str  # ISO datetime
    weekly_avg: float = 0.0
    monthly_avg: float = 0.0
    label: str = "平静"


class EmotionScoreRequest(BaseModel):
    """用户每日自评情绪。"""
    score: int = Field(..., ge=-10, le=10)
    note: str | None = Field(None, max_length=500)


class EmotionScoreSubmitResponse(BaseModel):
    """情绪自评提交结果。"""
    score: int
    recorded_at: str
    is_first_today: bool = True


class EmotionAppealRequest(BaseModel):
    """用户申诉系统计算的评分。"""
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    corrected_score: int = Field(..., ge=-10, le=10)
    reason: str | None = Field(None, max_length=500)


class EmotionAppealResponse(BaseModel):
    """申诉结果。"""
    original_score: int
    corrected_score: int
    is_accepted: bool
    appeal_count_this_month: int
    max_appeal_pct: float = 20.0  # 修正率阈值


class EmotionCurveResponse(BaseModel):
    """情绪曲线响应。"""
    period: str  # daily / weekly / monthly / yearly
    points: list[TrendPoint]
    avg_score: float
    high_point: TrendPoint | None = None
    low_point: TrendPoint | None = None


class CareTriggerRequest(BaseModel):
    """关怀触发请求。"""
    target_user_id: str | None = None  # None = 当前用户


class CareTriggerResponse(BaseModel):
    """关怀触发结果。"""
    triggered: bool
    trigger_type: str  # positive / negative
    conditions_met: list[str] = []
    message: str | None = None
    message_sent: bool = False
    blocked_reason: str | None = None


class CarePushLogItem(BaseModel):
    """关怀推送日志条目。"""
    id: str
    type: str  # positive / negative
    trigger_condition: str
    message: str | None = None
    pushed_at: str
    was_intercepted: bool = False
    intercepted_reason: str | None = None


class CarePushLogResponse(BaseModel):
    """关怀推送历史。"""
    items: list[CarePushLogItem]
    total: int
    weekly_used: int
    weekly_limit: int = 5


class PushQuotaResponse(BaseModel):
    """推送配额信息。"""
    weekly_used: int
    weekly_limit: int = 5
    remaining: int
    can_push: bool
    next_reset: str  # 下周一 00:00


class CareModeToggleRequest(BaseModel):
    """关怀模式切换请求。"""
    mode: str = Field(..., pattern=r"^(active|passive)$")


class CareModeToggleResponse(BaseModel):
    """关怀模式切换结果。"""
    mode: str
    previous_mode: str
    changed_at: str


class TeacherBridgeRequest(BaseModel):
    """老师架桥匹配请求。"""
    industry: str | None = Field(None, max_length=64)
    problem_area: str | None = Field(None, max_length=128)
    urgency: str = Field("normal", pattern=r"^(normal|urgent)$")


class TeacherBridgeResponse(BaseModel):
    """架桥匹配结果。"""
    matched: bool
    teacher_name: str | None = None
    teacher_title: str | None = None
    match_score: float = 0.0  # 0-100
    match_reasons: list[str] = []
    available_slots: list[dict] = []
    booking_url: str | None = None
    video_enabled: bool = True


class MobileSummaryResponse(BaseModel):
    """移动端摘要卡片。"""
    greeting: str
    completion_rate: float
    today_plan_count: int
    emotion_score: float
    streak_days: int
    main_insight: str
    quick_actions: list[dict] = []
    updated_at: str


class VoiceReportRequest(BaseModel):
    """语音播报请求。"""
    sections: list[str] = ["kpi", "emotion", "plan"]


class VoiceReportResponse(BaseModel):
    """语音播报脚本。"""
    script: str  # TTS-ready 文本
    ssml: str | None = None  # SSML 增强版
    duration_estimate: int = 30  # 预估秒数
    sections_included: list[str] = []
