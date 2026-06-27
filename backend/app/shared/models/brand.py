"""品牌打造中心域 — ORM 模型（步骤21 / Wave 4）。

五张表：
- BrandProfile: 用户品牌配置（授权源/策略偏好/状态）
- BrandContent: 品牌内容（朋友圈/公众号）
- BrandAnalytics: 传播数据（阅读/点赞/转发/咨询触发）
- BrandCourageValue: 品牌勇气值（总分/里程碑/干预记录）
- BrandLead: 咨询线索（标记→流转至拿下一个客户）
"""
from __future__ import annotations

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from ..database import GUID, Base, PortableJSON, TimestampMixin

# ── 枚举常量 ──
BRAND_STATUSES = ("active", "paused")
CONTENT_TYPES = ("moment", "article")
MOMENT_TIME_SLOTS = ("morning", "noon", "evening", "bedtime", "weekend")
ARTICLE_STATUSES = ("draft", "preview", "confirmed", "published")
LEAD_TYPES = ("consultation_inquiry", "content_interest", "direct_message")
LEAD_STATUSES = ("marked", "converted")


class BrandProfile(TimestampMixin, Base):
    """用户品牌配置。记录授权数据源、四时段策略偏好、自动生成状态。"""

    __tablename__ = "brand_profile"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), unique=True, index=True)

    # 授权数据源（JSON数组: ["knowledge_base", "emotion_diary", ...]）
    authorized_sources_json: Mapped[dict | None] = mapped_column(PortableJSON())
    # 策略偏好（四时段配置 + 文风/配图风格等）
    strategy_prefs_json: Mapped[dict | None] = mapped_column(PortableJSON())
    # 状态: active / paused
    status: Mapped[str] = mapped_column(String(16), default="active", index=True)
    # 免责声明是否已确认
    disclaimer_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    disclaimer_confirmed_at: Mapped[str | None] = mapped_column(String(32))

    # 连续未确认天数（达到3天自动暂停）
    unconfirmed_days: Mapped[int] = mapped_column(Integer, default=0)
    # 上次确认时间
    last_confirmed_at: Mapped[str | None] = mapped_column(String(32))


class BrandContent(TimestampMixin, Base):
    """品牌内容。朋友圈文案/公众号文章，包含生成、确认、发布全生命周期。"""

    __tablename__ = "brand_content"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    content_type: Mapped[str] = mapped_column(String(16), index=True)  # moment / article
    # 朋友圈时段：morning / noon / evening / bedtime / weekend
    time_slot: Mapped[str | None] = mapped_column(String(16))
    # 关联话题/主题
    topic: Mapped[str | None] = mapped_column(String(255))

    # 内容JSON
    content_json: Mapped[dict | None] = mapped_column(PortableJSON())
    # 配图风格描述
    image_style: Mapped[str | None] = mapped_column(String(64))
    # 图片URL列表（JSON数组）
    image_urls_json: Mapped[dict | None] = mapped_column(PortableJSON())

    # 状态: draft / preview / confirmed / published
    status: Mapped[str] = mapped_column(String(16), default="draft", index=True)
    # 生成来源素材（引用的文档ID列表）
    source_doc_ids_json: Mapped[dict | None] = mapped_column(PortableJSON())

    # 发布相关
    published_at: Mapped[str | None] = mapped_column(String(32))
    scheduled_at: Mapped[str | None] = mapped_column(String(32))  # 定时发布
    preview_confirmed_at: Mapped[str | None] = mapped_column(String(32))
    # 修改历史
    revision_history_json: Mapped[dict | None] = mapped_column(PortableJSON())

    # 模型信息
    model_used: Mapped[str | None] = mapped_column(String(64))
    generation_cost_tokens: Mapped[int | None] = mapped_column(Integer, default=0)


class BrandAnalytics(TimestampMixin, Base):
    """品牌传播数据。每条内容对应一条分析记录，按日聚合。"""

    __tablename__ = "brand_analytics"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    content_id: Mapped[str] = mapped_column(GUID, ForeignKey("brand_content.id"), index=True)
    content_type: Mapped[str | None] = mapped_column(String(16))  # moment / article

    # 传播指标
    views: Mapped[int] = mapped_column(Integer, default=0)
    likes: Mapped[int] = mapped_column(Integer, default=0)
    shares: Mapped[int] = mapped_column(Integer, default=0)
    comments: Mapped[int] = mapped_column(Integer, default=0)

    # 转化指标
    consultation_triggered: Mapped[bool] = mapped_column(Boolean, default=False)
    lead_generated: Mapped[bool] = mapped_column(Boolean, default=False)

    # 统计日期
    stat_date: Mapped[str | None] = mapped_column(String(16), index=True)

    # 阅读画像（来源渠道等）
    audience_json: Mapped[dict | None] = mapped_column(PortableJSON())


class BrandCourageValue(TimestampMixin, Base):
    """品牌转型勇气值。追踪发布频率、面谈转化、里程碑达成等维度。"""

    __tablename__ = "brand_courage_value"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), unique=True, index=True)

    # 总分 (0-1000)
    total_score: Mapped[int] = mapped_column(Integer, default=0)

    # 分项得分（JSON: {publish_frequency, conversion_rate, consistency, growth}）
    dimension_scores_json: Mapped[dict | None] = mapped_column(PortableJSON())

    # 里程碑记录（JSON数组: [{name, reached_at, score_bonus}, ...]）
    milestones_json: Mapped[dict | None] = mapped_column(PortableJSON())

    # 干预记录（JSON数组: [{type, triggered_at, message, acknowledged}, ...]）
    interventions_json: Mapped[dict | None] = mapped_column(PortableJSON())

    # 连续未发布天数
    consecutive_no_publish_days: Mapped[int] = mapped_column(Integer, default=0)
    # 最近7天发布次数
    publish_count_7d: Mapped[int] = mapped_column(Integer, default=0)
    # 面谈连续失败次数
    consecutive_interview_fails: Mapped[int] = mapped_column(Integer, default=0)

    # 最后发布日期
    last_publish_date: Mapped[str | None] = mapped_column(String(16))
    # 上次关怀触发时间
    last_care_triggered_at: Mapped[str | None] = mapped_column(String(32))


class BrandLead(TimestampMixin, Base):
    """咨询线索。从品牌内容中标记，流转至拿下一个客户模块。"""

    __tablename__ = "brand_lead"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    source_content_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("brand_content.id"), index=True)

    # 线索类型: consultation_inquiry / content_interest / direct_message
    lead_type: Mapped[str] = mapped_column(String(32))
    # 线索来源描述
    source_description: Mapped[str | None] = mapped_column(Text)

    # 联系人信息
    contact_name: Mapped[str | None] = mapped_column(String(64))
    contact_info: Mapped[str | None] = mapped_column(String(128))

    # 状态: marked / converted
    status: Mapped[str] = mapped_column(String(16), default="marked", index=True)

    # 备注
    notes: Mapped[str | None] = mapped_column(Text)
    # 流转至客户模块的ID
    transferred_to_client_id: Mapped[str | None] = mapped_column(GUID)
