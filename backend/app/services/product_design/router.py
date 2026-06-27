"""打磨一套产品服务 — 路由层（步骤23 / Wave 5）。

API 端点（ABS模型驱动方案生成）：
  POST   /product-design/enter                — 选择双路径准入
  POST   /product-design/demand/decompose     — 需求分解（上游数据接入）
  POST   /product-design/diagnosis/v1         — 生成诊断报告1.0（系统）
  POST   /product-design/diagnosis/v2         — 老师增强诊断2.0
  POST   /product-design/targets/set          — B阶段量化目标设定
  POST   /product-design/solutions/generate   — S阶段三源调用→A/B方案
  POST   /product-design/solutions/select     — 选择最终版本
  POST   /product-design/solutions/export     — 导出方案
  POST   /product-design/solutions/annotate   — 标注制度升级来源
  POST   /product-design/pre-research/create   — 产品预研创建
  POST   /product-design/solutions/reuse      — 跨客户方案复用
  POST   /product-design/coaching/book        — 老师辅导预约

关键规则：
  - 绝对禁止跳过A→B直接S
  - 方案版本命名仅A/B版
  - 客户文档不用于模型训练
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...shared.database import get_db
from ...shared.response import ok
from ...shared.security import CurrentUser, get_current_user
from . import service
from .schemas import (
    CoachingSessionRequest,
    DemandAnalysisRequest,
    DiagnosticQuestionnaireRequest,
    ProductEntryRequest,
    ProductPreResearchRequest,
    SolutionExportRequest,
    SolutionGenerateRequest,
    SolutionReuseRequest,
    TeacherEnhanceRequest,
    TargetSettingRequest,
    VersionSelectRequest,
)

router = APIRouter(tags=["打磨一套产品"], prefix="/product-design")


# ═══════════════════════════════════════════════
# 双路径准入
# ═══════════════════════════════════════════════

@router.post("/enter")
def enter(
    body: ProductEntryRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """选择产品方案入口路径：完整ABS 或 产品预研。

    - full_abs: 有合同/服务清单，走完整ABS流程
    - pre_research: 无合同，模板化快速产出通用产品
    """
    return ok(service.enter_product_design(
        db, user.user_id, body.entry_type,
        body.title, body.contract_ref,
        body.client_name, body.client_industry,
    ))


# ═══════════════════════════════════════════════
# 需求分解
# ═══════════════════════════════════════════════

@router.post("/demand/decompose")
def decompose_demand(
    body: DemandAnalysisRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """上游数据接入：合同+服务清单 → 自动分解 → HR八大模块映射。

    自动识别合同文本中的关键词，将服务清单逐项映射到最相关的HR模块。
    未能自动映射的条目归入 unmapped_items 供人工处理。
    """
    return ok(service.decompose_requirements(
        db, user.user_id, body.project_id,
        body.contract_text, body.service_items,
    ))


# ═══════════════════════════════════════════════
# A阶段：诊断
# ═══════════════════════════════════════════════

@router.post("/diagnosis/v1")
def diagnosis_v1(
    body: DiagnosticQuestionnaireRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """A阶段第一步：系统基于标准化问卷生成诊断报告1.0。

    诊断数据不完整时自动标注"因数据不足暂未评估"。
    报告包含：现状总览、强项、弱项、差距分析、改进建议。
    """
    answers = [a.model_dump() for a in body.answers] if body.answers else []
    return ok(service.generate_diagnosis_v1(
        db, user.user_id, body.project_id, answers,
    ))


@router.post("/diagnosis/v2")
def diagnosis_v2(
    body: TeacherEnhanceRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """A阶段第二步：老师下载1.0报告 → 优化增强 → 产出2.0诊断报告。

    老师可对1.0报告的任意段落进行增强、修正、补充。
    2.0报告的parent_report_id指向1.0，实现版本追溯。
    完成后项目自动进入B阶段（目标设定）。
    """
    enhanced_sections = [s.model_dump() for s in body.enhanced_sections] if body.enhanced_sections else []
    return ok(service.teacher_enhance_diagnosis(
        db, user.user_id, body.report_id,
        body.teacher_notes, enhanced_sections,
    ))


# ═══════════════════════════════════════════════
# B阶段：目标设定量化
# ═══════════════════════════════════════════════

@router.post("/targets/set")
def set_targets(
    body: TargetSettingRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """B阶段：将诊断发现的问题量化为具体目标（当前状态X → 目标状态Y）。

    每个目标包含：指标名称、当前值、目标值、单位、基线来源、目标依据。
    必须先完成A阶段诊断，禁止跳过A→B直接S。
    例："员工流失率" current="18%" target="<10%" unit="%"
    """
    targets = [t.model_dump() for t in body.targets]
    return ok(service.set_quantified_targets(
        db, user.user_id, body.project_id, targets,
    ))


# ═══════════════════════════════════════════════
# S阶段：方案生成
# ═══════════════════════════════════════════════

@router.post("/solutions/generate")
def generate_solutions(
    body: SolutionGenerateRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """S阶段：三源调用（携君库+私有库+智能办公）→ gap分析 → A/B双版方案。

    必须先完成A(诊断)→B(目标)，绝对禁止跳过。
    A版（稳健型）：侧重制度完善性和合规性，在现有框架基础上优化升级。
    B版（创新型）：引入行业前沿实践，更加灵活和突破性。

    三源知识库调用：
    - 携君库：行业最佳实践和标杆案例
    - 私有库：客户已有制度文档
    - 智能办公：基于现有制度的升级建议
    """
    return ok(service.generate_solutions(
        db, user.user_id, body.project_id,
        body.source_engines, body.focus_areas,
        body.generate_both_versions,
    ))


@router.post("/solutions/select")
def select_version(
    body: VersionSelectRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """老师和用户联合确认最终版本（仅A版或B版）。

    选中后项目进入reviewing阶段，可进行导出操作。
    命名规则：仅A版/B版，绝对禁止"基础版/标准版/高级版"。
    """
    return ok(service.select_final_version(
        db, user.user_id, body.project_id,
        body.solution_id, body.selected_by_teacher_id,
    ))


@router.post("/solutions/export")
def export_solution(
    body: SolutionExportRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """格式化导出方案为PDF或Word文档。

    导出内容包含：
    - 品牌水印（日耕Rigeng标识）
    - 制度升级追溯标注（"本方案参照了原XX制度第X条升级..."）
    - 方案所有段落、实施计划、风险评估、费用估算
    """
    return ok(service.export_solution(
        db, user.user_id, body.solution_id,
        body.export_format,
        body.include_brand_watermark,
        body.include_upgrade_annotations,
    ))


@router.post("/solutions/annotate")
def annotate_source(
    body: dict,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """为方案段落标注制度升级来源。

    标注格式："本方案参照了原XX制度第X条升级，过程中梳理了制度执行情况并优化了流程细节。"
    支持指定段落索引或全段落标注。
    制度升级可追溯，确保方案权威性和连续性。
    """
    return ok(service.annotate_upgrade_source(
        db, user.user_id,
        body.get("solution_id", ""),
        body.get("section_index", 0),
        body.get("source_doc", ""),
        body.get("source_article", ""),
    ))


# ═══════════════════════════════════════════════
# 产品预研
# ═══════════════════════════════════════════════

@router.post("/pre-research/create")
def create_pre_research(
    body: ProductPreResearchRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """产品预研模式：无合同 → 使用模板快速产出通用产品。

    六大模板类型：
    - recruitment: 招聘流程设计
    - training: 培训体系设计
    - compensation: 薪酬架构设计
    - performance: 绩效管理体系
    - policy: 人事管理制度
    - general: 人力资源管理总纲

    预研产品标注为"模板化预研产出"，后续可升级为完整ABS项目。
    """
    return ok(service.create_pre_research_product(
        db, user.user_id, body.template_type,
        body.product_name, body.description,
        body.reference_materials,
    ))


# ═══════════════════════════════════════════════
# 跨客户方案复用
# ═══════════════════════════════════════════════

@router.post("/solutions/reuse")
def reuse_framework(
    body: SolutionReuseRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """从客户A的已有方案中复用框架到客户B的新项目。

    复用规则：
    - 自动脱敏（去除客户A的具体信息）
    - 仅复用框架结构和段落组织，不直接复制客户数据
    - 记录复用来源以便追溯
    - 可指定具体段落复用或全框架复用
    """
    return ok(service.reuse_solution_framework(
        db, user.user_id, body.source_solution_id,
        body.target_project_id, body.sections_to_reuse,
        body.adaptation_notes,
    ))


# ═══════════════════════════════════════════════
# 老师辅导预约
# ═══════════════════════════════════════════════

@router.post("/coaching/book")
def book_coaching(
    body: CoachingSessionRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """预约老师视频辅导（2-5次为一个完整辅导周期）。

    辅导贯穿ABS全流程，建议安排：
    - 第1次：诊断报告解读（A阶段完成后）
    - 第2次：目标确认与方案方向（B阶段完成后）
    - 第3次：方案评审与落地指导（S阶段完成后）

    辅导预约包含：老师ID、总次数、首次时间、聚焦主题。
    """
    return ok(service.request_coaching_session(
        db, user.user_id, body.project_id,
        body.teacher_id, body.total_sessions,
        body.scheduled_at, body.duration_minutes,
        body.focus_topics,
    ))
