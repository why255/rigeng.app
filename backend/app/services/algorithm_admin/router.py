"""算法管理服务 — 路由层（管理后台）。

API 端点（仅 superadmin 可访问）：
  GET    /admin/algorithms/modules        — 列出支持的模块及文件数
  GET    /admin/algorithms?module_key=X   — 列出算法文件（可按模块筛选）
  POST   /admin/algorithms/upload         — 上传算法文件
  DELETE /admin/algorithms/{id}           — 删除算法文件
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Form, Query
from sqlalchemy.orm import Session

from ...shared.database import get_db
from ...shared.response import ok
from ...shared.security import CurrentUser, require_role
from . import service

router = APIRouter(tags=["算法管理"], prefix="/admin/algorithms")

# 所有端点仅超级管理员可访问
_admin = require_role("superadmin")


@router.get("/modules")
def list_modules(
    _op: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """列出所有支持算法管理的模块及文件数量。"""
    return ok(service.list_modules(db))


@router.get("")
def list_algorithms(
    module_key: str | None = Query(None, description="按模块筛选"),
    _op: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """列出算法文件。可选 module_key 筛选。"""
    return ok(service.list_algorithms(db, module_key))


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


@router.delete("/{algo_id}")
def delete_algorithm(
    algo_id: str,
    _op: CurrentUser = Depends(_admin),
    db: Session = Depends(get_db),
):
    """删除算法文件（软删除）。"""
    return ok(service.delete_algorithm(db, _op.user_id, algo_id))
