"""流程状态表 — Tier 3 记忆系统。

记录用户在每个模块的当前流程阶段，支持中断恢复。
用于朝有规划/暮有复盘/情绪树洞的硬性阶段流转控制。

状态机定义见 engines/flow_state_machine.py。
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from ..database import GUID, Base, PortableJSON, TimestampMixin


# ═══════ 三大流程阶段定义 ═══════

MORNING_PLAN_STAGES = [
    "greeting",      # 0: AI欢迎 + 昨日回顾
    "inventory",     # 1: 用户列出今日事项
    "prioritize",    # 2: AI辅助排序
    "classify",      # 3: 四象限分类
    "confirm",       # 4: 用户确认计划
    "archive",       # 5: 归档 + 行动项同步
]

EVENING_REVIEW_STAGES = [
    "greeting",      # 0: 开篇问候
    "inventory",     # 1: 回顾成就/记忆点
    "extraction",    # 2: 提炼方法论/SOP
    "improvement",   # 3: 改进方向+明日行动
    "archive",       # 4: 总结归档
]

EMOTION_TREEHOLE_STAGES = [
    "vent",          # 0: 尽情倾诉
    "reflect",       # 1: 情绪识别+共情
    "reframe",       # 2: 认知重构
    "growth",        # 3: 成长记录+勇气值
]

MODULE_STAGES: dict[str, list[str]] = {
    "mp": MORNING_PLAN_STAGES,   # morning_plan
    "er": EVENING_REVIEW_STAGES,  # evening_review
    "mh": EMOTION_TREEHOLE_STAGES,  # mood_haven / emotion_treehole
}


class FlowState(TimestampMixin, Base):
    """流程阶段状态 — 每个用户每模块最多一条活跃记录。

    用途：
    - 记录用户在哪个流程的哪个阶段
    - 支持中断恢复（用户中途离开再回来）
    - 程序控制阶段跳转，禁止 AI 自行决定
    """
    __tablename__ = "flow_states"

    user_id: Mapped[str] = mapped_column(GUID, ForeignKey("user_account.id"), index=True, nullable=False)
    module: Mapped[str] = mapped_column(String(32), nullable=False, comment="mp/er/mh")
    current_stage: Mapped[str] = mapped_column(String(32), nullable=False, comment="当前阶段key")
    stages_completed: Mapped[dict | None] = mapped_column(PortableJSON(), comment="已完成的阶段列表")
    stage_entered_at: Mapped[datetime | None] = mapped_column(DateTime, comment="进入当前阶段的时间")
    metadata_json: Mapped[dict | None] = mapped_column(PortableJSON(), comment="模块特定元数据")
    status: Mapped[str] = mapped_column(String(16), default="active", comment="active/completed/abandoned")
