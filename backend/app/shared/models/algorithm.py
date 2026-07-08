"""算法文件模型 — 管理员上传各模块算法文件，AI调用时优先检索。

支持模块：
  morning_plan  (朝有规划)
  evening_review (暮有复盘)
  emotion_treehole (情绪树洞)
  smart_qa      (智能问答)
  smart_office  (智能办公)
  smart_job     (智能求职)
"""
from __future__ import annotations

from sqlalchemy import String, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from ..database import GUID, Base, TimestampMixin


class AlgorithmFile(TimestampMixin, Base):
    """管理员上传的算法文件，按模块隔离。"""

    __tablename__ = "algorithm_file"

    module_key: Mapped[str] = mapped_column(
        String(64), index=True, nullable=False,
        comment="所属模块: morning_plan|evening_review|emotion_treehole|smart_qa|smart_office|smart_job",
    )
    filename: Mapped[str] = mapped_column(
        String(255), nullable=False,
        comment="存储文件名（UUID命名）",
    )
    original_filename: Mapped[str] = mapped_column(
        String(255), nullable=False,
        comment="原始上传文件名",
    )
    content: Mapped[str] = mapped_column(
        Text, nullable=False,
        comment="算法文件文本内容",
    )
    file_size: Mapped[int] = mapped_column(
        Integer, default=0,
        comment="文件大小（字节）",
    )
    uploaded_by: Mapped[str | None] = mapped_column(
        GUID, nullable=True, index=True,
        comment="上传者用户ID",
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "module_key": self.module_key,
            "filename": self.filename,
            "original_filename": self.original_filename,
            "file_size": self.file_size,
            "content_preview": self.content[:200] + "..." if len(self.content) > 200 else self.content,
            "uploaded_by": self.uploaded_by,
            "created_at": self.created_at.isoformat() if self.created_at else "",
            "updated_at": self.updated_at.isoformat() if self.updated_at else "",
        }
