"""算法管理服务 — 核心业务逻辑。

管理员功能：
  - 上传算法文件（按模块分类）
  - 删除算法文件
  - 按模块列出算法文件

AI调用集成：
  - get_algorithms_for_module(): 供 voice_engine 等服务调用，
    在LLM推理前检索该模块的算法文件内容。
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import desc
from sqlalchemy.orm import Session

from ...shared.database import new_uuid, utcnow
from ...shared.errors import APIError, E_DOC_NOT_FOUND, E_PARAM_FORMAT
from ...shared.models.algorithm import AlgorithmFile
from .schemas import ALGORITHM_MODULES

logger = logging.getLogger("algorithm_admin")

# 允许的文件扩展名
ALLOWED_EXTENSIONS = {".txt", ".md", ".py", ".yaml", ".yml", ".json", ".csv", ".cfg", ".ini", ".conf"}

# 单文件最大 2MB
MAX_FILE_SIZE = 2 * 1024 * 1024


def list_algorithms(db: Session, module_key: str | None = None) -> list[dict]:
    """列出算法文件，可按模块筛选。"""
    q = db.query(AlgorithmFile).filter(AlgorithmFile.deleted_at.is_(None))
    if module_key:
        q = q.filter(AlgorithmFile.module_key == module_key)
    q = q.order_by(desc(AlgorithmFile.created_at))
    return [f.to_dict() for f in q.all()]


def list_modules(db: Session) -> list[dict]:
    """列出所有支持的模块及其文件数量。"""
    result = []
    for m in ALGORITHM_MODULES:
        count = (
            db.query(AlgorithmFile)
            .filter(
                AlgorithmFile.module_key == m["key"],
                AlgorithmFile.deleted_at.is_(None),
            )
            .count()
        )
        result.append({
            "key": m["key"],
            "name": m["name"],
            "icon": m["icon"],
            "file_count": count,
        })
    return result


def upload_algorithm(db: Session, user_id: str, module_key: str,
                     original_filename: str, content: str) -> dict:
    """上传算法文件。

    校验：
      - 模块key有效性
      - 文件扩展名
      - 文件大小
      - 同一模块最多保留 5 个文件（超过则拒绝）
    """
    # 校验模块
    valid_keys = {m["key"] for m in ALGORITHM_MODULES}
    if module_key not in valid_keys:
        raise APIError(E_PARAM_FORMAT.code,
                       f"不支持的模块: {module_key}，有效值: {', '.join(sorted(valid_keys))}", 400)

    # 校验扩展名
    ext = "." + original_filename.split(".")[-1].lower() if "." in original_filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise APIError(E_PARAM_FORMAT.code,
                       f"不支持的文件类型: {ext}，允许: {', '.join(sorted(ALLOWED_EXTENSIONS))}", 400)

    # 校验大小
    content_bytes = content.encode("utf-8")
    if len(content_bytes) > MAX_FILE_SIZE:
        raise APIError(E_PARAM_FORMAT.code,
                       f"文件过大 ({len(content_bytes)} 字节)，最大允许 {MAX_FILE_SIZE} 字节", 400)

    # 同一模块最多保留 5 个文件
    existing_count = (
        db.query(AlgorithmFile)
        .filter(
            AlgorithmFile.module_key == module_key,
            AlgorithmFile.deleted_at.is_(None),
        )
        .count()
    )
    if existing_count >= 5:
        raise APIError(E_PARAM_FORMAT.code,
                       f"模块 '{module_key}' 已有 {existing_count} 个算法文件（上限5个），请先删除旧文件后再上传", 400)

    # 创建存储文件名
    storage_filename = f"{module_key}_{new_uuid()[:12]}{ext}"

    algo = AlgorithmFile(
        module_key=module_key,
        filename=storage_filename,
        original_filename=original_filename,
        content=content,
        file_size=len(content_bytes),
        uploaded_by=user_id,
    )
    db.add(algo)
    db.commit()
    db.refresh(algo)

    logger.info("算法文件已上传: id=%s module=%s filename=%s size=%d",
                algo.id, module_key, original_filename, len(content_bytes))

    return {
        "id": algo.id,
        "module_key": algo.module_key,
        "original_filename": algo.original_filename,
        "file_size": algo.file_size,
        "created_at": algo.created_at.isoformat() if algo.created_at else "",
    }


def delete_algorithm(db: Session, user_id: str, algo_id: str) -> dict:
    """软删除算法文件。"""
    algo = db.query(AlgorithmFile).filter(
        AlgorithmFile.id == algo_id,
        AlgorithmFile.deleted_at.is_(None),
    ).first()

    if not algo:
        raise APIError(E_DOC_NOT_FOUND.code, "算法文件不存在或已删除", 404)

    module_key = algo.module_key
    filename = algo.original_filename
    algo.deleted_at = datetime.now(timezone.utc).replace(tzinfo=None)

    db.commit()

    logger.info("算法文件已删除: id=%s module=%s filename=%s by=%s",
                algo_id, module_key, filename, user_id)

    return {"deleted_id": algo_id, "module_key": module_key}


# ═══════════════════════════════════════════════
# AI 调用集成 — 供 voice_engine 等服务使用
# ═══════════════════════════════════════════════

def get_algorithms_for_module(db: Session, module_key: str) -> str:
    """获取指定模块的所有算法文件内容（拼接为一段文本）。

    此函数供 AI 引擎在 LLM 推理前调用，将算法文件内容注入 system prompt。
    返回空字符串表示该模块无算法文件。

    Args:
        db: 数据库会话
        module_key: 模块标识（如 morning_plan, smart_qa 等）

    Returns:
        拼接后的算法文件文本，文件间用分隔线隔开；无文件时返回 ""
    """
    files = (
        db.query(AlgorithmFile)
        .filter(
            AlgorithmFile.module_key == module_key,
            AlgorithmFile.deleted_at.is_(None),
        )
        .order_by(desc(AlgorithmFile.created_at))
        .all()
    )

    if not files:
        return ""

    parts = ["\n\n【管理员上传的算法/规则文件 — 请优先遵循以下内容】\n"]
    for i, f in enumerate(files, 1):
        parts.append(f"── 文件 {i}: {f.original_filename} ──")
        parts.append(f.content)
        parts.append("")

    return "\n".join(parts)


# 模块key到模块名的映射
MODULE_KEY_TO_NAME: dict[str, str] = {
    m["key"]: m["name"] for m in ALGORITHM_MODULES
}
