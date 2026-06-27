"""智能记录域 — ORM 模型（步骤15）。

四张表：
- Recording: 录音主表（场景/时长/文件/状态）
- TranscriptSegment: 转写文本分段（说话人/时间/文本/置信度）
- ExtractionResult: AI萃取结果（候选人画像/胜任力评估/行动项）
- ActionItem: 萃取出的行动项（可同步到朝有规划）

跨模块调用链：
  录音 → ③语音引擎（ASR转写）
  转写 → ③AI引擎（结构化萃取）
  萃取 → ②知识库（归档） + ①朝有规划（行动项同步）
  文件 → ④文件存储（音频压缩/存储）
"""
from __future__ import annotations

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import GUID, Base, PortableJSON, TimestampMixin

# ── 枚举常量 ──
RECORDING_SCENES = ("面试", "会议", "日常", "自定义")
RECORDING_STATUSES = ("recording", "transcribing", "extracting", "completed", "failed")
SPEAKER_ROLES = ("interviewer", "candidate", "speaker", "unknown")


class Recording(TimestampMixin, Base):
    """录音主表。每个录音包含：场景、时长、关联音频文件、处理状态。"""

    __tablename__ = "recording"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    title: Mapped[str | None] = mapped_column(String(512))
    scene: Mapped[str] = mapped_column(String(32), default="日常")  # 面试/会议/日常/自定义
    status: Mapped[str] = mapped_column(String(32), default="recording", index=True)
    # recording → transcribing → extracting → completed / failed

    duration_seconds: Mapped[int | None] = mapped_column(Integer, default=0)
    file_object_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("file_object.id"))
    file_size_bytes: Mapped[int | None] = mapped_column(Integer, default=0)

    # 转写进度
    transcript_status: Mapped[str | None] = mapped_column(String(16), default="pending")
    # pending → processing → done → failed

    # 萃取进度
    extraction_status: Mapped[str | None] = mapped_column(String(16), default="pending")
    # pending → processing → done → failed

    # 归档状态
    archived_to_kb: Mapped[bool] = mapped_column(Boolean, default=False)
    kb_doc_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("document.id"))

    # 备注/标签
    notes: Mapped[str | None] = mapped_column(Text)
    tags_json: Mapped[dict | None] = mapped_column(PortableJSON())


class TranscriptSegment(TimestampMixin, Base):
    """转写文本分段。一个录音对应多条分段。"""

    __tablename__ = "transcript_segment"

    recording_id: Mapped[str] = mapped_column(GUID, ForeignKey("recording.id"), index=True)
    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)

    segment_index: Mapped[int] = mapped_column(Integer, default=0)  # 分段序号
    speaker: Mapped[str | None] = mapped_column(String(64))  # 说话人标签（面试官/候选人/未知）
    speaker_role: Mapped[str | None] = mapped_column(String(32))  # interviewer/candidate/speaker/unknown
    start_time_seconds: Mapped[float | None] = mapped_column(Float, default=0.0)  # 对话中的起始秒
    end_time_seconds: Mapped[float | None] = mapped_column(Float, default=0.0)  # 对话中的结束秒

    text: Mapped[str | None] = mapped_column(Text)
    confidence: Mapped[float | None] = mapped_column(Float, default=0.0)  # ASR置信度 0.0-1.0

    is_candidate: Mapped[bool] = mapped_column(Boolean, default=False)  # 前端气泡渲染用


class ExtractionResult(TimestampMixin, Base):
    """AI萃取结果。从转写文本中结构化萃取的关键信息。

    面试场景：候选人画像 + 胜任力评估
    会议场景：会议纪要 + 决策点 + 行动项
    日常场景：关键洞察 + 待办事项
    """

    __tablename__ = "extraction_result"

    recording_id: Mapped[str] = mapped_column(GUID, ForeignKey("recording.id"), unique=True, index=True)
    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)

    # 萃取类别
    extraction_type: Mapped[str | None] = mapped_column(String(32))  # interview_profile / meeting_minutes / daily_notes

    # 结构化内容（PortableJSON）
    content_json: Mapped[dict | None] = mapped_column(PortableJSON())
    # 面试场景示例: {
    #   name, role, avatarBg, years, school,
    #   skills: [...], salary, onboard,
    #   competencies: [{label, stars}, ...]
    # }
    # 会议场景示例: {
    #   meeting_title, date, participants: [...],
    #   key_decisions: [...], action_items: [...]
    # }

    # 摘要文本
    summary: Mapped[str | None] = mapped_column(Text)

    # 使用的模型信息
    model_used: Mapped[str | None] = mapped_column(String(64))
    extraction_cost_tokens: Mapped[int | None] = mapped_column(Integer, default=0)


class ActionItem(TimestampMixin, Base):
    """萃取出的行动项。可被同步到朝有规划作为今日任务。"""

    __tablename__ = "action_item"

    recording_id: Mapped[str] = mapped_column(GUID, ForeignKey("recording.id"), index=True)
    extraction_id: Mapped[str | None] = mapped_column(GUID, ForeignKey("extraction_result.id"), index=True)
    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)

    title: Mapped[str] = mapped_column(String(512))
    description: Mapped[str | None] = mapped_column(Text)
    priority: Mapped[str | None] = mapped_column(String(32))  # high / medium / low
    due_date: Mapped[str | None] = mapped_column(String(32))  # ISO date string

    # 同步到朝有规划的状态
    synced_to_plan: Mapped[bool] = mapped_column(Boolean, default=False)
    plan_task_id: Mapped[str | None] = mapped_column(GUID)  # 对应 plan_task.id
