"""高维求职服务 — 路由层（步骤20 / Wave 4）。

五步法全流程 API端点：
  一盘: POST /career/resume/file (上传PDF/Word), POST /career/resume/upload, POST /career/star/extract
  二定: POST /career/strategy
  三投: POST /career/applications, GET /career/applications
  四面: POST /career/interview/prepare, POST /career/interview/record,
        POST /career/interview/{id}/analyze, GET /career/interview/preps
  五选: POST /career/offers/compare, POST /career/offers/{id}/accept

  技能晶体: GET /career/skill-crystals, POST /career/skill-crystals/{id}/archive
  企业情报: POST /career/company-intel
  进度: GET /career/progress, GET /career/step/{step_id}
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy.orm import Session

from ...shared.database import get_db
from ...shared.response import ok
from ...shared.security import CurrentUser, get_current_user
from . import service
from .schemas import (
    ApplicationTrackingRequest,
    CareerChatIn,
    CompanyIntelRequest,
    InterviewPrepRequest,
    InterviewRecordingLinkRequest,
    JobStrategyRequest,
    OfferAcceptRequest,
    OfferComparisonRequest,
    ResumeUploadRequest,
    STARExtractionRequest,
)

router = APIRouter(tags=["高维求职"], prefix="/career")


# ═══════════════════════════════════════════════
# 一盘：简历盘点与重构
# ═══════════════════════════════════════════════

@router.post("/resume/upload")
def upload_resume(
    body: ResumeUploadRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """上传简历：创建/重置五步法进度，进入步骤1（简历盘点与重构）。"""
    return ok(service.upload_resume(
        db, user.user_id, body.title, body.content, body.file_object_id,
    ))


@router.post("/resume/file")
async def upload_resume_file(
    file: UploadFile = File(...),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """上传简历文件（PDF/Word）并AI自动解析。

    支持格式: .pdf, .doc, .docx
    上传后自动：
      1. 提取文本内容
      2. AI解析简历结构（技能/经验/教育等）
      3. 创建/更新五步法进度
      4. 返回解析结果供前端展示
    """
    file_bytes = await file.read()
    filename = file.filename or "resume.pdf"

    data = service.process_resume_file(
        db, user.user_id, file_bytes, filename,
    )
    return ok(data)


@router.post("/star/extract")
def star_extraction(
    body: STARExtractionRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """STAR四要素萃取：引导用户补充情境/任务/行动/结果，完整率≥85%。"""
    return ok(service.star_extraction(
        db, user.user_id, body.career_progress_id,
        body.situation, body.task, body.action, body.result,
        body.quantified_value, body.source_type,
    ))


# ═══════════════════════════════════════════════
# 技能晶体
# ═══════════════════════════════════════════════

@router.get("/skill-crystals")
def list_skill_crystals(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """列出用户的所有技能晶体。"""
    return ok(service.list_skill_crystals(db, user.user_id))


@router.post("/skill-crystals/{crystal_id}/archive")
def archive_skill_crystal(
    crystal_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """归档技能晶体到私有知识库。删除求职记录不影响已归档晶体。"""
    return ok(service.archive_skill_crystal(db, user.user_id, crystal_id))


# ═══════════════════════════════════════════════
# 二定：求职策略与资源
# ═══════════════════════════════════════════════

@router.post("/strategy")
def create_job_strategy(
    body: JobStrategyRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """创建求职策略：生成资源清单+求职计划表，推进到步骤2。"""
    return ok(service.create_job_strategy(
        db, user.user_id, body.career_progress_id,
        body.target_industry, body.target_position,
        body.salary_range, body.location, body.preferences,
    ))


# ═══════════════════════════════════════════════
# 三投：投递追踪与分析
# ═══════════════════════════════════════════════

@router.post("/applications")
def track_application(
    body: ApplicationTrackingRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """记录投递：创建投递记录，自动计算邀约率，推进到步骤3。"""
    return ok(service.track_application(
        db, user.user_id, body.career_progress_id,
        body.channel, body.position, body.company, body.date,
        body.status, body.invite_received, body.notes,
    ))


@router.get("/applications")
def list_applications(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取所有投递记录及统计（总数、各状态数量、邀约率）。"""
    return ok(service.list_applications(db, user.user_id))


