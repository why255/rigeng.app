"""智能问答服务 — 请求/响应模型（步骤16）。"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ═══════ 三源引擎配置 ═══════

class SourceEngineConfig(BaseModel):
    """知识引擎配置项。"""
    key: str = Field(..., pattern="^(private|xiejun|internet)$")
    enabled: bool = True


# ═══════ 提问 & 答案 ═══════

class AskRequest(BaseModel):
    """发起问答请求。"""
    question: str = Field(..., min_length=1, max_length=2000)
    conversation_id: str | None = None  # 空=新建对话，有值=追问
    source_engines: list[SourceEngineConfig] | None = None
    # 默认：[{key:"private",enabled:true}, {key:"xiejun",enabled:true}, {key:"internet",enabled:false}]


class AnswerElementOut(BaseModel):
    """四要素中的单项。"""
    key: str  # key-points / cautions / script / standard
    title: str
    icon: str
    color: str
    summary: str
    detail: list[str]


class AnswerSourceOut(BaseModel):
    """答案来源引用。"""
    title: str
    library: str  # 私有库 / 携君库 / 互联网
    label: str  # 文档较新 / 需核实 / 内容较旧
    updated_at: str = ""
    verified: bool = False
    is_internet: bool = False
    is_stale: bool = False
    doc_id: str | None = None


class QaAnswerOut(BaseModel):
    """四要素答案完整输出。"""
    id: str
    question: str
    intro: str = ""
    elements: list[AnswerElementOut] = []
    source: AnswerSourceOut | None = None
    conversation_id: str = ""
    rounds: int = 0
    created_at: str = ""


class AskResponse(BaseModel):
    """提问返回：AI回答 + 会话信息。"""
    conversation_id: str
    answer: QaAnswerOut
    is_clarification: bool = False  # 是否为追问澄清（而非最终答案）
    clarification_question: str = ""  # 追问澄清的问题文本
    suggestions: list[str] = []  # 推荐追问方向


# ═══════ 对话历史 ═══════

class ConversationMessage(BaseModel):
    """对话消息项。"""
    role: str  # assistant / user
    text: str
    answer: QaAnswerOut | None = None


class ConversationOut(BaseModel):
    """对话历史输出。"""
    conversation_id: str
    question: str
    rounds: int = 0
    status: str = "active"
    messages: list[ConversationMessage] = []
    created_at: str = ""


# ═══════ 纠错反馈 ═══════

class FeedbackRequest(BaseModel):
    """提交纠错反馈。"""
    answer_id: str = Field(...)
    feedback_type: str = Field(..., pattern="^(内容有误|时效过期|逻辑不通|其他问题)$")
    detail: str | None = None


class FeedbackResponse(BaseModel):
    """纠错反馈结果。"""
    feedback_id: str
    answer_id: str
    status: str = "pending"


# ═══════ 归档 ═══════

class ArchiveRequest(BaseModel):
    """将答案归档到知识库。"""
    answer_id: str = Field(...)
    hr_category: str | None = None  # HR八大模块分类


class ArchiveResponse(BaseModel):
    """归档结果。"""
    success: bool = False
    doc_id: str = ""
    answer_id: str = ""
    contribution_value: int = 20  # 归档奖励贡献值


# ═══════ 热门问题 ═══════

class HotQuestionItem(BaseModel):
    """热门问题项。"""
    id: str
    text: str


# ═══════ 有帮助反馈 ═══════

class HelpfulRequest(BaseModel):
    """标记答案有帮助。"""
    answer_id: str = Field(...)


class HelpfulResponse(BaseModel):
    """有帮助反馈结果。"""
    answer_id: str
    helpful_count: int = 0
