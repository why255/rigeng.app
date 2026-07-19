"""管理后台 — 路由层。
全部接口仅 superadmin 可访问。
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy.orm import Session

from ...shared import errors
from ...shared.database import get_db
from ...shared.response import ok, page
from ...shared.security import CurrentUser, require_role
from ..knowledge_base.ingestion_pipeline import get_pipeline
from . import service
from .schemas import (
    AssignStudentRequest,
    ChangeRoleRequest,
    ModelDegradeRequest,
    ModelConfigCreate,
    ModelConfigUpdate,
    ModuleModelBindingCreate,
    ModuleModelBindingUpdate,
    XiejunDocumentUpdate,
)

router = APIRouter(tags=["管理后台"], prefix="/admin")

_admin = require_role("superadmin")


# ═══════════════════════════════════════════════
# 用户管理
# ═══════════════════════════════════════════════

@router.get("/users")
def list_users(
    role: str | None = Query(None, description="按角色筛选: student/teacher/superadmin"),
    phone: str | None = Query(None, description="按手机号模糊搜索"),
    status: str | None = Query(None, description="按状态筛选: active/inactive"),
    page_no: int = Query(1, alias="page", ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _op: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """用户列表（分页+筛选）。"""
    return ok(service.list_users(db, role=role, phone=phone, status=status,
                                 page=page_no, page_size=page_size))


@router.get("/users/{user_id}")
def get_user_detail(
    user_id: str,
    _op: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """用户详情（含 VIP、老师档案、分配关系）。"""
    return ok(service.get_user_detail(db, user_id))


@router.patch("/users/{user_id}/role")
def change_role(
    user_id: str,
    body: ChangeRoleRequest,
    operator: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """变更用户角色（自动创建/清理 TeacherProfile）。"""
    return ok(service.change_role(db, operator.user_id, user_id, body.role))


# ═══════════════════════════════════════════════
# 老师管理
# ═══════════════════════════════════════════════

@router.post("/teachers/grant")
def grant_teacher(
    body: dict,
    operator: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """授予老师角色 → 改 role + 创建 TeacherProfile。"""
    return ok(service.grant_teacher(
        db, operator.user_id, body.get("user_id", ""),
        bio=body.get("bio", ""),
        expertise_tags=body.get("expertise_tags", []),
    ))


@router.post("/teachers/revoke")
def revoke_teacher(
    body: dict,
    operator: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """撤销老师角色 → 清理档案 + 解绑学员。"""
    return ok(service.revoke_teacher(db, operator.user_id, body.get("user_id", "")))


@router.get("/teachers")
def list_teachers(
    page_no: int = Query(1, alias="page", ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _op: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """老师列表（含档案、学员数）。"""
    return ok(service.list_teachers(db, page=page_no, page_size=page_size))


@router.get("/teachers/{teacher_id}/students")
def get_teacher_students(
    teacher_id: str,
    page_no: int = Query(1, alias="page", ge=1),
    page_size: int = Query(50, ge=1, le=200),
    _op: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """某老师名下的学员列表。"""
    return ok(service.get_teacher_students(db, teacher_id, page=page_no, page_size=page_size))


# ═══════════════════════════════════════════════
# 学员分配
# ═══════════════════════════════════════════════

@router.post("/teacher-assignments")
def assign_student(
    body: AssignStudentRequest,
    operator: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """分配学员给老师。"""
    return ok(service.assign_student(
        db, operator.user_id, body.teacher_id, body.student_id,
    ))


@router.delete("/teacher-assignments/{assignment_id}")
def unassign_student(
    assignment_id: str,
    operator: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """解除学员-老师分配。"""
    return ok(service.unassign_student(db, operator.user_id, assignment_id))


# ═══════════════════════════════════════════════
# 审计日志
# ═══════════════════════════════════════════════

@router.get("/audit-logs")
def get_audit_logs(
    target_user_id: str | None = Query(None),
    action: str | None = Query(None),
    page_no: int = Query(1, alias="page", ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _op: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """审计日志列表。"""
    return ok(service.get_audit_logs(
        db, target_user_id=target_user_id, action=action,
        page=page_no, page_size=page_size,
    ))


# ═══════════════════════════════════════════════
# 模型降级
# ═══════════════════════════════════════════════

# ── 提供商 ──

@router.get("/providers")
def get_providers(
    _op: CurrentUser = Depends(_admin),
):
    """可用的模型提供商列表。"""
    return ok(service.list_providers())


# ── 模型版本 CRUD ──

@router.get("/models")
def list_models(
    provider_key: str | None = Query(None, description="按提供商过滤"),
    page_no: int = Query(1, alias="page", ge=1),
    page_size: int = Query(50, ge=1, le=200),
    _op: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """模型版本列表（分页+筛选）。"""
    return ok(service.list_model_configs(
        db, provider_key=provider_key, page=page_no, page_size=page_size,
    ))


@router.get("/models/{model_id}")
def get_model(
    model_id: str,
    _op: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """模型版本详情。"""
    return ok(service.get_model_config(db, model_id))


@router.post("/models")
def create_model(
    body: ModelConfigCreate,
    operator: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """新增模型版本。"""
    return ok(service.create_model_config(db, operator.user_id, body))


@router.patch("/models/{model_id}")
def update_model(
    model_id: str,
    body: ModelConfigUpdate,
    operator: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """更新模型版本（启禁用、改名等）。"""
    return ok(service.update_model_config(db, operator.user_id, model_id, body))


@router.delete("/models/{model_id}")
def delete_model(
    model_id: str,
    operator: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """软删除模型版本（需先解绑所有模块）。"""
    return ok(service.delete_model_config(db, operator.user_id, model_id))


# ── 模块绑定 CRUD ──

@router.get("/module-bindings")
def list_bindings(
    module_key: str | None = Query(None, description="按模块过滤"),
    is_active: bool | None = Query(None, description="按活跃状态过滤"),
    page_no: int = Query(1, alias="page", ge=1),
    page_size: int = Query(50, ge=1, le=200),
    _op: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """模块绑定列表（含模型版本信息）。"""
    return ok(service.list_module_bindings(
        db, module_key=module_key, is_active=is_active,
        page=page_no, page_size=page_size,
    ))


@router.get("/module-bindings/{binding_id}")
def get_binding(
    binding_id: str,
    _op: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """单个绑定详情。"""
    return ok(service.get_module_binding(db, binding_id))


@router.post("/module-bindings")
def create_binding(
    body: ModuleModelBindingCreate,
    operator: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """新增模块→模型绑定。"""
    return ok(service.create_module_binding(db, operator.user_id, body))


@router.patch("/module-bindings/{binding_id}")
def update_binding(
    binding_id: str,
    body: ModuleModelBindingUpdate,
    operator: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """更新绑定（降级切换模型）。"""
    return ok(service.update_module_binding(db, operator.user_id, binding_id, body))


@router.delete("/module-bindings/{binding_id}")
def delete_binding(
    binding_id: str,
    operator: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """软删除绑定。"""
    return ok(service.delete_module_binding(db, operator.user_id, binding_id))


@router.post("/module-bindings/degrade")
def degrade_module(
    body: ModelDegradeRequest,
    operator: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """一键降级：将模块切换到新的模型版本。"""
    return ok(service.degrade_module(
        db, operator.user_id, body.module_key, body.new_model_config_id,
    ))


# ═══════════════════════════════════════════════
# 携君库文档管理
# ═══════════════════════════════════════════════


@router.get("/xiejun/documents")
def list_xiejun_documents(
    category: str | None = Query(None, description="按分类筛选"),
    status: str | None = Query(None, description="按状态筛选: published/draft/recycled"),
    page_no: int = Query(1, alias="page", ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _op: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """携君库文档列表（分页+筛选）。"""
    return ok(service.list_xiejun_documents(
        db, category=category, status=status, page=page_no, page_size=page_size,
    ))


@router.get("/xiejun/stats")
def get_xiejun_stats(
    _op: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """携君库文档统计（总数、分类统计）。"""
    return ok(service.get_xiejun_stats(db))


@router.post("/xiejun/documents/upload")
async def upload_xiejun_document(
    file: UploadFile = File(...),
    title: str | None = Form(None),
    operator: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """上传文档到携君库（自动归类）。"""
    content = await file.read()
    filename = file.filename or "untitled"
    # 根据扩展名推断文件类型
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    doc_type_map = {
        "pdf": "document", "doc": "document", "docx": "document",
        "xls": "document", "xlsx": "document", "ppt": "document", "pptx": "document",
        "txt": "document", "md": "document", "csv": "document",
        "png": "image", "jpg": "image", "jpeg": "image", "gif": "image",
    }
    file_type = doc_type_map.get(ext, "document")
    return ok(service.upload_xiejun_document(
        db, operator.user_id, content, filename, file_type, title,
    ))


@router.patch("/xiejun/documents/{doc_id}")
def update_xiejun_document(
    doc_id: str,
    body: XiejunDocumentUpdate,
    operator: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """更新携君库文档（标题、分类、状态）。"""
    return ok(service.update_xiejun_document(db, operator.user_id, doc_id, body))


@router.delete("/xiejun/documents/{doc_id}")
def delete_xiejun_document(
    doc_id: str,
    operator: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """删除携君库文档（软删除）。"""
    return ok(service.delete_xiejun_document(db, operator.user_id, doc_id))


# ═══════════════════════════════════════════════
# 携君库 — 入库历史（2026-07-15）
# ═══════════════════════════════════════════════

@router.get("/xiejun/ingestion-tasks")
def list_ingestion_tasks(
    page_no: int = Query(1, alias="page", ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _op: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """携君库zip上传历史列表。"""
    pipeline = get_pipeline()
    result = pipeline.list_tasks(db, page=page_no, page_size=page_size)
    return ok(result)


@router.get("/xiejun/ingestion-tasks/{task_id}/report")
def get_ingestion_report(
    task_id: str,
    _op: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """获取指定任务的入库报告详情。"""
    # task_id 可能是 upload_id
    pipeline = get_pipeline()
    result = pipeline.get_report(db, task_id)
    if not result:
        raise errors.APIError(errors.E_PARAM_FORMAT.code, f"未找到入库报告: {task_id}", 404)
    return ok(result)


@router.post("/xiejun/ingestion-tasks/{upload_id}/process")
def trigger_ingestion(
    upload_id: str,
    _op: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """手动触发入库流水线处理（重试失败任务）。"""
    pipeline = get_pipeline()
    result = pipeline.process_upload(db, upload_id)
    return ok(result)