# ═══════════════════════════════════════════════
# 四面：面试准备与复盘
# ═══════════════════════════════════════════════

@router.post("/interview/prepare")
def prepare_interview(
    body: InterviewPrepRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """面试准备：生成企业情报+匹配度分析+面试策略+问题清单，推进到步骤4。"""
    return ok(service.prepare_interview(
        db, user.user_id, body.career_progress_id,
        body.application_id, body.company, body.position,
        body.interview_stage,
    ))


@router.post("/interview/record")
def link_interview_recording(
    body: InterviewRecordingLinkRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """关联智能记录录音到求职面试，使用"高维求职"场景标记。"""
    return ok(service.start_interview_recording(
        db, user.user_id, body.prep_id, body.recording_id,
    ))


@router.post("/interview/{review_id}/analyze")
def analyze_interview(
    review_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """面试复盘分析：基于录音AI分析面试表现，产出亮点/改进/复盘SOP。"""
    return ok(service.analyze_interview(db, user.user_id, review_id))


@router.get("/interview/preps")
def list_interview_preps(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """列出所有面试准备记录。"""
    return ok(service.list_interview_preps(db, user.user_id))


# ═══════════════════════════════════════════════
# 五选：Offer评估与入职
# ═══════════════════════════════════════════════

@router.post("/offers/compare")
def compare_offers(
    body: OfferComparisonRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Offer多维度对比：薪资/职级/发展空间/通勤/文化/稳定性，不替用户做决策。"""
    offers_dicts = [o.model_dump() for o in body.offers]
    return ok(service.compare_offers(
        db, user.user_id, body.career_progress_id,
        offers_dicts, body.notes,
    ))


@router.post("/offers/{comparison_id}/accept")
def accept_offer(
    comparison_id: str,
    body: OfferAcceptRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """接受Offer：选择Offer并生成试用期30/60/90天计划。合同在平台外签署。"""
    return ok(service.accept_offer(
        db, user.user_id, comparison_id, body.selected_offer_label,
    ))


# ═══════════════════════════════════════════════
# 企业情报（老师后台）
# ═══════════════════════════════════════════════

@router.post("/company-intel")
def get_company_intel(
    body: CompanyIntelRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """AI辅助企业情报采集（仅公开信息源，初稿≤3分钟，老师最终核实）。"""
    teacher_id = user.user_id if user.role in ("teacher", "operator", "superadmin") else None
    return ok(service.get_company_intel(
        db, teacher_id, body.company_name, body.user_id,
    ))


# ═══════════════════════════════════════════════
# AI 高维求职对话 — 所有小耕输出由AI模型生成
# ═══════════════════════════════════════════════

@router.post("/chat")
def career_chat(
    body: CareerChatIn,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """高维求职 AI 对话 — 所有小耕回复由AI模型生成。

    AI根据当前五步法步骤（yipan/erding/santou/simian/wuxuan）
    和子进度，按算法引导用户完成求职全流程。
    """
    data = service.process_career_chat(
        message=body.message,
        step=body.step,
        context=body.context,
        sub_index=body.sub_index,
        has_resume=body.has_resume,
        user_id=user.user_id,
        db=db,
    )
    return ok(data)


# ═══════════════════════════════════════════════
# 五步法进度查询
# ═══════════════════════════════════════════════

@router.get("/progress")
def get_progress(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取五步法整体进度：当前步骤、各步骤详细状态、老师分配情况。"""
    return ok(service.get_five_step_progress(db, user.user_id))


@router.get("/step/{step_id}")
def get_step_detail(
    step_id: int,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取指定步骤的详细信息（步骤1-5）。"""
    return ok(service.get_step_data(db, user.user_id, step_id))
