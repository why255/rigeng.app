"""流程状态机引擎 FlowStateMachine (Tier 3 记忆系统)。

核心能力:
  - get_user_stage(user_id, module) — 读取当前阶段
  - advance_stage(user_id, module, next_stage) — 推进阶段
  - resume_flow(user_id, module) — 恢复中断的流程
  - can_transition(user_id, module, from_stage, to_stage) — 校验跳转合法性

三大流程状态机:
  朝有规划 6步: greeting → inventory → prioritize → classify → confirm → archive
  暮有复盘 5阶段: greeting → inventory → extraction → improvement → archive
  情绪树洞 4阶段: vent → reflect → reframe → growth

设计原则:
  - 阶段跳转由程序控制，模型只负责填充当前阶段的内容
  - 禁止 AI 自行决定阶段跳转
  - 中断恢复时允许从任何 active 阶段继续
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from ..shared.models.flow_state import (
    MODULE_STAGES,
    MORNING_PLAN_STAGES,
    EVENING_REVIEW_STAGES,
    EMOTION_TREEHOLE_STAGES,
    FlowState,
)

logger = logging.getLogger("flow_state_machine")


def _get_stages(module: str) -> list[str]:
    """获取模块的阶段列表。"""
    stages = MODULE_STAGES.get(module)
    if not stages:
        raise ValueError(f"未知模块: {module}，可用模块: {list(MODULE_STAGES.keys())}")
    return stages


def _get_or_create_flow(db, user_id: str, module: str) -> FlowState:
    """获取或创建用户的流程状态记录。

    如果已有 active 状态的记录则返回，否则创建新记录从第一步开始。
    """
    flow = db.query(FlowState).filter(
        FlowState.user_id == user_id,
        FlowState.module == module,
        FlowState.status == "active",
    ).first()

    if not flow:
        stages = _get_stages(module)
        flow = FlowState(
            user_id=user_id,
            module=module,
            current_stage=stages[0],
            stages_completed=[],
            stage_entered_at=datetime.now(timezone.utc),
            metadata_json={},
            status="active",
        )
        db.add(flow)
        db.commit()
        db.refresh(flow)
        logger.info("新流程: user=%s module=%s stage=%s", user_id[:8], module, stages[0])

    return flow


def get_user_stage(db, user_id: str, module: str) -> dict[str, Any]:
    """读取用户当前流程阶段。

    Returns:
        {
            "module": str,
            "current_stage": str,
            "stage_index": int,
            "total_stages": int,
            "stages_completed": list[str],
            "is_active": bool,
            "stage_entered_at": str | None,
            "metadata": dict,
        }
    """
    stages = _get_stages(module)
    flow = db.query(FlowState).filter(
        FlowState.user_id == user_id,
        FlowState.module == module,
        FlowState.status == "active",
    ).first()

    if not flow:
        return {
            "module": module,
            "current_stage": stages[0],
            "stage_index": 0,
            "total_stages": len(stages),
            "stages_completed": [],
            "is_active": False,
            "stage_entered_at": None,
            "metadata": {},
        }

    try:
        stage_index = stages.index(flow.current_stage)
    except ValueError:
        stage_index = 0

    return {
        "module": module,
        "current_stage": flow.current_stage,
        "stage_index": stage_index,
        "total_stages": len(stages),
        "stages_completed": flow.stages_completed or [],
        "is_active": True,
        "stage_entered_at": flow.stage_entered_at.isoformat() if flow.stage_entered_at else None,
        "metadata": flow.metadata_json or {},
    }


def can_transition(db, user_id: str, module: str,
                   from_stage: str | None = None,
                   to_stage: str | None = None) -> bool:
    """检查是否允许从 from_stage 跳转到 to_stage。

    规则：
    - 只能向前推进，不能后退
    - 只能跳转到相邻的下一阶段
    - to_stage 为 None 时检查是否已到达最后阶段

    Args:
        from_stage: 当前阶段（None=自动从DB读取）
        to_stage: 目标阶段（None=检查是否可推进到下一阶段）

    Returns:
        True 如果跳转合法
    """
    stages = _get_stages(module)

    if from_stage is None:
        flow_state = get_user_stage(db, user_id, module)
        from_stage = flow_state["current_stage"]

    try:
        current_idx = stages.index(from_stage)
    except ValueError:
        return False

    if to_stage is None:
        # 检查是否还有下一阶段
        return current_idx + 1 < len(stages)

    try:
        target_idx = stages.index(to_stage)
    except ValueError:
        return False

    # 只能向前推进到相邻阶段
    return target_idx == current_idx + 1


def advance_stage(db, user_id: str, module: str, next_stage: str | None = None) -> dict[str, Any]:
    """推进到下一阶段。

    如果 next_stage 未指定，自动推进到当前阶段的下一阶段。
    如果已到达最后阶段，自动标记 completed。

    Returns:
        更新后的阶段状态
    """
    stages = _get_stages(module)
    flow = _get_or_create_flow(db, user_id, module)

    current_stage = flow.current_stage
    try:
        current_idx = stages.index(current_stage)
    except ValueError:
        current_idx = 0

    # 确定下一阶段
    if next_stage is None:
        if current_idx + 1 >= len(stages):
            # 已到达最后阶段 → 标记完成
            flow.status = "completed"
            flow.stages_completed = (flow.stages_completed or []) + [current_stage]
            db.commit()
            logger.info("流程完成: user=%s module=%s", user_id[:8], module)
            return get_user_stage(db, user_id, module)
        next_stage = stages[current_idx + 1]
    else:
        # 校验跳转合法性
        if not can_transition(db, user_id, module, current_stage, next_stage):
            raise ValueError(
                f"非法阶段跳转: {module} {current_stage} → {next_stage}。"
                f"只能向前推进到相邻阶段。"
            )

    # 推进
    completed = list(flow.stages_completed or [])
    if current_stage not in completed:
        completed.append(current_stage)

    flow.current_stage = next_stage
    flow.stages_completed = completed
    flow.stage_entered_at = datetime.now(timezone.utc)
    db.commit()

    logger.info(
        "阶段推进: user=%s module=%s %s → %s",
        user_id[:8], module, current_stage, next_stage,
    )

    return get_user_stage(db, user_id, module)


def resume_flow(db, user_id: str, module: str) -> dict[str, Any]:
    """恢复中断的流程。

    如果用户有 active 状态的流程，返回当前阶段。
    如果用户之前完成过此流程（completed），自动创建新流程从第一步开始。
    如果用户从未有此流程，创建新流程从第一步开始。

    Returns:
        {"mode": "resume"|"restart"|"new", "stage": dict, "message": str}
    """
    flow = db.query(FlowState).filter(
        FlowState.user_id == user_id,
        FlowState.module == module,
        FlowState.status == "active",
    ).first()

    if flow:
        stage_info = get_user_stage(db, user_id, module)
        return {
            "mode": "resume",
            "stage": stage_info,
            "message": f"正在恢复之前中断的流程，当前在 {flow.current_stage} 阶段",
        }

    # 检查是否有已完成的记录
    completed_flow = db.query(FlowState).filter(
        FlowState.user_id == user_id,
        FlowState.module == module,
        FlowState.status == "completed",
    ).first()

    if completed_flow:
        # 已完成 → 重新开始
        db.delete(completed_flow)
        db.commit()

    # 创建新流程
    stage_info = get_user_stage(db, user_id, module)
    stages = _get_stages(module)
    return {
        "mode": "new",
        "stage": stage_info,
        "message": f"开始新的流程，从 {stages[0]} 阶段开始",
    }


def update_metadata(db, user_id: str, module: str, metadata: dict[str, Any]) -> None:
    """更新流程的元数据（如情绪评分、萃取内容等模块特定数据）。"""
    flow = db.query(FlowState).filter(
        FlowState.user_id == user_id,
        FlowState.module == module,
        FlowState.status == "active",
    ).first()

    if flow:
        existing = flow.metadata_json or {}
        existing.update(metadata)
        flow.metadata_json = existing
        db.commit()


# ═══════════════════════════════════════════════
# 装饰器：阶段守卫
# ═══════════════════════════════════════════════

def validate_stage(module: str, expected_stage: str):
    """阶段守卫装饰器 — 用于 FastAPI 端点。

    检查用户当前是否处于 expected_stage，不匹配时返回 400 错误。

    用法:
        @router.post("/reviews/chat")
        @validate_stage("er", "greeting")
        def review_chat(...):
            ...
    """
    import functools
    from ..shared.database import get_db
    from ..shared.errors import APIError

    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # 尝试从 kwargs 中提取 user 和 db
            user = kwargs.get("user")
            db = kwargs.get("db")
            if user and db:
                stage_info = get_user_stage(db, user.user_id, module)
                if stage_info["current_stage"] != expected_stage:
                    raise APIError(
                        40050,
                        f"当前阶段为 {stage_info['current_stage']}，"
                        f"不允许在 {expected_stage} 阶段执行此操作",
                        400,
                    )
            return func(*args, **kwargs)
        return wrapper
    return decorator
