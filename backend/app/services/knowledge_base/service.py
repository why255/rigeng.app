"""②公私知识库服务 业务逻辑层（步骤3 §4：K1-K16 核心）。

落实需求红线：
- K1 情绪激动内容拒绝上云（40041）；负面内容入库拦截标记。
- K2 三源检索，品牌调用排除负面（exclude_negative）。
- K6 系统审核四维（完整性/分类/脱敏/敏感信息），未脱敏→40012。
- K10 携君库不可下载（40030）+ 500字复制限制（40031）。
- 归档统一走 待审核区 → 审核 → 入库；超期不自动删除。
"""
from __future__ import annotations

from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from ...shared import errors
from ...shared.config import settings
from ...shared.database import utcnow
from ...shared.models.knowledge import (
    DOC_TYPES, AuditQueue, Document, DocumentVersion, Folder, GrowthReplayMaterial,
)

_VERSION_BLOCKLIST = ("基础版", "标准版", "高级版")


def _doc_dict(d: Document) -> dict:
    return {
        "doc_id": d.id, "doc_type": d.doc_type, "source_module": d.source_module,
        "hr_category": d.hr_category, "title": d.title, "content": d.content,
        "library_type": d.library_type, "status": d.status, "audit_status": d.audit_status,
        "is_desensitized": d.is_desensitized, "is_negative_blocked": d.is_negative_blocked,
        "watermark_required": d.watermark_required, "copy_char_limit": d.copy_char_limit,
        "vector_status": d.vector_status, "version": d.version, "is_starred": d.is_starred,
    }


def save_document(db: Session, owner_user_id: str, body) -> dict:
    """K1 归档。情绪激动内容直接拒绝上云。"""
    if body.is_emotion_agitated:
        # 隐私分级 L1：情绪激动期间内容仅端侧存储，绝不上云
        raise errors.E_AGITATED_NO_CLOUD

    doc = Document(
        owner_user_id=owner_user_id, library_type=body.library_type,
        doc_type=body.doc_type, source_module=body.source_module, hr_category=body.hr_category,
        title=body.title, content=body.content, file_object_id=body.file_object_id,
        status="draft", audit_status="pending",
        is_desensitized=body.is_desensitized, is_negative_blocked=body.is_negative,
        vector_status="pending", version=1,
    )
    db.add(doc)
    db.flush()

    # 进入待审核区（超30天提醒·不自动删除）
    now = utcnow()
    db.add(AuditQueue(doc_id=doc.id, entered_at=now, expire_remind_at=now + timedelta(days=30)))
    # 四步引擎中的「RAG向量化」异步触发占位：标记 pending，由⑤搜索服务消费
    db.commit()
    db.refresh(doc)
    return {"doc_id": doc.id, "status": doc.status, "vector_status": doc.vector_status}


def search(db: Session, owner_user_id: str, *, query: str, sources: list[str],
           exclude_negative: bool, top_n: int) -> dict:
    """K2 检索。本轮先实现私有库关键词/标题匹配；向量召回由⑤服务接入。

    品牌中心等调用方传 exclude_negative=True 时，过滤掉 is_negative_blocked=true 文档。
    """
    if "private" not in sources and "public" not in sources and "internet" not in sources:
        raise errors.E_SOURCE_DISABLED

    items: list[dict] = []
    if "private" in sources:
        stmt = select(Document).where(
            Document.owner_user_id == owner_user_id,
            Document.status == "published",
            Document.deleted_at.is_(None),
        )
        if exclude_negative:
            stmt = stmt.where(Document.is_negative_blocked.is_(False))
        for d in db.scalars(stmt).all():
            text = f"{d.title or ''} {d.content or ''}"
            if not query or query.lower() in text.lower():
                items.append({**_doc_dict(d), "source": "private"})

    if "public" in sources:
        stmt = select(Document).where(
            Document.library_type == "public", Document.status == "published",
            Document.deleted_at.is_(None),
        )
        for d in db.scalars(stmt).all():
            text = f"{d.title or ''} {d.content or ''}"
            if not query or query.lower() in text.lower():
                items.append({**_doc_dict(d), "source": "public"})

    # 私有库优先排序
    items.sort(key=lambda x: 0 if x["source"] == "private" else 1)
    return {"items": items, "total": len(items)}


