"""高维求职域 — ORM 模型（步骤20 / Wave 4）。

八张表，支撑五步法全流程：
  一盘（简历盘点与重构）→ 二定（求职策略与资源）→ 三投（投递追踪与分析）
  → 四面（面试准备与复盘）→ 五选（Offer评估与入职）

跨模块调用链：
  录音 → ③智能记录（面试录音链接）
  萃取 → ②知识库（技能晶体归档）
  企业情报 → ③AI引擎（公开信息采编）
"""
from __future__ import annotations

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import GUID, Base, PortableJSON, TimestampMixin

# ── 枚举常量 ──
FIVE_STEPS = (1, 2, 3, 4, 5)
CAREER_STATUS = ("active", "paused", "completed")
APPLICATION_STATUSES = ("applied", "screening", "interview", "offer", "rejected", "withdrawn")
OFFER_DIMENSIONS = ("salary", "level", "growth", "commute", "culture", "stability")


class CareerProgress(TimestampMixin, Base):
    """五步法进度主表。每个用户一条记录，追踪求职全流程。"""

    __tablename__ = "career_progress"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), unique=True, index=True)
    current_step: Mapped[int] = mapped_column(Integer, default=1)  # 1-5
    step_data_json: Mapped[dict | None] = mapped_column(PortableJSON())
    # step_data_json 示例: {
    #   "step1_resume": {...}, "step2_strategy": {...},
    #   "step3_applications": [...], "step4_interviews": [...], "step5_offers": [...]
    # }
    status: Mapped[str] = mapped_column(String(16), default="active", index=True)
    # active / paused / completed

    teacher_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("teacher_profile.id"), nullable=True)
    # 老师由后台手动分配，用户不可自选
    teacher_nda_signed: Mapped[bool] = mapped_column(Boolean, default=False)
    # 老师经保密协议后查看私有库只读权限


class STARExtraction(TimestampMixin, Base):
    """STAR四要素萃取结果。从简历/面试录音中结构化提取情境/任务/行动/结果。"""

    __tablename__ = "star_extraction"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    career_progress_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("career_progress.id"), index=True)

    # STAR 四要素
    situation: Mapped[str | None] = mapped_column(Text)   # 情境：当时的背景/上下文
    task: Mapped[str | None] = mapped_column(Text)         # 任务：你需要完成的目标
    action: Mapped[str | None] = mapped_column(Text)       # 行动：你具体做了什么
    result: Mapped[str | None] = mapped_column(Text)       # 结果：量化成果和影响

    quantified_value: Mapped[str | None] = mapped_column(String(255))
    # 量化成果简述，如"系统吞吐量提升3倍，响应时间降低60%"

    completeness: Mapped[float] = mapped_column(Float, default=0.0)
    # 四要素完整率 0.0-1.0，要求≥0.85

    source_type: Mapped[str | None] = mapped_column(String(32))  # resume / interview / manual
    source_id: Mapped[str | None] = mapped_column(GUID)

    # AI 萃取元信息
    model_used: Mapped[str | None] = mapped_column(String(64))
    extraction_cost_tokens: Mapped[int | None] = mapped_column(Integer, default=0)


class SkillCrystal(TimestampMixin, Base):
    """技能晶体。从STAR萃取升级为结构化SOP知识卡片。

    五要素：做什么 / 怎么做 / 注意事项 / 成果 / 可复用SOP
    可归档到私有知识库并跨模块复用。
    """

    __tablename__ = "skill_crystal"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    star_extraction_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("star_extraction.id"), index=True)

    # 技能晶体五要素
    what: Mapped[str | None] = mapped_column(Text)         # 做什么：技能名称和定义
    how: Mapped[str | None] = mapped_column(Text)          # 怎么做：操作步骤/方法论
    notes: Mapped[str | None] = mapped_column(Text)        # 注意事项：关键风险/边界
    outcome: Mapped[str | None] = mapped_column(Text)      # 成果：量化/定性成果
    reusable_sop: Mapped[str | None] = mapped_column(Text) # 可复用SOP：标准化流程

    source_step: Mapped[int | None] = mapped_column(Integer)  # 来源五步法步骤 (1-5)
    tags_json: Mapped[list | None] = mapped_column(PortableJSON())

    # AI 生成元信息
    model_used: Mapped[str | None] = mapped_column(String(64))
    generation_cost_tokens: Mapped[int | None] = mapped_column(Integer, default=0)

    # 归档状态
    archived_to_kb: Mapped[bool] = mapped_column(Boolean, default=False)
    kb_doc_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("document.id"), nullable=True)

    # 删除求职记录不影响已归档技能晶体——通过独立的 kb_doc_id 实现


class JobApplication(TimestampMixin, Base):
    """投递追踪记录。记录每一次求职投递的完整信息。"""

    __tablename__ = "job_application"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    career_progress_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("career_progress.id"), index=True)

    channel: Mapped[str | None] = mapped_column(String(128))   # 投递渠道：Boss直聘/猎聘/内推/官网...
    position: Mapped[str | None] = mapped_column(String(255))  # 目标岗位
    company: Mapped[str | None] = mapped_column(String(255))   # 公司名称
    date: Mapped[str | None] = mapped_column(String(32))       # 投递日期 ISO格式

    status: Mapped[str] = mapped_column(String(32), default="applied", index=True)
    # applied → screening → interview → offer → rejected / withdrawn

    invite_received: Mapped[bool] = mapped_column(Boolean, default=False)
    # 是否收到面试邀约——用于计算邀约率

    notes: Mapped[str | None] = mapped_column(Text)


