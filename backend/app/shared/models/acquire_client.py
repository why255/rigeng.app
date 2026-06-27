"""拿下一个客户域 — ORM 模型（步骤22 / Wave 4）。

八张表覆盖六步签约流程 + 角色转换模拟训练：
- TransitionSignal: 智能转型触发信号
- SelfDiagnosis: 用户自我诊断
- CompanyIntel: 客户情报采集（老师后台）
- MeetingStrategy: 面谈策略文档
- ClientMeeting: 客户面谈记录
- NegotiationRound: 多轮谈判管理
- RoleplaySession: 角色转换模拟训练
- ClientContract: 签约后合同管理
"""
from __future__ import annotations

from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..database import GUID, Base, PortableJSON, TimestampMixin


# ── 枚举常量 ──
DIAGNOSIS_STATUSES = ("draft", "teacher_reviewing", "confirmed", "rejected")
INTEL_STATUSES = ("collected", "reviewed", "delivered")
MEETING_STRATEGY_STATUSES = ("draft", "teacher_reviewing", "approved", "rejected")
MEETING_STATUSES = ("preparing", "in_progress", "completed", "reviewed")
NEGOTIATION_STATUSES = ("preparing", "in_progress", "completed", "reviewed")
ROLEPLAY_SCENARIOS = ("cold_call", "first_visit", "objection_handling", "closing", "custom")
ROLEPLAY_ROLES = ("client", "expert", "teacher")
CONTRACT_STATUSES = ("uploaded", "synced", "archived")


class TransitionSignal(TimestampMixin, Base):
    """智能转型触发信号。从日常对话中扫描转型信号，温和引导用户进入签约流程。"""

    __tablename__ = "acquire_transition_signal"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    context_text: Mapped[str | None] = mapped_column(Text)  # 触发上下文（对话片段）
    signal_type: Mapped[str | None] = mapped_column(String(64))  # 信号类型：意向咨询/岗位需求/薪资讨论等
    confidence: Mapped[float | None] = mapped_column(Float, default=0.0)  # AI检测置信度 0.0-1.0
    action_taken: Mapped[str | None] = mapped_column(String(128))  # 已执行动作：suggested/guided/none
    guided_flow: Mapped[str | None] = mapped_column(String(32))  # 引导进入的流程：diagnosis/intel/strategy
    conversation_id: Mapped[str | None] = mapped_column(GUID)  # 关联对话ID


class SelfDiagnosis(TimestampMixin, Base):
    """用户自我诊断。上传简历+AI引导访谈→生成诊断报告→老师审核确认。"""

    __tablename__ = "acquire_self_diagnosis"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    resume_upload_url: Mapped[str | None] = mapped_column(String(1024))  # 简历文件URL
    resume_parsed_json: Mapped[dict | None] = mapped_column(PortableJSON())  # AI解析的简历结构化数据
    interview_answers_json: Mapped[dict | None] = mapped_column(PortableJSON())  # 引导访谈问答记录
    diagnosis_report_json: Mapped[dict | None] = mapped_column(PortableJSON())  # 诊断报告
    self_rating_json: Mapped[dict | None] = mapped_column(PortableJSON())  # 用户自我评估
    teacher_reviewed: Mapped[bool] = mapped_column(Boolean, default=False)
    teacher_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("user_account.id"))
    teacher_notes: Mapped[str | None] = mapped_column(Text)  # 老师审核备注
    status: Mapped[str] = mapped_column(String(32), default="draft")  # draft/teacher_reviewing/confirmed/rejected


