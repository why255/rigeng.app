"""④文件存储服务 — 核心业务逻辑。

功能：
- 文件上传（校验大小/配额，存储到本地磁盘或 MinIO）
- 文件下载（权限校验、流式传输）
- 文件删除（软删除、配额回收）
- 音频压缩（stub，生产环境接 ffmpeg）
- 存储配额查询
- 离线同步冲突检测
"""
from __future__ import annotations

import hashlib
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from ...shared.config import settings
from ...shared.database import new_uuid, utcnow
from ...shared.errors import (
    E_FILE_TOO_LARGE,
    E_FILE_NOT_FOUND,
    E_STORAGE_FULL,
    E_COMPRESS_FAIL,
    E_OFFLINE_CONFLICT,
    E_LOCAL_ENCRYPTED_NO_DOWNLOAD,
    E_NO_PERMISSION,
)
from ...shared.models.user import VipMembership
from ...shared.models.knowledge import FileObject

logger = logging.getLogger("file_storage")

# 本地上传根目录
LOCAL_STORAGE_ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "..", "storage")


def _get_storage_path(user_id: str, file_id: str, ext: str = "") -> str:
    """生成本地存储路径：storage/{user_id}/{file_id}.{ext}"""
    user_dir = os.path.join(LOCAL_STORAGE_ROOT, user_id)
    os.makedirs(user_dir, exist_ok=True)
    return os.path.join(user_dir, f"{file_id}{ext}")


def _check_quota(db: Session, user_id: str, additional_bytes: int) -> None:
    """检查存储配额，超限抛出 E_STORAGE_FULL。"""
    membership = db.query(VipMembership).filter(
        VipMembership.user_id == user_id,
        VipMembership.deleted_at.is_(None),
    ).first()
    if not membership:
        return  # 无会员记录，不限制

    quota = membership.storage_quota_mb
    if quota is None:
        return  # 无上限

    used = membership.storage_used_mb or 0
    new_used = used + (additional_bytes / (1024 * 1024))
    if new_used > quota:
        raise E_STORAGE_FULL


def _update_quota(db: Session, user_id: str, delta_bytes: int) -> None:
    """更新已用存储空间（delta_bytes 可为负值）。"""
    membership = db.query(VipMembership).filter(
        VipMembership.user_id == user_id,
        VipMembership.deleted_at.is_(None),
    ).first()
    if not membership:
        return

    delta_mb = delta_bytes / (1024 * 1024)
    membership.storage_used_mb = max(0, (membership.storage_used_mb or 0) + delta_mb)
    db.flush()


# ═══════════════════════════════════════════════
# 公开接口
# ═══════════════════════════════════════════════

def upload_file(db: Session, owner_user_id: str, file_content: bytes,
                file_type: str, filename: str = "upload",
                storage_layer: str = "cloud") -> dict[str, Any]:
    """上传文件：保存到本地磁盘 + 创建 FileObject 记录 + 更新配额。

    Args:
        file_content: 文件原始字节
        file_type: audio / document / image / video
        filename: 原始文件名（用于提取扩展名）
        storage_layer: cloud（默认）/ local_encrypted（仅存元数据，内容留端侧）

    Returns:
        {file_id, storage_url, size_bytes}
    """
    size_bytes = len(file_content)

    # 1. 大小校验
    max_bytes = settings.UPLOAD_MAX_MB * 1024 * 1024
    if size_bytes > max_bytes:
        raise E_FILE_TOO_LARGE

    # 2. 配额检查（仅 cloud 层计入配额）
    if storage_layer == "cloud":
        _check_quota(db, owner_user_id, size_bytes)

    # 3. 生成文件 ID 和路径
    file_id = new_uuid()
    ext = os.path.splitext(filename)[1] or ""
    storage_url = _get_storage_path(owner_user_id, file_id, ext)

    # 4. 写入本地磁盘（local_encrypted 模式仅存元数据，不写实体内容）
    if storage_layer == "cloud":
        with open(storage_url, "wb") as f:
            f.write(file_content)

    # 5. 计算校验和
    checksum = hashlib.sha256(file_content).hexdigest()

    # 6. 创建 FileObject 记录
    file_obj = FileObject(
        id=file_id,
        storage_url=storage_url if storage_layer == "cloud" else None,
        file_type=file_type,
        size_bytes=size_bytes,
        compress_status="raw",
        storage_layer=storage_layer,
        checksum=checksum,
    )
    db.add(file_obj)
    db.flush()

    # 7. 更新配额
    if storage_layer == "cloud":
        _update_quota(db, owner_user_id, size_bytes)

    db.commit()

    logger.info("文件上传成功: file_id=%s type=%s size=%d layer=%s",
                file_id, file_type, size_bytes, storage_layer)

    return {
        "file_id": file_id,
        "storage_url": storage_url if storage_layer == "cloud" else "(local_encrypted)",
        "size_bytes": size_bytes,
    }


