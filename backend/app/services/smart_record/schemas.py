"""智能记录服务 — 请求/响应模型（步骤15）。"""
from __future__ import annotations

from pydantic import BaseModel, Field


# ═══════ 录音 CRUD ═══════

class RecordingStartRequest(BaseModel):
    """开始录音请求。"""
    scene: str = Field(default="面试", pattern="^(面试|会议|日常|自定义)$")


class RecordingStartResponse(BaseModel):
    """录音开始结果。"""
    recording_id: str
    scene: str
    status: str = "recording"


class RecordingStopRequest(BaseModel):
    """停止录音请求。"""
    recording_id: str


class RecordingStopResponse(BaseModel):
    """停止录音结果。"""
    recording_id: str
    status: str
    duration_seconds: int = 0
    file_size_bytes: int = 0


# ═══════ 录音统计 ═══════

class TodayStatsResponse(BaseModel):
    """今日录音统计。"""
    count: int = 0
    total_minutes: int = 0
    completed_count: int = 0
    processing_count: int = 0


# ═══════ 录音列表 ═══════

class RecordingListItem(BaseModel):
    """录音列表项。"""
    id: str
    title: str
    scene: str
    scene_color: str = "#BCAAA4"
    date: str = ""
    duration: str = ""
    duration_sec: int = 0
    status: str  # completed / transcribing / extracting / failed
    progress: int | None = None  # 0-100


# ═══════ 转写 ═══════

class TranscriptSegmentOut(BaseModel):
    """转写分段。"""
    speaker: str = ""
    time: str = ""
    text: str = ""
    confidence: int = 0  # 0-100
    is_candidate: bool = False


class TranscriptResponse(BaseModel):
    """转写结果。"""
    recording_id: str
    title: str = ""
    scene: str = ""
    duration_seconds: int = 0
    audio_url: str = ""
    segments: list[TranscriptSegmentOut] = []


# ═══════ 萃取 ═══════

class CompetencyItem(BaseModel):
    """胜任力评估项。"""
    label: str
    stars: int = 0  # 1-5


class ExtractionResponse(BaseModel):
    """萃取结果。"""
    recording_id: str
    extraction_type: str = ""  # interview_profile / meeting_minutes / daily_notes
    name: str = ""
    role: str = ""
    avatar_bg: str = "#BCAAA4"
    years: str = ""
    school: str = ""
    skills: list[str] = []
    salary: str = ""
    onboard: str = ""
    competencies: list[CompetencyItem] = []
    summary: str = ""
    action_items: list[dict] = []


# ═══════ 归档 ═══════

class ArchiveRequest(BaseModel):
    """归档到知识库请求。"""
    recording_id: str
    hr_category: str | None = None  # HR八大模块分类，默认根据场景自动匹配


class ArchiveResponse(BaseModel):
    """归档结果。"""
    success: bool = False
    doc_id: str = ""
    recording_id: str = ""


# ═══════ 行动项同步 ═══════

class ActionItemSyncRequest(BaseModel):
    """同步行动项到朝有规划。"""
    recording_id: str
    action_item_ids: list[str] = []  # 要同步的行动项ID列表
    plan_id: str | None = None  # 目标计划ID，无则同步到今日计划


class ActionItemSyncResponse(BaseModel):
    """同步结果。"""
    synced_count: int = 0
    plan_task_ids: list[str] = []


# ═══════ 提词器（跨模块联动：智能问答） ═══════

class TeleprompterRequest(BaseModel):
    """面试提词器请求。"""
    scene: str = Field(default="面试", pattern="^(面试)$")
    position: str | None = None  # 目标岗位，如"高级前端工程师"
    stage: str | None = None  # 面试阶段，如"技术面"/"HR面"


class TeleprompterItem(BaseModel):
    """提词器问题项。"""
    question: str = ""
    purpose: str = ""  # 提问目的
    expected_answer_hint: str = ""  # 期望答案提示


class TeleprompterResponse(BaseModel):
    """提词器回复。"""
    scene: str = "面试"
    position: str = ""
    questions: list[TeleprompterItem] = []
    tips: str = ""  # 面试技巧提示
