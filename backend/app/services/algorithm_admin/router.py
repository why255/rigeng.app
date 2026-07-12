"""算法管理服务 — 路由层（管理后台）。

API 端点（仅 superadmin 可访问）：

算法文件管理：
  GET    /admin/algorithms/modules           — 列出所有 AI 模块（含文件数+模型绑定）
  GET    /admin/algorithms?module_key=X      — 列出算法文件（可按模块筛选）
  GET    /admin/algorithms/{id}/detail       — 获取算法文件完整内容
  POST   /admin/algorithms/upload            — 上传算法文件
  PATCH  /admin/algorithms/{id}              — 编辑算法文件
  DELETE /admin/algorithms/{id}              — 删除算法文件

AI 配置中心：
  GET    /admin/ai-config/modules            — 列出全部模块的完整信息
  GET    /admin/ai-config/modules/{key}      — 获取单个模块的完整信息
  GET    /admin/ai-config/health             — AI 配置健康检查
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Form, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ...shared.database import get_db
from ...shared.response import ok
from ...shared.security import CurrentUser, require_role
from . import service

router = APIRouter(tags=["算法管理"], prefix="/admin/algorithms")

# 所有端点仅超级管理员可访问
_admin = require_role("superadmin")


# ═══════════════════════════════════════════════
# 算法文件 CRUD
# ═══════════════════════════════════════════════

@router.get("/modules")
def list_modules(
    _op: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """列出所有 16 个 AI 模块，含文件数量和当前模型绑定信息。"""
    return ok(service.list_modules(db))


@router.get("")
def list_algorithms(
    module_key: str | None = Query(None, description="按模块筛选"),
    _op: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """列出算法文件。可选 module_key 筛选。"""
    return ok(service.list_algorithms(db, module_key))


@router.get("/{algo_id}/detail")
def get_algorithm_detail(
    algo_id: str,
    _op: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """获取算法文件的完整内容（供预览和编辑使用）。"""
    return ok(service.get_algorithm_detail(db, algo_id))


@router.post("/upload")
def upload_algorithm(
    module_key: str = Form(..., description="所属模块key"),
    filename: str = Form(..., description="原始文件名"),
    content: str = Form(..., description="文件文本内容"),
    _op: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """上传算法文件（表单提交）。支持 txt/md/py/yaml/json/csv 等文本文件。"""
    return ok(service.upload_algorithm(db, _op.user_id, module_key, filename, content))


class UpdateAlgorithmBody(BaseModel):
    """编辑算法文件的 JSON 请求体。"""
    original_filename: str | None = Field(None, description="新的文件名")
    content: str | None = Field(None, description="新的文件内容")


@router.patch("/{algo_id}")
def update_algorithm(
    algo_id: str,
    body: UpdateAlgorithmBody,
    _op: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """编辑算法文件（文件名和/或内容）。"""
    return ok(service.update_algorithm(
        db, _op.user_id, algo_id,
        original_filename=body.original_filename,
        content=body.content,
    ))


@router.delete("/{algo_id}")
def delete_algorithm(
    algo_id: str,
    _op: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """删除算法文件（软删除）。"""
    return ok(service.delete_algorithm(db, _op.user_id, algo_id))


# ═══════════════════════════════════════════════
# AI 配置中心（独立路由）
# ═══════════════════════════════════════════════

ai_config_router = APIRouter(tags=["AI配置中心"], prefix="/admin/ai-config")


@ai_config_router.get("/modules")
def list_ai_modules(
    _op: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """列出全部 AI 模块的完整信息（注册表元数据 + 文件数 + 模型绑定）。"""
    return ok(service.list_modules(db))


@ai_config_router.get("/modules/{module_key}")
def get_module_detail(
    module_key: str,
    _op: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """获取单个模块的完整信息（含算法文件列表、模型绑定、默认配置）。"""
    return ok(service.get_module_full_info(db, module_key))


@ai_config_router.get("/health")
def ai_config_health(
    _op: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """AI 配置健康检查。

    返回所有 16 个模块的配置状态：
      - has_binding: 是否有活跃的模型绑定
      - has_algorithms: 是否有上传的算法文件
      - status: "ok" | "no_binding" | "no_algorithms" | "unconfigured"
    """
    modules = service.list_modules(db)
    health = []
    ok_count = 0
    warn_count = 0

    for m in modules:
        has_binding = m["has_active_binding"]
        has_files = m["file_count"] > 0

        if has_binding and has_files:
            status = "ok"
            ok_count += 1
        elif has_binding and not has_files:
            status = "no_algorithms"
            warn_count += 1
        elif not has_binding and has_files:
            status = "no_binding"
            warn_count += 1
        else:
            status = "unconfigured"
            warn_count += 1

        health.append({
            "module_key": m["key"],
            "module_name": m["name"],
            "has_binding": has_binding,
            "has_algorithms": has_files,
            "current_model": m.get("current_model"),
            "status": status,
        })

    return ok({
        "total": len(health),
        "ok": ok_count,
        "warn": warn_count,
        "modules": health,
    })