class CompanyIntel(TimestampMixin, Base):
    """客户情报采集（老师后台AI采集+审核+交付）。仅基于公开信息。"""

    __tablename__ = "acquire_company_intel"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    company_name: Mapped[str] = mapped_column(String(256))
    company_aliases_json: Mapped[list | None] = mapped_column(PortableJSON())  # 公司别名
    industry: Mapped[str | None] = mapped_column(String(128))  # 行业
    scale: Mapped[str | None] = mapped_column(String(64))  # 规模
    location: Mapped[str | None] = mapped_column(String(256))  # 所在地
    intel_report_json: Mapped[dict | None] = mapped_column(PortableJSON())  # AI采集情报报告
    source_urls_json: Mapped[list | None] = mapped_column(PortableJSON())  # 情报来源URL列表
    source_types_json: Mapped[list | None] = mapped_column(PortableJSON())  # 来源类型：招聘网站/官网/公众号/天眼查/看准网/脉脉
    teacher_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("user_account.id"))
    teacher_review_notes: Mapped[str | None] = mapped_column(Text)  # 老师审核备注
    delivered_at: Mapped[str | None] = mapped_column(String(32))  # 交付时间
    status: Mapped[str] = mapped_column(String(32), default="collected")  # collected/reviewed/delivered


class MeetingStrategy(TimestampMixin, Base):
    """面谈策略文档。基于诊断+情报→生成策略文档+提纲→老师审核确认。"""

    __tablename__ = "acquire_meeting_strategy"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    intel_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("acquire_company_intel.id"))
    diagnosis_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("acquire_self_diagnosis.id"))
    strategy_doc_json: Mapped[dict | None] = mapped_column(PortableJSON())  # 策略文档
    # 策略文档结构: { goals: [...], approach: str, key_points: [...], risks: [...], alternatives: [...] }
    outline_json: Mapped[dict | None] = mapped_column(PortableJSON())  # 面谈提纲
    # 提纲结构: { sections: [{ title, talking_points: [...], time_allocation: int }] }
    teacher_notes: Mapped[str | None] = mapped_column(Text)
    teacher_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(32), default="draft")  # draft/teacher_reviewing/approved/rejected


class ClientMeeting(TimestampMixin, Base):
    """客户面谈记录。关联智能记录的录音，支持多轮谈判。"""

    __tablename__ = "acquire_client_meeting"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    strategy_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("acquire_meeting_strategy.id"))
    recording_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("recording.id"))  # 关联智能记录录音
    round_num: Mapped[int] = mapped_column(Integer, default=1)  # 第几轮
    client_name: Mapped[str | None] = mapped_column(String(128))  # 客户姓名/称呼
    client_position: Mapped[str | None] = mapped_column(String(128))  # 客户职位
    meeting_date: Mapped[str | None] = mapped_column(String(32))  # 面谈日期
    achievement_rate: Mapped[float | None] = mapped_column(Float, default=0.0)  # 达成率 0.0-1.0
    analysis_json: Mapped[dict | None] = mapped_column(PortableJSON())  # 逐条分析
    # 分析结构: { highlights: [...], improvements: [...], review_sop: [...], item_by_item: [{ item, achieved, rate, comment }] }
    meeting_notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="preparing")  # preparing/in_progress/completed/reviewed


class NegotiationRound(TimestampMixin, Base):
    """多轮谈判管理（每轮独立的策略→执行→复盘闭环）。"""

    __tablename__ = "acquire_negotiation_round"

    meeting_id: Mapped[str] = mapped_column(GUID, ForeignKey("acquire_client_meeting.id"), index=True)
    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    round_number: Mapped[int] = mapped_column(Integer, default=1)
    strategy_json: Mapped[dict | None] = mapped_column(PortableJSON())  # 本轮策略
    meeting_notes_json: Mapped[dict | None] = mapped_column(PortableJSON())  # 本轮面谈记录
    review_json: Mapped[dict | None] = mapped_column(PortableJSON())  # 本轮复盘
    achievement_rate: Mapped[float | None] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(32), default="preparing")  # preparing/in_progress/completed/reviewed


