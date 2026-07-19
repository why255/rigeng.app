"""聊天消息域 — ORM 模型（全模块数据互通 Phase 1）。

chat_message 表存储全6个模块的聊天消息，实现跨设备数据互通：
- mp: 朝有规划 (morning plan)
- er: 暮有复盘 (evening review)
- mh: 情绪树洞 (mood haven)
- sq: 智能问答 (smart QA)
- so: 智能办公 (smart office)
- cm: 职业导师 (career mentor)

同步策略：前端上传今日消息（全量覆盖），后端按 chat_date 存储。
每日早上5点为日界（与前端 useChatStorage 的 getTodayChatDay 对齐）。
"""
from __future__ import annotations

from sqlalchemy import ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import GUID, Base, TimestampMixin

# ── 模块枚举 ──
CHAT_MODULES = ("mp", "er", "mh", "sq", "so", "cm")
CHAT_ROLES = ("user", "assistant")
CHAT_TYPES = ("text", "voice")


class ChatMessage(TimestampMixin, Base):
    """聊天消息 — 全模块通用，按 user_id + module + chat_date 分区。"""

    __tablename__ = "chat_message"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True)
    module: Mapped[str] = mapped_column(String(8))            # mp|er|mh|sq|so|cm
    chat_date: Mapped[str] = mapped_column(String(16))        # YYYY-MM-DD, 5AM日界
    role: Mapped[str] = mapped_column(String(16))             # assistant|user
    text: Mapped[str] = mapped_column(Text)
    type: Mapped[str] = mapped_column(String(8), default="text")  # text|voice
    seq: Mapped[int] = mapped_column(Integer, default=0)      # 日内排序

    __table_args__ = (
        Index("ix_chat_message_user_module_date_seq", "user_id", "module", "chat_date", "seq"),
    )
