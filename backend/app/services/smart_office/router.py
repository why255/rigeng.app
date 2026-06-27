"""智能办公服务 — 路由层（步骤19）。

API 端点（双库架构）：
  工具库：
    GET    /office/modules               — HR八大模块列表
    GET    /office/tools/{module_key}    — 获取模块工具卡片

  体系库：
    POST   /office/system/start         — 开始6步体系搭建
    POST   /office/system/step/{step_num} — 提交步骤答案
    GET    /office/system/builds        — 列出体系搭建记录
    GET    /office/system/{build_id}    — 获取体系搭建状态

  文档生成：
    POST   /office/generate             — AI生成文档（三源）

  草稿箱：
    POST   /office/drafts               — 保存草稿
    GET    /office/drafts               — 列出草稿

  制度比对：
    POST   /office/policy/upload        — 上传现有制度
    POST   /office/policy/compare       — 比对生成vs现有

  版本管理：
    GET    /office/documents/{doc_id}/versions  — 版本历史
    POST   /office/documents/{doc_id}/rollback  — 回滚版本

  归档：
    POST   /office/documents/{doc_id}/archive   — 确认归档

  协作：
    POST   /office/collaborate/invite   — 邀请协作者

  数据流：
    GET    /office/module-connections    — 跨模块数据流
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ...shared.database import get_db
from ...shared.response import ok
from ...shared.security import CurrentUser, get_current_user
from . import service
from .schemas import (
    ComparePolicyRequest,
    DocumentGenerateRequest,
    DraftSaveRequest,
    StepAnswerRequest,
    SystemBuildStartRequest,
    CollaborationInviteRequest,
)

router = APIRouter(tags=["智能办公"], prefix="/office")


# ═══════════════════════════════════════════════
# 工具库
# ═══════════════════════════════════════════════

@router.get("/modules")
def list_modules(
    user: CurrentUser = Depends(get_current_user),
):
    """列出HR八大模块及其工具卡片。双库全部可见，不按职级隐藏。"""
    return ok(service.list_hr_modules())


@router.get("/tools/{module_key}")
def get_tools(
    module_key: str,
    user: CurrentUser = Depends(get_current_user),
):
    """获取指定HR模块的工具列表。"""
    return ok(service.get_module_tools(module_key))


# ═══════════════════════════════════════════════
# 体系库：6步搭建
# ═══════════════════════════════════════════════

@router.post("/system/start")
def start_system_build(
    body: SystemBuildStartRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """开始6步体系搭建，返回第1步引导问题。"""
    return ok(service.start_system_build(db, user.user_id, body.project_title))


@router.get("/system/builds")
def list_builds(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """列出用户的所有体系搭建记录。"""
    return ok(service.list_builds(db, user.user_id))


@router.get("/system/{build_id}")
def get_build(
    build_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取体系搭建的当前状态（6步进度）。"""
    return ok(service.get_build_state(db, user.user_id, build_id))


@router.post("/system/step/{step_num}")
def submit_step(
    step_num: int,
    body: StepAnswerRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """提交当前步骤的答案，自动推进到下一步（或完成）。"""
    return ok(service.continue_build_step(
        db, user.user_id, body.build_id, step_num, body.answer,
    ))


# ═══════════════════════════════════════════════
# 文档生成（三源调用）
# ═══════════════════════════════════════════════

@router.post("/generate")
def generate(
    body: DocumentGenerateRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """AI生成文档（三源融合：私有库+携君库+互联网）。"""
    return ok(service.generate_document(
        db, user.user_id, body.module_key, body.doc_type,
        body.tool_key, body.build_id, body.custom_prompt,
        body.brand_logo_visible,
    ))


# ═══════════════════════════════════════════════
# 草稿箱
# ═══════════════════════════════════════════════

@router.post("/drafts")
def save_draft(
    body: DraftSaveRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """保存/更新草稿。每步自动保存，保留30天。"""
    return ok(service.save_draft(
        db, user.user_id, body.doc_id, body.title,
        body.doc_type, body.module_key, body.step_num, body.content,
    ))


@router.get("/drafts")
def list_drafts(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """列出用户草稿箱（30天内有效）。"""
    return ok(service.list_drafts(db, user.user_id))


# ═══════════════════════════════════════════════
# 现有制度上载与比对
# ═══════════════════════════════════════════════

@router.post("/policy/upload")
def upload_policy(
    doc_id: str = Query(..., description="关联的文档ID"),
    filename: str = Query(..., description="原始文件名"),
    content_text: str = Query(..., description="制度文件文本内容"),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """上传现有制度文件。仅存储私有库，不用于模型训练。"""
    return ok(service.upload_policy(db, user.user_id, doc_id, filename, content_text))


@router.post("/policy/compare")
def compare_policy(
    body: ComparePolicyRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """将生成的文档与上传的现有制度进行差异比对。"""
    return ok(service.compare_with_existing(
        db, user.user_id, body.doc_id, body.upload_id,
    ))


# ═══════════════════════════════════════════════
# 版本管理
# ═══════════════════════════════════════════════

@router.get("/documents/{doc_id}/versions")
def version_history(
    doc_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取文档的版本历史列表。"""
    return ok(service.get_version_history(db, user.user_id, doc_id))


@router.post("/documents/{doc_id}/rollback")
def rollback(
    doc_id: str,
    target_version: int = Query(..., description="目标版本号"),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """回滚文档到指定版本。"""
    return ok(service.rollback_version(db, user.user_id, doc_id, target_version))


# ═══════════════════════════════════════════════
# 归档
# ═══════════════════════════════════════════════

@router.post("/documents/{doc_id}/archive")
def archive(
    doc_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """确认文档并归档到知识库（统一确认入库）。"""
    return ok(service.confirm_and_archive(db, user.user_id, doc_id))


# ═══════════════════════════════════════════════
# 多人协作
# ═══════════════════════════════════════════════

@router.post("/collaborate/invite")
def invite_collaborator(
    body: CollaborationInviteRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """邀请老师进行文档协作（响应≤3秒）。"""
    return ok(service.invite_collaborator(
        db, user.user_id, body.doc_id, body.teacher_user_id, body.message,
    ))


# ═══════════════════════════════════════════════
# 跨模块数据流
# ═══════════════════════════════════════════════

@router.get("/module-connections")
def module_connections(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取智能办公与其他模块的数据流连接配置。"""
    return ok(service.get_module_data_connections(db, user.user_id))
