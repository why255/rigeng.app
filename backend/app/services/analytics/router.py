"""⑦数据仪表盘服务 — 路由层。"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ...shared.database import get_db
from ...shared.response import ok
from ...shared.security import CurrentUser, get_current_user
from . import schemas, service

router = APIRouter(prefix="/analytics", tags=["⑦数据仪表盘"])


@router.get("/kpi")
def get_kpi(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """核心指标仪表盘。"""
    return ok(service.get_kpi(db, user.user_id))


@router.get("/trend")
def get_trend(
    metric_type: str = Query("completion_rate"),
    days: int = Query(7, ge=1, le=365),
    dimension: str | None = Query(None),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """趋势时序数据。"""
    return ok(service.get_trend(db, user.user_id, metric_type, days, dimension))


@router.get("/trend/detail")
def get_trend_detail(
    period: str = Query("week", pattern="^(week|month)$"),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """趋势详细版（双维度）。"""
    return ok(service.get_trend_detail(db, user.user_id, period))


@router.get("/distribution")
def get_distribution(
    dimension: str = Query("module"),
    from_date: str | None = Query(None),
    to_date: str | None = Query(None),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """按维度分布统计。"""
    return ok(service.get_distribution(db, user.user_id, dimension, from_date, to_date))


@router.get("/comparison")
def get_comparison(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """双时段对比（本周 vs 上周）。"""
    return ok(service.get_comparison(db, user.user_id))


@router.get("/sop/weekly")
def get_sop_weekly(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """每周SOP产量。"""
    return ok(service.get_sop_weekly(db, user.user_id))


@router.get("/contribution")
def get_contribution(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """模块贡献度分布。"""
    return ok(service.get_contribution(db, user.user_id))


@router.get("/composition")
def get_composition(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """指标构成饼图数据。"""
    return ok(service.get_composition(db, user.user_id))


@router.get("/emotion")
def get_emotion(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """情绪评分趋势。"""
    return ok(service.get_emotion(db, user.user_id))


@router.get("/alerts")
def get_alerts(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """预警列表。"""
    return ok(service.get_alerts(db, user.user_id))


@router.get("/diagnosis")
def get_diagnosis(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """双向诊断：根据真实完成率返回正向激励或温暖关怀（步骤13）。"""
    return ok(service.get_diagnosis(db, user.user_id))


@router.get("/recommendations")
def get_recommendations(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """推荐服务。"""
    return ok(service.get_recommendations(db, user.user_id))


# ═══════════════════════════════════════════════════════════════
# Step 25 / Wave 5 — 全量扩展端点
# ═══════════════════════════════════════════════════════════════

# ── Dashboard & Drilldown ──

@router.get("/dashboard/full")
def get_full_dashboard(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """全量11模块仪表盘。"""
    return ok(service.get_full_dashboard(db, user.user_id))


@router.get("/drilldown/{metric_key}")
def drill_down(
    metric_key: str,
    level: int = Query(1, ge=1, le=3),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """三级下钻：大盘→模块→日明细→源头数据。"""
    return ok(service.drill_down(db, user.user_id, metric_key, level))


# ── Emotion ──

@router.get("/emotion/index")
def get_emotion_index(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """情绪健康指数（-10 ~ +10）。"""
    return ok(service.calculate_emotion_index(db, user.user_id))


@router.get("/emotion/curve")
def get_emotion_curve(
    period: str = Query("daily", pattern=r"^(daily|weekly|monthly|yearly)$"),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """情绪曲线（日/周/月/年）。"""
    return ok(service.generate_emotion_curve(db, user.user_id, period))


@router.post("/emotion/score")
def submit_emotion_score(
    body: schemas.EmotionScoreRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """用户每日自评情绪。"""
    return ok(service.submit_emotion_score(db, user.user_id, body.score, body.note))


@router.post("/emotion/appeal")
def appeal_emotion_score(
    body: schemas.EmotionAppealRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """用户申诉系统计算的评分。"""
    return ok(service.appeal_emotion_score(
        db, user.user_id, body.date, body.corrected_score, body.reason
    ))


# ── Care ──

@router.post("/care/positive/trigger")
def trigger_positive_care(
    body: schemas.CareTriggerRequest | None = None,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """手动触发正向关怀检查。"""
    target_id = body.target_user_id if body else None
    return ok(service.check_positive_triggers(db, target_id or user.user_id, force=True))


@router.post("/care/negative/trigger")
def trigger_negative_care(
    body: schemas.CareTriggerRequest | None = None,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """触发放反向关怀检查。"""
    target_id = body.target_user_id if body else None
    return ok(service.check_negative_triggers(db, target_id or user.user_id, force=True))


@router.get("/care/push-log")
def get_care_push_log(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """关怀推送历史。"""
    return ok(service.get_care_push_log(db, user.user_id))


@router.put("/care/mode")
def switch_care_mode(
    body: schemas.CareModeToggleRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """切换关怀模式（active / passive）。"""
    return ok(service.switch_care_mode(db, user.user_id, body.mode))


# ── Teacher Bridge ──

@router.post("/teacher/bridge")
def trigger_teacher_bridge(
    body: schemas.TeacherBridgeRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """触发老师架桥匹配推荐。"""
    return ok(service.bridge_teacher(
        db, user.user_id, body.industry, body.problem_area, body.urgency
    ))


# ── Mobile ──

@router.get("/mobile/summary")
def get_mobile_summary(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """移动端友好摘要卡片。"""
    return ok(service.get_mobile_summary(db, user.user_id))


@router.post("/mobile/voice-report")
def generate_voice_report(
    body: schemas.VoiceReportRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """语音播报核心指标。"""
    return ok(service.voice_broadcast_core_metrics(db, user.user_id, body.sections))