def get_document(db: Session, owner_user_id: str, doc_id: str) -> dict:
    d = db.get(Document, doc_id)
    if not d or d.deleted_at is not None:
        raise errors.E_DOC_NOT_FOUND
    # 私有库越权访问校验（携君库 public 任何人可读）
    if d.library_type == "private" and d.owner_user_id != owner_user_id:
        raise errors.E_NO_PERMISSION
    return _doc_dict(d)


def edit_document(db: Session, owner_user_id: str, doc_id: str, body) -> dict:
    d = db.get(Document, doc_id)
    if not d or d.deleted_at is not None:
        raise errors.E_DOC_NOT_FOUND
    if d.owner_user_id != owner_user_id:
        raise errors.E_NO_PERMISSION
    # 保存历史版本
    db.add(DocumentVersion(doc_id=d.id, version=d.version, content_snapshot=d.content, edited_by=owner_user_id))
    if body.content is not None:
        d.content = body.content
    if body.hr_category is not None:
        d.hr_category = body.hr_category
    if body.folder_id is not None:
        d.folder_id = body.folder_id
    if body.title is not None:
        d.title = body.title
    d.version += 1
    db.commit()
    return _doc_dict(d)


def audit_queue(db: Session, owner_user_id: str, page: int, page_size: int) -> dict:
    stmt = select(Document).where(
        Document.owner_user_id == owner_user_id, Document.status == "draft",
        Document.audit_status == "pending",  # 排除已驳回文档
        Document.deleted_at.is_(None),
    ).offset((page - 1) * page_size).limit(page_size)
    docs = db.scalars(stmt).all()
    now = utcnow()
    items = []
    for d in docs:
        aq = db.scalar(select(AuditQueue).where(AuditQueue.doc_id == d.id))
        overdue = bool(aq and aq.entered_at and (now - aq.entered_at).days > 30)
        items.append({**_doc_dict(d), "overdue_30d": overdue})
    return {"items": items, "total": len(items)}


def _system_audit_four_dim(d: Document, version_naming: str | None) -> None:
    """系统审核四维检测：完整性 + 分类 + 脱敏 + 敏感信息。"""
    # 版本命名合规（禁止 基础版/标准版/高级版）
    if version_naming and any(b in version_naming for b in _VERSION_BLOCKLIST):
        raise errors.E_VERSION_NAMING
    # 负面内容禁止入库
    if d.is_negative_blocked:
        raise errors.E_NEGATIVE_BLOCKED
    # 脱敏合规（敏感模块要求已脱敏）
    if not d.is_desensitized and d.source_module in ("M2", "M3", "M6", "M10"):
        raise errors.E_NOT_DESENSITIZED
    # 完整性 + 分类
    if not d.doc_type or d.doc_type not in DOC_TYPES:
        raise errors.E_CATEGORY_MISMATCH


def approve(db: Session, owner_user_id: str, doc_ids: list[str], version_naming: str | None) -> dict:
    """K6 审核确认入库（单条/批量）。"""
    approved = 0
    for did in doc_ids:
        d = db.get(Document, did)
        if not d or d.owner_user_id != owner_user_id or d.deleted_at is not None:
            raise errors.E_DOC_NOT_FOUND
        _system_audit_four_dim(d, version_naming)
        d.status = "published"
        d.audit_status = "passed"
        aq = db.scalar(select(AuditQueue).where(AuditQueue.doc_id == d.id))
        if aq:
            db.delete(aq)
        approved += 1
    db.commit()
    return {"approved_count": approved}


def approve_all(db: Session, owner_user_id: str) -> dict:
    """K7 移动端一键批量确认（仅放行合规文档，不合规跳过并计数）。"""
    docs = db.scalars(
        select(Document).where(
            Document.owner_user_id == owner_user_id, Document.status == "draft",
            Document.deleted_at.is_(None),
        )
    ).all()
    approved, skipped = 0, 0
    for d in docs:
        try:
            _system_audit_four_dim(d, None)
        except errors.APIError:
            skipped += 1
            continue
        d.status = "published"
        d.audit_status = "passed"
        aq = db.scalar(select(AuditQueue).where(AuditQueue.doc_id == d.id))
        if aq:
            db.delete(aq)
        approved += 1
    db.commit()
    return {"approved_count": approved, "skipped_count": skipped}


def discard(db: Session, owner_user_id: str, doc_id: str) -> dict:
    d = db.get(Document, doc_id)
    if not d or d.owner_user_id != owner_user_id:
        raise errors.E_DOC_NOT_FOUND
    d.status = "recycled"
    d.deleted_at = utcnow()  # 回收站30天
    db.commit()
    return {"doc_id": d.id, "status": d.status}