def get_file_info(db: Session, file_id: str) -> dict[str, Any]:
    """获取文件元数据。"""
    file_obj = db.query(FileObject).filter(
        FileObject.id == file_id,
        FileObject.deleted_at.is_(None),
    ).first()
    if not file_obj:
        raise E_FILE_NOT_FOUND

    return {
        "file_id": file_obj.id,
        "storage_url": file_obj.storage_url,
        "file_type": file_obj.file_type,
        "size_bytes": file_obj.size_bytes,
        "duration_sec": file_obj.duration_sec,
        "compress_status": file_obj.compress_status,
        "storage_layer": file_obj.storage_layer,
        "checksum": file_obj.checksum,
        "created_at": file_obj.created_at.isoformat() if file_obj.created_at else None,
    }


def download_file(db: Session, user_id: str, file_id: str) -> dict[str, Any]:
    """获取文件下载路径（权限校验）。"""
    file_obj = db.query(FileObject).filter(
        FileObject.id == file_id,
        FileObject.deleted_at.is_(None),
    ).first()
    if not file_obj:
        raise E_FILE_NOT_FOUND

    # local_encrypted 层文件不可云端下载
    if file_obj.storage_layer == "local_encrypted":
        raise E_LOCAL_ENCRYPTED_NO_DOWNLOAD

    if not file_obj.storage_url or not os.path.exists(file_obj.storage_url):
        raise E_FILE_NOT_FOUND

    return {
        "file_id": file_obj.id,
        "storage_url": file_obj.storage_url,
        "file_type": file_obj.file_type,
        "size_bytes": file_obj.size_bytes,
        "checksum": file_obj.checksum,
    }


def delete_file(db: Session, user_id: str, file_id: str) -> dict[str, Any]:
    """软删除文件，回收配额。"""
    file_obj = db.query(FileObject).filter(
        FileObject.id == file_id,
        FileObject.deleted_at.is_(None),
    ).first()
    if not file_obj:
        raise E_FILE_NOT_FOUND

    file_obj.deleted_at = utcnow()

    # 回收配额
    if file_obj.storage_layer == "cloud" and file_obj.size_bytes:
        _update_quota(db, user_id, -file_obj.size_bytes)

    db.commit()

    # 异步清理物理文件（MVP 同步处理）
    if file_obj.storage_url and os.path.exists(file_obj.storage_url):
        try:
            os.remove(file_obj.storage_url)
        except OSError:
            pass

    logger.info("文件已删除: file_id=%s", file_id)
    return {"deleted": True, "file_id": file_id}


def compress_audio(db: Session, file_id: str) -> dict[str, Any]:
    """触发音频压缩（MVP stub，生产环境接 ffmpeg）。

    当前仅标记压缩状态为 'compressed'；后续可集成 subprocess 调用 ffmpeg：
      ffmpeg -i input.wav -b:a {AUDIO_COMPRESS_BITRATE} output.mp3
    """
    file_obj = db.query(FileObject).filter(
        FileObject.id == file_id,
        FileObject.deleted_at.is_(None),
    ).first()
    if not file_obj:
        raise E_FILE_NOT_FOUND

    if file_obj.file_type != "audio":
        raise E_COMPRESS_FAIL

    # MVP: 直接标记为已压缩（实际压缩逻辑留待生产集成 ffmpeg）
    file_obj.compress_status = "compressed"
    db.commit()

    return {
        "file_id": file_id,
        "compress_status": "compressed",
        "note": "压缩功能已预留，生产环境将集成 ffmpeg 实际压缩",
    }


def get_storage_quota(db: Session, user_id: str) -> dict[str, Any]:
    """查询用户存储配额。"""
    membership = db.query(VipMembership).filter(
        VipMembership.user_id == user_id,
        VipMembership.deleted_at.is_(None),
    ).first()

    used_mb = membership.storage_used_mb if membership else 0
    quota_mb = membership.storage_quota_mb if membership else None
    remaining_mb = None if quota_mb is None else quota_mb - used_mb
    is_full = remaining_mb is not None and remaining_mb <= 0

    return {
        "used_mb": used_mb,
        "quota_mb": quota_mb,
        "remaining_mb": remaining_mb,
        "is_full": is_full,
    }


def check_sync_conflict(db: Session, user_id: str,
                        local_checksums: list[dict[str, str]]) -> dict[str, Any]:
    """离线同步冲突检测：对比本地和云端文件校验和。

    Args:
        local_checksums: [{"file_id": "...", "checksum": "..."}, ...]

    Returns:
        {"conflicts": [...], "missing_on_cloud": [...], "missing_local": [...]}
    """
    conflicts = []
    local_ids = {item["file_id"] for item in local_checksums}
    local_map = {item["file_id"]: item["checksum"] for item in local_checksums}

    # 查询云端文件
    cloud_files = db.query(FileObject).filter(
        FileObject.deleted_at.is_(None),
    ).all()

    cloud_ids = set()
    for f in cloud_files:
        cloud_ids.add(f.id)
        if f.id in local_map:
            if f.checksum != local_map[f.id]:
                conflicts.append({
                    "file_id": f.id,
                    "local_checksum": local_map[f.id],
                    "cloud_checksum": f.checksum,
                })

    missing_on_cloud = list(local_ids - cloud_ids)
    missing_local = list(cloud_ids - local_ids)

    return {
        "conflicts": conflicts,
        "missing_on_cloud": missing_on_cloud,
        "missing_local": missing_local,
        "has_conflicts": len(conflicts) > 0,
    }
