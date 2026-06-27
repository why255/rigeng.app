"""复盘服务 路由层（步骤11：暮有复盘全部API端点）。"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...shared.database import get_db
from ...shared.response import ok
from ...shared.security import CurrentUser, get_current_user
from . import service
from .schemas import DiagnoseIn, SaveMessageIn, SopIn

router = APIRouter(tags=["暮有复盘"])


@router.get("/reviews/stats")
def stats(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """获取今日复盘统计数据（P1 入口页）。"""
    data = service.get_review_stats(db, user_id=user.user_id)
    return ok(data)


@router.get("/reviews/yesterday-summary")
def yesterday_summary(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """获取昨日复盘摘要（P1 入口页）。"""
    data = service.get_yesterday_summary(db, user_id=user.user_id)
    return ok(data)


@router.post("/reviews/messages")
def save_message(body: SaveMessageIn, user: CurrentUser = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    """保存复盘对话记录（P2 对话页每个阶段结束时触发）。

    自动检测用户拒绝意图，触发温柔坚持机制：
    - 第一次拒绝：返回温柔坚持回复，鼓励用户继续
    - 温柔坚持已用过后再拒绝：尊重用户选择，允许跳过
    """
    data = service.save_review_message(
        db, user_id=user.user_id, stage=body.stage,
        messages=body.messages, emotion_score=body.emotion_score,
        courage_value=body.courage_value,
    )
    return ok(data)


@router.post("/reviews/sop")
def save_sop(body: SopIn, user: CurrentUser = Depends(get_current_user),
             db: Session = Depends(get_db)):
    """生成/保存 SOP（P2 对话页进入归档阶段时触发）。

    自动将SOP归档到知识库（跨模块数据流：复盘→知识库归档）。
    归档失败不阻断SOP保存（降级策略）。
    """
    steps_in = [s.model_dump() for s in body.steps]
    data = service.save_sop(
        db, user_id=user.user_id, title=body.title, steps=steps_in,
        key_phrases=body.key_phrases, precautions=body.precautions,
    )
    return ok(data)


@router.get("/reviews/sop/today")
def today_sop(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """获取今日生成的 SOP（P3 报告页）。"""
    data = service.get_today_sop(db, user_id=user.user_id)
    return ok(data)


@router.post("/reviews/diagnosis")
def submit_diagnosis(body: DiagnoseIn, user: CurrentUser = Depends(get_current_user),
                     db: Session = Depends(get_db)):
    """提交诊断问卷（P3 报告页）。"""
    data = service.submit_diagnosis(db, user_id=user.user_id, answers=body.model_dump())
    return ok(data)


@router.post("/reviews/archive")
def archive(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """归档今日复盘（P3 报告页）。"""
    data = service.archive_review(db, user_id=user.user_id)
    return ok(data)


@router.get("/reviews/weekly-progress")
def weekly_progress(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """获取本周复盘进度（P4 历史页）。"""
    data = service.get_weekly_progress(db, user_id=user.user_id)
    return ok(data)


@router.get("/reviews/history")
def history(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    """获取历史复盘列表（P4 历史页）。"""
    data = service.get_review_history(db, user_id=user.user_id)
    return ok(data)


# ── 步骤11 新增端点 ──

@router.get("/reviews/non-review-reminders")
def non_review_reminders(user: CurrentUser = Depends(get_current_user),
                          db: Session = Depends(get_db)):
    """检查连续未复盘天数及应触发的提醒（步骤11：连续未复盘提醒）。

    返回：
    - consecutive_skip_days: 连续未复盘天数
    - reminders: 应触发的提醒列表（3天App推送/5天短信/7天运营官介入）
    - needs_attention: 是否需要关注（≥3天）
    """
    data = service.check_non_review_reminders(db, user_id=user.user_id)
    return ok(data)