def restore(db: Session, owner_user_id: str, doc_id: str) -> dict:
    d = db.get(Document, doc_id)
    if not d or d.owner_user_id != owner_user_id:
        raise errors.E_DOC_NOT_FOUND
    d.status = "draft"
    d.deleted_at = None
    db.commit()
    return _doc_dict(d)


def read_public(db: Session, doc_id: str) -> dict:
    """K10 携君库阅读——只读，附 500 字复制限制元信息。"""
    d = db.get(Document, doc_id)
    if not d or d.library_type != "public":
        raise errors.E_DOC_NOT_FOUND
    return {
        **_doc_dict(d),
        "downloadable": False,  # 不可下载
        "copy_char_limit": settings.PUBLIC_KB_COPY_CHAR_LIMIT,
        "trace_marker": d.trace_marker,
    }


def export_public_download_blocked() -> None:
    """携君库下载尝试——直接拒绝（40030）。"""
    raise errors.E_PUBLIC_KB_NO_DOWNLOAD


def copy_guard(length: int) -> dict:
    """携君库复制校验：>500 字拒绝（40031）。"""
    if length > settings.PUBLIC_KB_COPY_CHAR_LIMIT:
        raise errors.E_COPY_LIMIT
    return {"allow": True, "length": length}


def confirm_growth(db: Session, owner_user_id: str, doc_id: str) -> dict:
    """K14 成长素材确认——M3挫折经用户主动确认后转为品牌素材。"""
    d = db.get(Document, doc_id)
    if not d or d.owner_user_id != owner_user_id:
        raise errors.E_DOC_NOT_FOUND
    now = utcnow()
    d.growth_confirmed_by = owner_user_id
    grm = GrowthReplayMaterial(
        user_id=owner_user_id, source_doc_id=d.id,
        confirmed_by_user=True, confirmed_at=now, is_published=False,
    )
    db.add(grm)
    db.commit()
    return {"growth_material_id": grm.id, "source_doc_id": d.id, "confirmed_at": now.isoformat()}


# ── 步骤12 新增：统计 / 分类 / 驳回 / 导出 / 设置 ──

# HR八大模块规范名称（步骤12 §12.3）
HR_EIGHT_CATEGORIES = [
    "战略解码", "人资规划", "招聘配置", "培训开发",
    "薪酬福利", "绩效管理", "员工关系", "企业文化",
]


def get_stats(db: Session, owner_user_id: str) -> dict:
    """文档统计：总数、私有/携君、存储用量、今日新增。"""
    from sqlalchemy import func as F, case as C

    now = utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # 私有库已发布文档数
    private_count = db.scalar(
        select(F.count()).select_from(Document).where(
            Document.owner_user_id == owner_user_id,
            Document.library_type == "private",
            Document.status == "published",
            Document.deleted_at.is_(None),
        )
    ) or 0

    # 携君库已发布文档数
    public_count = db.scalar(
        select(F.count()).select_from(Document).where(
            Document.library_type == "public",
            Document.status == "published",
            Document.deleted_at.is_(None),
        )
    ) or 0

    # 今日新增（用户自己上传或归档的）
    today_new = db.scalar(
        select(F.count()).select_from(Document).where(
            Document.owner_user_id == owner_user_id,
            Document.created_at >= today_start,
            Document.deleted_at.is_(None),
        )
    ) or 0

    # 文件存储用量（MB近似，基于file_object记录）
    from ...shared.models.knowledge import FileObject
    storage_bytes = db.scalar(
        select(F.coalesce(F.sum(FileObject.size_bytes), 0)).select_from(Document).join(
            FileObject, Document.file_object_id == FileObject.id, isouter=True,
        ).where(
            Document.owner_user_id == owner_user_id,
            Document.deleted_at.is_(None),
        )
    ) or 0

    storage_used_gb = round(storage_bytes / (1024 * 1024 * 1024), 2)
    storage_limit_gb = float(getattr(settings, "USER_STORAGE_LIMIT_GB", 5))

    return {
        "totalDocs": private_count + public_count,
        "privateCount": private_count,
        "publicCount": public_count,
        "storageUsed": storage_used_gb,
        "storageLimit": storage_limit_gb,
        "todayNew": today_new,
    }


