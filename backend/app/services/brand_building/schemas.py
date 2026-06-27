"""品牌打造中心服务 — 请求/响应模型（步骤21 / Wave 4）。"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field


# ═══════ 品牌入驻引导 ═══════

class BrandOnboardingRequest(BaseModel):
    """首次品牌对话引导请求。"""
    accept_disclaimer: bool = Field(default=False, description="是否接受免责声明")
    industry: str | None = Field(None, description="所属行业")
    target_audience: str | None = Field(None, description="目标受众描述")
    personal_style: str | None = Field(None, description="个人风格偏好: professional/casual/inspirational/analytical")


class BrandOnboardingResponse(BaseModel):
    """品牌入驻引导结果。"""
    user_id: str
    onboarding_complete: bool
    disclaimer_confirmed: bool
    strategy_summary: str = ""


# ═══════ 内容源授权 ═══════

class ContentSourceAuth(BaseModel):
    """多源素材授权。"""
    sources: list[str] = Field(
        default_factory=lambda: ["knowledge_base"],
        description="授权数据源列表: knowledge_base/emotion_diary/smart_record/smart_qa"
    )
    growth_only: bool = Field(default=True, description="仅调取成长型复盘素材")
    exclude_negative: bool = Field(default=True, description="排除负面内容")
    confirm_desensitize: bool = Field(default=False, description="确认已脱敏的素材可以调取")


class ContentSourceAuthResponse(BaseModel):
    """授权结果。"""
    authorized_sources: list[str]
    growth_only: bool
    exclude_negative: bool


# ═══════ 四时段策略配置 ═══════

class TimeSlotConfig(BaseModel):
    """单时段配置。"""
    enabled: bool = True
    tone: str = "professional"  # professional/casual/inspirational/analytical
    topic_focus: str = ""  # 该时段的主题侧重点
    max_length: int = 500  # 最大字数


class ContentStrategyRequest(BaseModel):
    """四时段策略配置请求。"""
    time_slots: dict[str, TimeSlotConfig] = Field(
        default_factory=lambda: {
            "morning": TimeSlotConfig(tone="inspirational", topic_focus="行业洞察与趋势"),
            "noon": TimeSlotConfig(tone="casual", topic_focus="个人成长与转型故事"),
            "evening": TimeSlotConfig(tone="professional", topic_focus="专业知识分享"),
            "bedtime": TimeSlotConfig(tone="inspirational", topic_focus="复盘与明日行动计划"),
            "weekend": TimeSlotConfig(tone="casual", topic_focus="生活感悟与学习推荐"),
        }
    )
    image_style: str = Field(default="minimalist", description="配图风格: minimalist/professional/warm/tech")
    auto_generate: bool = Field(default=False, description="是否开启自动生成")


# ═══════ 朋友圈生成 ═══════

class MomentGenerateRequest(BaseModel):
    """朋友圈内容生成请求。"""
    time_slot: str = Field(default="morning", pattern="^(morning|noon|evening|bedtime|weekend)$")
    topic_hint: str | None = Field(None, description="主题提示（可选，留空则按策略自动选择）")
    include_image: bool = Field(default=True, description="是否包含配图")
    custom_style: str | None = Field(None, description="自定义文风覆盖")
    source_doc_ids: list[str] = Field(default_factory=list, description="指定引用的素材文档ID")


class MomentGenerateResponse(BaseModel):
    """朋友圈内容生成结果。"""
    content_id: str
    time_slot: str
    text: str
    hashtags: list[str] = []
    image_urls: list[str] = []
    image_style: str = "minimalist"
    source_materials: list[str] = []
    status: str = "draft"


# ═══════ 朋友圈确认 ═══════

class MomentConfirmRequest(BaseModel):
    """朋友圈确认/修改请求。"""
    content_id: str
    action: str = Field(default="confirm", pattern="^(confirm|modify|reject)$")
    modifications: dict | None = Field(None, description="修改内容: {text, hashtags, image_style}")
    regenerate_hint: str | None = Field(None, description="重新生成的提示")


# ═══════ 公众号文章生成 ═══════

class ArticleGenerateRequest(BaseModel):
    """公众号文章全流程生成请求。"""
    topic: str | None = Field(None, description="选题（留空则AI智能推荐选题）")
    outline: str | None = Field(None, description="大纲（留空则AI自动生成）")
    article_type: str = Field(default="knowledge_sharing", description="文章类型: knowledge_sharing/case_study/opinion_piece/story")
    length: str = Field(default="medium", pattern="^(short|medium|long)$", description="文章长度")
    include_images: bool = Field(default=True)
    source_doc_ids: list[str] = Field(default_factory=list)
    style_override: str | None = Field(None)


class ArticleResource(BaseModel):
    """公众号文章中的资源项。"""
    label: str
    url: str
    type: str = "link"  # link/file/image


class ArticleGenerateResponse(BaseModel):
    """公众号文章生成结果。"""
    content_id: str
    topic: str
    title: str
    outline: list[str] = []
    body: str = ""
    summary: str = ""
    cover_image_url: str = ""
    images: list[str] = []
    resources: list[ArticleResource] = []
    seo_keywords: list[str] = []
    estimated_read_time: int = 5
    status: str = "draft"
    source_materials: list[str] = []


# ═══════ 文章预览确认 ═══════

class ArticleConfirmRequest(BaseModel):
    """公众号文章预览确认请求。"""
    content_id: str
    action: str = Field(default="confirm", pattern="^(confirm|modify|reject)$")
    modifications: dict | None = Field(None, description="修改内容: {title, body, outline, images, cover_image_url}")
    regenerate_hint: str | None = Field(None)


# ═══════ 品牌数据分析 ═══════

class BrandAnalyticsResponse(BaseModel):
    """品牌数据分析看板响应。"""
    # 概览
    total_published: int = 0
    total_views: int = 0
    total_likes: int = 0
    total_shares: int = 0
    total_comments: int = 0
    total_leads: int = 0

    # 传播率
    engagement_rate: float = 0.0  # 互动率
    lead_conversion_rate: float = 0.0  # 线索转化率

    # 趋势数据（按日期）
    daily_trends: list[dict] = []

    # 内容排行
    top_content: list[dict] = []

    # 时段效果分析
    time_slot_performance: dict[str, dict] = {}


# ═══════ 勇气值 ═══════

class CourageMilestone(BaseModel):
    """勇气值里程碑。"""
    name: str
    description: str
    score_threshold: int
    reached: bool = False
    reached_at: str | None = None


class CourageValueResponse(BaseModel):
    """勇气值响应。"""
    total_score: int = 0
    level: str = ""  # 初级转型者/勇敢探索者/稳定输出者/品牌建设者/思想引领者
    dimension_scores: dict = {}
    milestones: list[CourageMilestone] = []
    recent_trend: list[int] = []  # 近7天分数趋势
    publish_count_7d: int = 0
    consecutive_no_publish_days: int = 0
    consecutive_interview_fails: int = 0
    care_message: str | None = None  # 干预关怀消息


# ═══════ 咨询线索标记 ═══════

class LeadMarkRequest(BaseModel):
    """咨询线索标记请求。"""
    source_content_id: str | None = Field(None, description="来源内容ID")
    lead_type: str = Field(default="consultation_inquiry", pattern="^(consultation_inquiry|content_interest|direct_message)$")
    source_description: str | None = Field(None)
    contact_name: str | None = Field(None)
    contact_info: str | None = Field(None)
    notes: str | None = Field(None)


class LeadMarkResponse(BaseModel):
    """线索标记结果。"""
    lead_id: str
    status: str
    created_at: str


# ═══════ 暂停/恢复自动生成 ═══════

class PauseResumeResponse(BaseModel):
    """暂停/恢复响应。"""
    user_id: str
    status: str
    message: str
