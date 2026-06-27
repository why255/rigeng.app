"""拿下一个客户服务 — 路由层（步骤22 / Wave 4）。

API 端点：
  GET    /acquire/transition/check        — 检测转型信号
  POST   /acquire/diagnosis/start         — 开始自我诊断
  POST   /acquire/diagnosis/answer        — 提交访谈答案
  POST   /acquire/diagnosis/review        — 老师审核诊断
  POST   /acquire/intel/collect           — 采集企业情报（老师）
  POST   /acquire/intel/review            — 老师审核情报
  POST   /acquire/intel/deliver           — 交付情报给用户
  POST   /acquire/strategy/generate       — 生成面谈策略
  POST   /acquire/strategy/review         — 老师审核策略
  POST   /acquire/meeting/start           — 开始面谈
  POST   /acquire/meeting/{id}/analyze    — 分析面谈达成率
  GET    /acquire/meeting/{id}            — 获取面谈详情
  GET    /acquire/negotiations/{id}       — 获取多轮谈判
  POST   /acquire/negotiations/next-round — 生成下一轮策略
  POST   /acquire/roleplay/start          — 开始角色扮演
  POST   /acquire/roleplay/turn           — 角色扮演回合
  POST   /acquire/roleplay/{id}/score     — 评分角色扮演
  POST   /acquire/roleplay/{id}/expert    — 切换专家角色
  POST   /acquire/roleplay/{id}/teacher   — 切换老师角色
  POST   /acquire/proposal/generate       — 生成提案框架
  POST   /acquire/contract/upload         — 上传签约合同
  GET    /acquire/compliance              — 获取合规提示状态
  POST   /acquire/compliance/accept       — 确认合规提示
  GET    /acquire/diagnoses               — 诊断列表
  GET    /acquire/intels                  — 情报列表
  GET    /acquire/meetings                — 面谈列表
  GET    /acquire/roleplays               — 角色扮演列表
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ...shared.database import get_db
from ...shared.response import ok
from ...shared.security import CurrentUser, get_current_user
from . import service
from .schemas import (
    CompanyIntelRequest,
    ContractUploadRequest,
    DiagnosisReviewRequest,
    IntelDeliverRequest,
    IntelReviewRequest,
    InterviewAnswer,
    MeetingRecordRequest,
    MeetingStrategyRequest,
    NextRoundStrategyRequest,
    ProposalGenerateRequest,
    RoleplayRoleSwitchRequest,
    RoleplayStartRequest,
    RoleplayTurnRequest,
    SelfDiagnosisRequest,
    StrategyReviewRequest,
    TransitionTriggerRequest,
)

router = APIRouter(tags=["拿下一个客户"], prefix="/acquire")


# ═══════════════════════════════════════════════
# 1. 智能转型触发
# ═══════════════════════════════════════════════

@router.get("/transition/check")
def check_transition(
    context_text: str = Query(..., description="对话上下文文本"),
    conversation_id: str | None = Query(None),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """检测转型信号：从日常对话中扫描转型意图，温和引导。"""
    return ok(service.detect_transition_signal(
        db, user.user_id, context_text, conversation_id,
    ))


# ═══════════════════════════════════════════════
# 2. 自我诊断
# ═══════════════════════════════════════════════

@router.post("/diagnosis/start")
def start_diagnosis(
    body: SelfDiagnosisRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """开始自我诊断：上传简历 + 生成引导访谈问题。"""
    return ok(service.start_self_diagnosis(
        db, user.user_id, body.resume_url, body.interview_mode,
    ))


@router.post("/diagnosis/answer")
def submit_answer(
    body: InterviewAnswer,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """提交访谈答案。所有问题回答完毕后自动生成诊断报告。"""
    return ok(service.submit_interview_answer(
        db, user.user_id, body.diagnosis_id, body.question_id, body.answer,
    ))


@router.post("/diagnosis/review")
def review_diagnosis(
    body: DiagnosisReviewRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """老师审核诊断报告（确认或驳回）。"""
    return ok(service.teacher_review_diagnosis(
        db, user.user_id, body.diagnosis_id, body.action, body.teacher_notes,
    ))


@router.get("/diagnoses")
def list_diagnoses(
    status: str | None = Query(None),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取用户的诊断列表。"""
    return ok(service.list_diagnoses(db, user.user_id, status))


# ═══════════════════════════════════════════════
# 3. 客户情报采集（老师后台）
# ═══════════════════════════════════════════════