def get_categories(db: Session, owner_user_id: str) -> dict:
    """分类树：按HR八大模块统计文档数。"""
    from sqlalchemy import func as F

    # 按 hr_category 分组统计已发布文档数
    rows = db.execute(
        select(Document.hr_category, F.count(Document.id))
        .where(
            Document.owner_user_id == owner_user_id,
            Document.status == "published",
            Document.deleted_at.is_(None),
        )
        .group_by(Document.hr_category)
    ).all()

    count_map: dict[str, int] = {row[0]: row[1] for row in rows if row[0]}

    categories = []
    for i, name in enumerate(HR_EIGHT_CATEGORIES):
        categories.append({
            "id": f"cat-{i}",
            "name": name,
            "count": count_map.get(name, 0),
        })

    # 追加未分类
    uncategorized_count = sum(v for k, v in count_map.items() if k not in HR_EIGHT_CATEGORIES)
    if uncategorized_count > 0:
        categories.append({
            "id": "cat-uncategorized",
            "name": "其他",
            "count": uncategorized_count,
        })

    return {"categories": categories, "total": sum(c["count"] for c in categories)}


def get_hot_searches(db: Session, owner_user_id: str) -> dict:
    """热门搜索词（MVP：返回最近5条去重文档标题关键词）。"""
    from sqlalchemy import func as F

    titles = db.scalars(
        select(Document.title)
        .where(
            Document.owner_user_id == owner_user_id,
            Document.status == "published",
            Document.deleted_at.is_(None),
        )
        .order_by(Document.updated_at.desc())
        .limit(10)
    ).all()

    # 简单提取关键词（取前5个非空标题截断）
    keywords: list[str] = []
    for t in titles:
        if t and t not in keywords:
            keywords.append(t[:12])
        if len(keywords) >= 5:
            break

    if not keywords:
        keywords = ["薪酬激励方案", "SaaS市场调研", "OKR执行手册"]

    return {"keywords": keywords}


def reject_document(db: Session, owner_user_id: str, doc_id: str, body) -> dict:
    """驳回文档：设置审核状态为rejected，从待审核队列移除。"""
    d = db.get(Document, doc_id)
    if not d or d.owner_user_id != owner_user_id or d.deleted_at is not None:
        raise errors.E_DOC_NOT_FOUND
    d.audit_status = "rejected"
    d.status = "draft"  # 保留草稿状态，允许重新编辑
    aq = db.scalar(select(AuditQueue).where(AuditQueue.doc_id == d.id))
    if aq:
        db.delete(aq)
    db.commit()
    return {"doc_id": d.id, "audit_status": d.audit_status, "reason": body.reason}


def export_document(db: Session, owner_user_id: str, doc_id: str) -> dict:
    """文档导出（MVP：返回下载元数据，携君库拒绝导出）。"""
    d = db.get(Document, doc_id)
    if not d or d.deleted_at is not None:
        raise errors.E_DOC_NOT_FOUND
    if d.library_type == "private" and d.owner_user_id != owner_user_id:
        raise errors.E_NO_PERMISSION
    if d.library_type == "public":
        raise errors.E_PUBLIC_KB_NO_DOWNLOAD

    return {
        "doc_id": d.id,
        "title": d.title,
        "downloadUrl": f"/api/v1/kb/documents/{d.id}/export",
        "format": "pdf",
        "watermark": "日耕" if d.watermark_required else None,
    }


# 用户知识库设置（轻量：存内存字典，生产应落库）
_user_settings_cache: dict[str, dict] = {}


def get_settings(db: Session, owner_user_id: str) -> dict:
    """获取用户知识库设置。"""
    defaults = {
        "autoArchive": True,
        "watermarkEnabled": True,
        "storageAlertThreshold": 80,
    }
    return _user_settings_cache.get(owner_user_id, defaults)


def update_settings(db: Session, owner_user_id: str, body) -> dict:
    """更新用户知识库设置。"""
    current = _user_settings_cache.get(owner_user_id, {
        "autoArchive": True,
        "watermarkEnabled": True,
        "storageAlertThreshold": 80,
    })
    if body.auto_archive is not None:
        current["autoArchive"] = body.auto_archive
    if body.watermark_enabled is not None:
        current["watermarkEnabled"] = body.watermark_enabled
    if body.storage_alert_threshold is not None:
        current["storageAlertThreshold"] = body.storage_alert_threshold
    _user_settings_cache[owner_user_id] = current
    return current


def create_folder(db: Session, owner_user_id: str, body) -> dict:
    f = Folder(owner_user_id=owner_user_id, name=body.name, parent_id=body.parent_id, hr_category=body.hr_category)
    db.add(f)
    db.commit()
    return {"folder_id": f.id, "name": f.name}
