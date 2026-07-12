"""算法管理服务 — 核心业务逻辑。

管理员功能：
  - 上传算法文件（按模块分类）
  - 编辑/删除算法文件
  - 按模块列出算法文件
  - AI 配置中心聚合查询

AI调用集成：
  - get_algorithms_for_module(): 供 voice_engine 等服务调用，
    在LLM推理前检索该模块的算法文件内容。
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import desc
from sqlalchemy.orm import Session

from ...engines.module_registry import MODULE_REGISTRY
from ...shared.database import new_uuid, utcnow
from ...shared.errors import APIError, E_DOC_NOT_FOUND, E_PARAM_FORMAT
from ...shared.models.algorithm import AlgorithmFile
from .schemas import ALGORITHM_MODULES

logger = logging.getLogger("algorithm_admin")

# 允许的文件扩展名
ALLOWED_EXTENSIONS = {".txt", ".md", ".py", ".yaml", ".yml", ".json", ".csv", ".cfg", ".ini", ".conf"}

# 单文件最大 2MB
MAX_FILE_SIZE = 2 * 1024 * 1024


# ═══════════════════════════════════════════════
# 算法文件 CRUD
# ═══════════════════════════════════════════════

def list_algorithms(db: Session, module_key: str | None = None) -> list[dict]:
    """列出算法文件，可按模块筛选。"""
    q = db.query(AlgorithmFile).filter(AlgorithmFile.deleted_at.is_(None))
    if module_key:
        q = q.filter(AlgorithmFile.module_key == module_key)
    q = q.order_by(desc(AlgorithmFile.created_at))
    return [f.to_dict() for f in q.all()]


def get_algorithm_detail(db: Session, algo_id: str) -> dict:
    """获取算法文件完整内容（非截断预览）。"""
    algo = db.query(AlgorithmFile).filter(
        AlgorithmFile.id == algo_id,
        AlgorithmFile.deleted_at.is_(None),
    ).first()

    if not algo:
        raise APIError(E_DOC_NOT_FOUND.code, "算法文件不存在或已删除", 404)

    return {
        "id": algo.id,
        "module_key": algo.module_key,
        "original_filename": algo.original_filename,
        "content": algo.content,
        "file_size": algo.file_size,
        "uploaded_by": algo.uploaded_by,
        "created_at": algo.created_at.isoformat() if algo.created_at else "",
        "updated_at": algo.updated_at.isoformat() if algo.updated_at else "",
    }


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


def update_algorithm(db: Session, user_id: str, algo_id: str,
                     original_filename: str | None = None,
                     content: str | None = None) -> dict:
    """编辑算法文件（文件名和/或内容）。

    至少需要提供 filename 或 content 之一。
    """
    algo = db.query(AlgorithmFile).filter(
        AlgorithmFile.id == algo_id,
        AlgorithmFile.deleted_at.is_(None),
    ).first()

    if not algo:
        raise APIError(E_DOC_NOT_FOUND.code, "算法文件不存在或已删除", 404)

    changed = False

    # 更新文件名
    if original_filename is not None:
        ext = "." + original_filename.split(".")[-1].lower() if "." in original_filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            raise APIError(E_PARAM_FORMAT.code,
                           f"不支持的文件类型: {ext}，允许: {', '.join(sorted(ALLOWED_EXTENSIONS))}", 400)
        algo.original_filename = original_filename
        changed = True

    # 更新内容
    if content is not None:
        content_bytes = content.encode("utf-8")
        if len(content_bytes) > MAX_FILE_SIZE:
            raise APIError(E_PARAM_FORMAT.code,
                           f"文件过大 ({len(content_bytes)} 字节)，最大允许 {MAX_FILE_SIZE} 字节", 400)
        algo.content = content
        algo.file_size = len(content_bytes)
        changed = True

    if not changed:
        raise APIError(E_PARAM_FORMAT.code, "至少需要提供 filename 或 content", 400)

    algo.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()

    logger.info("算法文件已更新: id=%s module=%s filename=%s by=%s",
                algo_id, algo.module_key, algo.original_filename, user_id)

    return {
        "id": algo.id,
        "module_key": algo.module_key,
        "original_filename": algo.original_filename,
        "file_size": algo.file_size,
        "created_at": algo.created_at.isoformat() if algo.created_at else "",
        "updated_at": algo.updated_at.isoformat() if algo.updated_at else "",
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
# AI 配置中心 — 模块聚合查询
# ═══════════════════════════════════════════════

def _get_active_bindings(db: Session) -> dict[str, dict]:
    """从数据库加载所有模块的活跃模型绑定。

    Returns:
        {module_key: {model_name, provider_key, model_version, display_name, binding_id}}
    """
    try:
        from ...shared.models.model_config import ModelConfig, ModuleModelBinding
        rows = db.query(
            ModuleModelBinding.id,
            ModuleModelBinding.module_key,
            ModuleModelBinding.module_display_name,
            ModelConfig.model_name,
            ModelConfig.model_version,
            ModelConfig.provider_key,
            ModelConfig.display_name,
        ).join(
            ModelConfig, ModuleModelBinding.model_config_id == ModelConfig.id,
        ).filter(
            ModuleModelBinding.is_active == True,
            ModelConfig.is_available == True,
            ModuleModelBinding.deleted_at == None,
            ModelConfig.deleted_at == None,
        ).order_by(ModuleModelBinding.created_at.desc()).all()

        result: dict[str, dict] = {}
        for row in rows:
            if row.module_key not in result:
                result[row.module_key] = {
                    "model_name": row.model_name,
                    "provider_key": row.provider_key,
                    "model_version": row.model_version or "",
                    "display_name": row.display_name or row.model_name,
                    "binding_id": row.id,
                }
        return result
    except Exception as e:
        logger.warning("加载模块绑定信息失败: %s", e)
        return {}


def list_modules(db: Session) -> list[dict]:
    """列出所有 16 个 AI 模块，含文件数和当前模型绑定信息。"""
    bindings = _get_active_bindings(db)

    # 查询每个模块的文件数（一次查询）
    from sqlalchemy import func
    file_counts = dict(
        db.query(
            AlgorithmFile.module_key,
            func.count(AlgorithmFile.id),
        ).filter(
            AlgorithmFile.deleted_at.is_(None),
        ).group_by(AlgorithmFile.module_key).all()
    )

    result = []
    for m in ALGORITHM_MODULES:
        key = m["key"]
        module_reg = MODULE_REGISTRY.get(key, {})
        binding = bindings.get(key, {})

        result.append({
            "key": key,
            "name": m["name"],
            "icon": m["icon"],
            "color": m.get("color", ""),
            "file_count": file_counts.get(key, 0),
            "current_model": binding.get("model_name"),
            "current_provider": binding.get("provider_key"),
            "current_model_version": binding.get("model_version", ""),
            "model_display_name": binding.get("display_name", ""),
            "has_active_binding": key in bindings,
        })

    return result


def get_module_full_info(db: Session, module_key: str) -> dict:
    """获取单个模块的完整信息（注册表 + 算法文件 + 模型绑定）。"""
    module_reg = MODULE_REGISTRY.get(module_key)
    if not module_reg:
        raise APIError(E_PARAM_FORMAT.code,
                       f"不支持的模块: {module_key}，有效值: {', '.join(MODULE_REGISTRY.keys())}", 400)

    # 算法文件
    files = list_algorithms(db, module_key)

    # 模型绑定
    bindings = _get_active_bindings(db)
    binding = bindings.get(module_key, {})

    # 降级链（从模块注册表读取）
    fallback_chain = module_reg.get("fallback_chain", [])

    return {
        "key": module_key,
        "name": module_reg["name"],
        "icon": module_reg["icon"],
        "color": module_reg.get("color", ""),
        "description": module_reg.get("description", ""),
        "ai_capabilities": module_reg.get("ai_capabilities", []),
        # 算法文件
        "file_count": len(files),
        "files": files,
        # 当前模型绑定
        "current_model": binding.get("model_name"),
        "current_provider": binding.get("provider_key"),
        "current_model_version": binding.get("model_version", ""),
        "model_display_name": binding.get("display_name", ""),
        "has_active_binding": module_key in bindings,
        "binding_id": binding.get("binding_id"),
        # 默认配置
        "default_model": module_reg["default_model"],
        "default_provider": module_reg["provider"],
        "temperature": module_reg["temperature"],
        "fallback_chain": fallback_chain,
        "template_fallback": module_reg.get("template_fallback"),
    }


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