class RoleplaySession(TimestampMixin, Base):
    """角色转换模拟训练（三重角色切换 + A/B双维度评分）。

    三重角色：
    - client: 小耕扮演客户，用户扮演顾问
    - expert: 小耕扮演专家评估者
    - teacher: 小耕扮演老师引导者

    评分：
    - A维度：关键词命中率
    - B维度：四维评分（完整性/逻辑性/深度/针对性）
    - 综合得分 = A * 0.3 + B * 0.7
    """

    __tablename__ = "acquire_roleplay_session"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    scenario_type: Mapped[str] = mapped_column(String(32), default="custom")  # cold_call/first_visit/objection_handling/closing/custom
    current_role: Mapped[str] = mapped_column(String(16), default="client")  # client/expert/teacher
    client_profile_json: Mapped[dict | None] = mapped_column(PortableJSON())  # 客户角色设定
    # { company, position, personality, pain_points: [...], budget, authority_chain }
    dialogue_json: Mapped[list | None] = mapped_column(PortableJSON())  # 对话记录
    # [{ role: "user"/"client"/"expert"/"teacher", text: str, timestamp: str }]
    score_a: Mapped[float | None] = mapped_column(Float, default=0.0)  # A维度：关键词命中率
    score_a_detail_json: Mapped[dict | None] = mapped_column(PortableJSON())  # A维度详情
    # { total_keywords: int, hit_keywords: int, hit_rate: float, missed_keywords: [...] }
    score_b: Mapped[float | None] = mapped_column(Float, default=0.0)  # B维度：四维评分
    score_b_detail_json: Mapped[dict | None] = mapped_column(PortableJSON())  # B维度详情
    # { completeness: int, logic: int, depth: int, relevance: int } 各维度0-25分
    total_score: Mapped[float | None] = mapped_column(Float, default=0.0)  # 综合得分
    passed: Mapped[bool | None] = mapped_column(Boolean, default=False)  # 是否通过（>=80分）
    pass_threshold: Mapped[float | None] = mapped_column(Float, default=80.0)  # 合格线（可配置）
    expert_feedback: Mapped[str | None] = mapped_column(Text)  # 专家角色反馈
    teacher_guidance: Mapped[str | None] = mapped_column(Text)  # 老师角色指导


class ClientContract(TimestampMixin, Base):
    """签约后合同管理。上传合同→自动同步到打磨产品模块。"""

    __tablename__ = "acquire_client_contract"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    meeting_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("acquire_client_meeting.id"))
    contract_url: Mapped[str | None] = mapped_column(String(1024))  # 合同文件URL
    contract_title: Mapped[str | None] = mapped_column(String(512))  # 合同标题
    contract_amount: Mapped[str | None] = mapped_column(String(64))  # 合同金额
    client_company: Mapped[str | None] = mapped_column(String(256))  # 客户公司
    service_list_json: Mapped[list | None] = mapped_column(PortableJSON())  # 服务清单
    # [{ service_name, description, price, module_sync }]
    synced_to_product: Mapped[bool] = mapped_column(Boolean, default=False)  # 是否已同步到打磨产品
    product_doc_id: Mapped[str | None] = mapped_column(GUID)  # 同步后的产品文档ID
    status: Mapped[str] = mapped_column(String(32), default="uploaded")  # uploaded/synced/archived


class ComplianceReminder(TimestampMixin, Base):
    """合规提示记录。追踪首次使用合规提示弹窗状态。"""

    __tablename__ = "acquire_compliance_reminder"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), unique=True, index=True)
    first_shown: Mapped[bool] = mapped_column(Boolean, default=False)  # 是否已展示首次合规提示
    first_shown_at: Mapped[str | None] = mapped_column(String(32))  # 首次展示时间
    accepted: Mapped[bool] = mapped_column(Boolean, default=False)  # 用户是否已确认
    accepted_at: Mapped[str | None] = mapped_column(String(32))  # 确认时间
    reminder_text: Mapped[str | None] = mapped_column(Text)  # 合规提示文本
