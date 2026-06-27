"""④文件存储服务 — 路由层。"""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from ...shared.database import get_db
from ...shared.response import ok
from ...shared.security import CurrentUser, get_current_user
from . import service
from .schemas import CompressRequest

router = APIRouter(prefix="/files", tags=["④文件存储"])


@router.post("/upload")
def upload(
    file: UploadFile = File(...),
    file_type: str = Form("document"),
    storage_layer: str = Form("cloud"),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """上传文件。支持 audio / document / image / video。"""
    content = file.file.read()
    result = service.upload_file(
        db, user.user_id, content,
        file_type=file_type,
        filename=file.filename or "upload",
        storage_layer=storage_layer,
    )
    return ok(result)


@router.get("/{file_id}")
def get_info(
    file_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取文件元数据。"""
    return ok(service.get_file_info(db, file_id))


@router.get("/{file_id}/download")
def download(
    file_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取文件下载路径。"""
    return ok(service.download_file(db, user.user_id, file_id))


@router.delete("/{file_id}")
def delete(
    file_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """软删除文件并回收配额。"""
    return ok(service.delete_file(db, user.user_id, file_id))


@router.post("/{file_id}/compress")
def compress(
    file_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """触发音频压缩（MVP stub）。"""
    return ok(service.compress_audio(db, file_id))


@router.get("/quota/my")
def get_quota(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """查询当前用户存储配额。"""
    return ok(service.get_storage_quota(db, user.user_id))