@router.post("/intel/collect")
def collect_intel(
    body: CompanyIntelRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """AI采集企业情报（老师后台）：基于公开信息2-3分钟生成初稿。"""
    return ok(service.collect_company_intel(
        db, user.user_id, body.company_name,
        body.company_aliases, body.user_id,
    ))


@router.post("/intel/review")
def review_intel(
    body: IntelReviewRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """老师审核企业情报（通过/驳回/修改）。"""
    return ok(service.review_company_intel(
        db, user.user_id, body.intel_id, body.action,
        body.teacher_notes, body.modified_report,
    ))


@router.post("/intel/deliver")
def deliver_intel(
    body: IntelDeliverRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """交付审核通过的情报给用户。"""
    return ok(service.deliver_company_intel(
        db, user.user_id, body.intel_id,
    ))


@router.get("/intels")
def list_intels(
    status: str | None = Query(None),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取用户的情报列表。"""
    return ok(service.list_intels(db, user.user_id, status))


# ═══════════════════════════════════════════════
# 4. 面谈策略
# ═══════════════════════════════════════════════

@router.post("/strategy/generate")
def generate_strategy(
    body: MeetingStrategyRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """生成面谈策略文档+提纲：基于情报和诊断。"""
    return ok(service.generate_meeting_strategy(
        db, user.user_id, body.intel_id, body.diagnosis_id, body.meeting_type,
    ))


@router.post("/strategy/review")
def review_strategy(
    body: StrategyReviewRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """老师审核面谈策略（通过/驳回/修改）。"""
    return ok(service.review_meeting_strategy(
        db, user.user_id, body.strategy_id, body.action,
        body.teacher_notes, body.modified_strategy,
    ))


# ═══════════════════════════════════════════════
# 5. 客户面谈
# ═══════════════════════════════════════════════

@router.post("/meeting/start")
def start_meeting(
    body: MeetingRecordRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """开始客户面谈：关联智能记录录音，标记'拿下一个客户'场景。"""
    return ok(service.start_client_meeting(
        db, user.user_id, body.strategy_id, body.recording_id,
        body.client_name, body.client_position,
        body.meeting_date, body.round_num,
    ))


@router.post("/meeting/{meeting_id}/analyze")
def analyze_meeting(
    meeting_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """面谈达成率逐条分析：亮点/改进/复盘SOP。"""
    return ok(service.analyze_meeting_achievement(db, user.user_id, meeting_id))


@router.get("/meeting/{meeting_id}")
def get_meeting(
    meeting_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取面谈详情。"""
    return ok(service.get_client_meeting(db, user.user_id, meeting_id))


@router.get("/meetings")
def list_meetings(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取用户的面谈列表。"""
    return ok(service.list_meetings(db, user.user_id))


# ═══════════════════════════════════════════════
# 6. 多轮谈判
# ═══════════════════════════════════════════════

@router.get("/negotiations/{meeting_id}")
def get_negotiations(
    meeting_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取多轮谈判详情：每轮独立的策略→执行→复盘。"""
    return ok(service.manage_negotiation_rounds(db, user.user_id, meeting_id))


@router.post("/negotiations/next-round")
def next_round_strategy(
    body: NextRoundStrategyRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """从复盘生成下一轮谈判策略。"""
    return ok(service.generate_next_round_strategy(
        db, user.user_id, body.meeting_id, body.focus_areas,
    ))


# ═══════════════════════════════════════════════
# 7. 角色转换模拟训练
# ═══════════════════════════════════════════════

@router.post("/roleplay/start")
def start_roleplay(
    body: RoleplayStartRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """开始角色扮演训练：小耕扮演客户角色，用户扮演顾问。"""
    return ok(service.start_roleplay(
        db, user.user_id, body.scenario_type,
        body.client_company, body.client_position,
        body.client_personality, body.client_pain_points,
        body.custom_context,
    ))


@router.post("/roleplay/turn")
def roleplay_turn(
    body: RoleplayTurnRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """角色扮演回合：用户发言 → 小耕（客户角色）回复。"""
    return ok(service.roleplay_turn(
        db, user.user_id, body.session_id, body.user_message,
    ))


@router.post("/roleplay/{session_id}/score")
def score_roleplay(
    session_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """角色扮演评分：A维度（关键词命中率）+ B维度（四维评分）+ 综合。"""
    return ok(service.score_roleplay(db, user.user_id, session_id))


@router.post("/roleplay/{session_id}/expert")
def roleplay_expert(
    session_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """切换角色：小耕切换为专家评估者角色。"""
    return ok(service.roleplay_as_expert(db, user.user_id, session_id))


@router.post("/roleplay/{session_id}/teacher")
def roleplay_teacher(
    session_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """切换角色：小耕切换为老师引导者角色。"""
    return ok(service.roleplay_as_teacher(db, user.user_id, session_id))


@router.get("/roleplays")
def list_roleplays(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取用户的角色扮演列表。"""
    return ok(service.list_roleplay_sessions(db, user.user_id))


# ═══════════════════════════════════════════════
# 8. 提案生成
# ═══════════════════════════════════════════════

@router.post("/proposal/generate")
def generate_proposal(
    body: ProposalGenerateRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """从面谈分析生成初步提案框架。"""
    return ok(service.generate_proposal_framework(
        db, user.user_id, body.meeting_id, body.proposal_type,
        body.custom_requirements,
    ))


# ═══════════════════════════════════════════════
# 9. 签约合同
# ═══════════════════════════════════════════════

@router.post("/contract/upload")
def upload_contract(
    body: ContractUploadRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """上传签约合同 → 自动同步到打磨产品模块。"""
    return ok(service.upload_contract(
        db, user.user_id, body.contract_url, body.meeting_id,
        body.contract_title, body.contract_amount,
        body.client_company, body.service_list,
    ))


# ═══════════════════════════════════════════════
# 10. 合规提示
# ═══════════════════════════════════════════════

@router.get("/compliance")
def compliance_status(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取合规提示状态（首次使用弹窗率100%）。"""
    return ok(service.get_compliance_reminder(db, user.user_id))


@router.post("/compliance/accept")
def accept_compliance(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """用户确认合规提示。"""
    return ok(service.accept_compliance_reminder(db, user.user_id))