class InterviewPrep(TimestampMixin, Base):
    """面试准备记录。企业情报采集 + 匹配度分析 + 面试策略 + 问题清单。"""

    __tablename__ = "interview_prep"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    career_progress_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("career_progress.id"), index=True)
    application_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("job_application.id"), index=True)

    company_intel_json: Mapped[dict | None] = mapped_column(PortableJSON())
    # 企业情报: { company_name, industry, size, stage, culture_tags,
    #              products, competitors, recent_news, source_urls }

    match_analysis: Mapped[str | None] = mapped_column(Text)
    # 匹配度分析：候选人与岗位的多维度匹配评估

    strategy_doc: Mapped[str | None] = mapped_column(Text)
    # 面试策略文档：整体应对思路和核心卖点

    question_list: Mapped[list | None] = mapped_column(PortableJSON())
    # 面试问题清单: [{ question, purpose, answer_hint, category }, ...]

    company: Mapped[str | None] = mapped_column(String(255))
    position: Mapped[str | None] = mapped_column(String(255))

    # AI 生成元信息
    model_used: Mapped[str | None] = mapped_column(String(64))
    generation_cost_tokens: Mapped[int | None] = mapped_column(Integer, default=0)


class InterviewReview(TimestampMixin, Base):
    """面试复盘记录。基于录音分析的面试表现复盘。"""

    __tablename__ = "interview_review"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    prep_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("interview_prep.id"), index=True)
    audio_recording_id: Mapped[str | None] = mapped_column(GUID)
    # 关联到智能记录的 recording.id

    highlights: Mapped[str | None] = mapped_column(Text)
    # 面试亮点：回答得好的地方

    improvements: Mapped[str | None] = mapped_column(Text)
    # 改进方向：需要提升的回答

    review_sop: Mapped[str | None] = mapped_column(Text)
    # 复盘SOP：标准化的复盘流程和方法论

    overall_rating: Mapped[int | None] = mapped_column(Integer)  # 1-5 总体评分

    # AI 分析元信息
    model_used: Mapped[str | None] = mapped_column(String(64))
    analysis_cost_tokens: Mapped[int | None] = mapped_column(Integer, default=0)


class OfferComparison(TimestampMixin, Base):
    """Offer多维度对比表。纯信息陈列，帮助用户做决定（不替用户做决策）。"""

    __tablename__ = "offer_comparison"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    career_progress_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("career_progress.id"), index=True)

    offers_json: Mapped[list | None] = mapped_column(PortableJSON())
    # [{ offer_label, company, salary, level, growth, commute, culture, stability, notes }, ...]

    selected_offer_id: Mapped[str | None] = mapped_column(String(64))
    # 用户选中的 offer 标识（在 offers_json 中的索引或label）

    comparison_notes: Mapped[str | None] = mapped_column(Text)
    # 用户的比较笔记


class ProbationPlan(TimestampMixin, Base):
    """试用期30/60/90天计划。入职后的分阶段里程碑。"""

    __tablename__ = "probation_plan"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    offer_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("offer_comparison.id"), index=True)

    milestones_json: Mapped[dict | None] = mapped_column(PortableJSON())
    # {
    #   "day_30": [{ goal, actions, checkpoints }, ...],
    #   "day_60": [{ goal, actions, checkpoints }, ...],
    #   "day_90": [{ goal, actions, checkpoints }, ...],
    #   "overall_goal": "顺利通过试用期并建立核心贡献"
    # }

    company: Mapped[str | None] = mapped_column(String(255))
    position: Mapped[str | None] = mapped_column(String(255))

    # AI 生成元信息
    model_used: Mapped[str | None] = mapped_column(String(64))
    generation_cost_tokens: Mapped[int | None] = mapped_column(Integer, default=0)


class CompanyIntel(TimestampMixin, Base):
    """老师后台企业情报采集。AI辅助，仅公开信息源，老师最终核实。"""

    __tablename__ = "company_intel"

    user_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    # 哪个用户的需求（可为空，表示老师主动采集的通用情报）

    company_name: Mapped[str] = mapped_column(String(255))

    intel_report_json: Mapped[dict | None] = mapped_column(PortableJSON())
    # { company_name, industry, scale, founded, hq,
    #   culture_summary, product_summary, market_position,
    #   recent_news: [...], risk_flags: [...], hiring_trend }

    source_urls: Mapped[list | None] = mapped_column(PortableJSON())
    # 仅公开信息源URL列表

    teacher_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("teacher_profile.id"))
    teacher_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    # 老师人工核实标记

    # AI 初稿≤3分钟，仅公开信息
    model_used: Mapped[str | None] = mapped_column(String(64))
    generation_time_ms: Mapped[int | None] = mapped_column(Integer, default=0)
