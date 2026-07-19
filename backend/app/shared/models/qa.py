"""智能问答域 — ORM 模型（步骤16）。

三张表：
- QaConversation: 问答对话会话（问题/追问澄清/答案）
- QaAnswer: 四要素结构化答案（操作要点+注意事项+沟通话术+达成标准）
- QaFeedback: 纠错反馈记录（防幻觉四级防线的第3级：申诉纠错）

跨模块调用链：
  问题 → ⑤搜索/RAG（三源检索：私有库+携君库+互联网）
  检索 → ③AI引擎（四要素答案生成）
  答案 → ②知识库（SOP沉淀归档）
  质控 → 防幻觉四级防线（来源标注+时效性标注+申诉纠错+人工抽检）
"""
from __future__ import annotations

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import GUID, Base, PortableJSON, TimestampMixin

# ── 枚举常量 ──
QA_SOURCE_TYPES = ("private", "xiejun", "internet")
FEEDBACK_TYPES = ("内容有误", "时效过期", "逻辑不通", "其他问题")
ANSWER_ELEMENT_KEYS = ("key-points", "cautions", "script", "standard")


class QaConversation(TimestampMixin, Base):
    """问答对话会话。一个会话包含：原始问题 + 多轮追问 + 最终答案。"""

    __tablename__ = "qa_conversation"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)

    # 原始问题
    question: Mapped[str] = mapped_column(Text)

    # 对话轮次计数（追问次数，0=首轮答案，1-4=追问）
    rounds: Mapped[int] = mapped_column(Integer, default=0)

    # 三源引擎配置（JSON: {"private": true, "xiejun": true, "internet": false}）
    source_engines_json: Mapped[dict | None] = mapped_column(PortableJSON())

    # 会话状态
    status: Mapped[str] = mapped_column(String(16), default="active")
    # active / closed

    # 关联的最终答案
    answer_id: Mapped[str | None] = mapped_column(GUID)


class QaAnswer(TimestampMixin, Base):
    """四要素结构化答案。AI生成后存储，支持归档到知识库。"""

    __tablename__ = "qa_answer"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    conversation_id: Mapped[str] = mapped_column(GUID, ForeignKey("qa_conversation.id"), index=True)

    # 对应的问题文本
    question: Mapped[str] = mapped_column(Text)

    # 引言（小耕的开场白）
    intro: Mapped[str | None] = mapped_column(Text)

    # 四要素结构化内容（PortableJSON）
    # [
    #   {key: "key-points", title: "操作要点", icon: "📋", color: "#C03A39",
    #    summary: "...", detail: ["...", "..."]},
    #   ...
    # ]
    elements_json: Mapped[list | None] = mapped_column(PortableJSON())

    # 来源引用（PortableJSON）
    # {
    #   title: "《劳动法合规操作手册 · 2026版》",
    #   library: "携君库", label: "文档较新",
    #   updated_at: "2026-06-15", verified: true,
    #   is_internet: false, is_stale: false,
    #   doc_id: "xxx"  // 关联的知识库文档ID
    # }
    source_json: Mapped[dict | None] = mapped_column(PortableJSON())

    # 反幻觉四级防线标记
    # 第1级：来源已标注 → source_json 中必有 title/library
    # 第2级：时效性已标注 → source_json 中必有 label/is_stale
    # 第3级：用户可申诉 → 通过 QaFeedback 表
    # 第4级：人工抽检 → audit_status 字段
    has_source_label: Mapped[bool] = mapped_column(Boolean, default=True)  # L1
    has_timeliness_label: Mapped[bool] = mapped_column(Boolean, default=True)  # L2

    # 人工抽检状态（L4）
    audit_status: Mapped[str | None] = mapped_column(String(16), default="pending")
    # pending / passed / flagged

    # 使用的AI模型信息
    model_used: Mapped[str | None] = mapped_column(String(64))
    generation_cost_tokens: Mapped[int | None] = mapped_column(Integer, default=0)

    # 是否已归档到知识库
    archived_to_kb: Mapped[bool] = mapped_column(Boolean, default=False)
    kb_doc_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("document.id"))

    # 用户反馈统计
    helpful_count: Mapped[int] = mapped_column(Integer, default=0)
    unhelpful_count: Mapped[int] = mapped_column(Integer, default=0)

    # A7 答案溯源——三层来源占比（携君智库接入 2026-07-15）
    # {"private": {"percentage": 40, "citation_titles": ["..."], "doc_count": 2},
    #  "xiejun": {"percentage": 30, "citation_titles": ["安权老师《薪酬7步法》"], "doc_count": 1},
    #  "internet": {"percentage": 30, "citation_titles": ["..."], "doc_count": 3}}
    source_percentages_json: Mapped[dict | None] = mapped_column(PortableJSON())


class QaFeedback(TimestampMixin, Base):
    """纠错反馈记录。防幻觉四级防线第3级：用户申诉纠错。"""

    __tablename__ = "qa_feedback"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    answer_id: Mapped[str] = mapped_column(GUID, ForeignKey("qa_answer.id"), index=True)

    # 反馈类型
    feedback_type: Mapped[str] = mapped_column(String(32))  # 内容有误 / 时效过期 / 逻辑不通 / 其他问题

    # 详细说明
    detail: Mapped[str | None] = mapped_column(Text)

    # 处理状态
    status: Mapped[str] = mapped_column(String(16), default="pending")
    # pending / reviewing / resolved / dismissed

    # 处理备注（运营/老师审核后填写）
    resolution_note: Mapped[str | None] = mapped_column(Text)
