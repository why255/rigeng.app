"""携君智库接入 — 入库流水线编排器（A1→A5）。

串联整个入库流程：
A1: 接收zip上传 → 保存文件 → 创建IngestionTask
A2: 解析manifest.json → 校验checksum
A3: 提取YAML frontmatter → 映射到Document字段
A4: 文档正文 → 语义切分 → embedding → 向量存储
A5: 生成结构化入库报告 → 返回给上传方
"""
from __future__ import annotations

import hashlib
import logging
import os
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from ...shared.config import settings
from ...shared.database import GUID, new_uuid, utcnow
from ...shared.models.knowledge import (
    Document,
    DocumentVersion,
    IngestionReport,
    IngestionTask,
)
from .manifest_parser import dispatch_files, extract_file_content, parse_manifest, verify_checksum
from .vectorizer import get_vectorizer
from .yaml_mapper import (
    extract_yaml_frontmatter,
    map_yaml_to_document,
    validate_required_fields,
)

logger = logging.getLogger(__name__)


class IngestionPipeline:
    """入库流水线编排器。"""

    def __init__(self):
        self.vectorizer = get_vectorizer()

    # ── A1: 上传入口 ──

    def create_upload_task(
        self,
        db: Session,
        filename: str,
        file_content: bytes,
        operator_id: str | None = None,
    ) -> dict[str, Any]:
        """A1: 接收zip上传，保存文件并创建处理任务。

        Args:
            db: 数据库会话。
            filename: 原始文件名。
            file_content: 文件字节内容。
            operator_id: 操作人ID。

        Returns:
            {"upload_id": "upl_...", "message": "文件已接收,开始解析"}

        Raises:
            ValueError: 文件不是zip格式或超过大小限制。
        """
        max_mb = getattr(settings, "XIEJUN_UPLOAD_MAX_MB", 250)
        max_bytes = max_mb * 1024 * 1024

        if len(file_content) > max_bytes:
            raise ValueError(f"文件大小超过限制 ({max_mb}MB)")

        if not filename.lower().endswith(".zip"):
            raise ValueError("仅支持 .zip 格式文件")

        # 生成 upload_id: upl_YYYYMMDD_HHMM_xxxxxx
        now = datetime.now(timezone.utc)
        ts = now.strftime("%Y%m%d_%H%M")
        rand = new_uuid()[:6]
        upload_id = f"upl_{ts}_{rand}"

        # 保存zip到本地存储
        storage_dir = getattr(settings, "XIEJUN_STORAGE_DIR", "./storage/xiejun_uploads")
        os.makedirs(storage_dir, exist_ok=True)
        zip_path = os.path.join(storage_dir, f"{upload_id}.zip")
        with open(zip_path, "wb") as f:
            f.write(file_content)

        file_hash = hashlib.sha256(file_content).hexdigest()

        # 创建 IngestionTask 记录
        task = IngestionTask(
            upload_id=upload_id,
            filename=filename,
            file_size_bytes=len(file_content),
            status="uploaded",
            operator_id=operator_id,
        )
        db.add(task)
        db.commit()
        db.refresh(task)

        logger.info(
            "A1 上传完成: upload_id=%s, filename=%s, size=%d, sha256=%s",
            upload_id, filename, len(file_content), file_hash[:16],
        )

        return {
            "success": True,
            "upload_id": upload_id,
            "message": "文件已接收,开始解析",
        }

    # ── A1→A5: 全流程处理 ──

    def process_upload(self, db: Session, upload_id: str) -> dict[str, Any]:
        """执行完整的 A1→A5 入库流水线。

        Args:
            db: 数据库会话。
            upload_id: A1返回的upload_id。

        Returns:
            处理完成后的任务状态字典。
        """
        # 加载任务
        task = db.query(IngestionTask).filter(
            IngestionTask.upload_id == upload_id,
        ).first()

        if not task:
            raise ValueError(f"未找到上传任务: {upload_id}")

        storage_dir = getattr(settings, "XIEJUN_STORAGE_DIR", "./storage/xiejun_uploads")
        zip_path = os.path.join(storage_dir, f"{upload_id}.zip")

        if not os.path.exists(zip_path):
            task.status = "failed"
            task.error_message = f"zip文件不存在: {zip_path}"
            db.commit()
            return self._task_status(task)

        try:
            # ── A2: 解析 manifest ──
            task.status = "parsing"
            db.commit()

            manifest = parse_manifest(zip_path)
            task.package_id = manifest.get("package_id", "")
            dispatched = dispatch_files(manifest)

            total = (
                len(dispatched["new"])
                + len(dispatched["updated"])
                + len(dispatched["deleted"])
            )
            task.total_files = total
            task.status = "processing"
            db.commit()

            logger.info(
                "A2 manifest解析完成: package=%s, new=%d, updated=%d, deleted=%d",
                task.package_id,
                len(dispatched["new"]),
                len(dispatched["updated"]),
                len(dispatched["deleted"]),
            )

            # ── A3+A4: 逐文件处理 ──
            results = self._process_files(db, zip_path, dispatched, manifest)

            # ── A5: 生成报告 ──
            report = self._generate_report(db, task, results, manifest)

            # 更新任务状态
            task.report_id = report.id
            task.success_count = results["success"]
            task.failed_count = results["failed"]
            task.pending_review_count = results["pending_review"]
            task.processed_files = results["success"] + results["failed"]

            if results["failed"] > 0 and results["pending_review"] > 0:
                task.status = "completed_with_warnings"
            elif results["failed"] > 0:
                task.status = "completed_with_warnings"
            else:
                task.status = "completed"

            db.commit()
            logger.info("A5 入库完成: %s", task.status)

        except Exception as e:
            logger.exception("入库流水线失败: %s", e)
            task.status = "failed"
            task.error_message = str(e)[:500]
            db.commit()

        return self._task_status(task)

    # ── 内部方法 ──

    def _process_files(
        self,
        db: Session,
        zip_path: str,
        dispatched: dict,
        manifest: dict,
    ) -> dict[str, int]:
        """逐文件处理: new/updated → 创建/更新Document + 向量化, deleted → 软删除。"""
        success = 0
        failed = 0
        pending_review = 0
        failures: list[dict] = []
        pending: list[dict] = []

        # 处理 new + updated
        for action in ("new", "updated"):
            for entry in dispatched.get(action, []):
                file_path = entry["path"]
                try:
                    # 校验checksum
                    expected_cs = entry.get("checksum", "")
                    if expected_cs and not verify_checksum(zip_path, file_path, expected_cs):
                        failures.append({
                            "path": file_path,
                            "reason": f"checksum校验失败: expected={expected_cs[:20]}...",
                        })
                        failed += 1
                        continue

                    # 提取文件内容
                    content_bytes = extract_file_content(zip_path, file_path)
                    md_content = content_bytes.decode("utf-8")

                    # A3: YAML解析
                    yaml_data, body_text = extract_yaml_frontmatter(md_content)

                    # 校验必填字段
                    missing = validate_required_fields(yaml_data)
                    if missing:
                        failures.append({
                            "path": file_path,
                            "reason": f"YAML缺失必填字段: {', '.join(missing)}",
                        })
                        failed += 1
                        continue

                    # 映射到Document字段
                    doc_kwargs = map_yaml_to_document(yaml_data, body_text, file_path)

                    if action == "updated":
                        # 查找旧文档 → 保存版本 → 更新
                        existing = self._find_existing_doc(db, file_path, entry)
                        if existing:
                            # 保存旧版本
                            db.add(DocumentVersion(
                                doc_id=existing.id,
                                version=existing.version,
                                content_snapshot=existing.content,
                            ))
                            # 更新字段
                            for key, val in doc_kwargs.items():
                                if hasattr(existing, key) and key != "id":
                                    setattr(existing, key, val)
                            existing.version += 1
                            doc = existing
                        else:
                            # 找不到旧文档，按new处理
                            doc = Document(**doc_kwargs)
                            db.add(doc)
                    else:
                        doc = Document(**doc_kwargs)
                        db.add(doc)

                    db.flush()

                    # A4: 向量化
                    body_for_vector = body_text if body_text else str(doc_kwargs.get("content", ""))
                    self.vectorizer.index_document(db, doc.id, body_for_vector)

                    # sensitivity=L2 → 待人工审核
                    if doc_kwargs.get("sensitivity") == "L2":
                        pending.append({
                            "path": file_path,
                            "reason": "sensitivity=L2,需人工审核",
                        })
                        pending_review += 1

                    success += 1

                except Exception as e:
                    logger.exception("处理文件失败: %s", file_path)
                    failures.append({
                        "path": file_path,
                        "reason": str(e)[:200],
                    })
                    failed += 1

            # 处理 deleted
            for entry in dispatched.get("deleted", []):
                file_path = entry.get("path", "")
                try:
                    existing = self._find_existing_doc(db, file_path, entry)
                    if existing:
                        # 软删除: 30天回收站
                        existing.status = "recycled"
                        existing.deleted_at = utcnow()
                        success += 1
                except Exception as e:
                    logger.exception("删除文件失败: %s", file_path)
                    failures.append({
                        "path": file_path,
                        "reason": f"删除失败: {e}",
                    })
                    failed += 1

            # 存储 failures 和 pending_review 到 task（临时存储，报告生成时使用）
            # 使用类属性临时存储
            self._temp_failures = failures
            self._temp_pending = pending

            return {
                "success": success,
                "failed": failed,
                "pending_review": pending_review,
            }

    def _find_existing_doc(
        self,
        db: Session,
        file_path: str,
        entry: dict,
    ) -> Document | None:
        """查找已存在的文档（用于 updated/deleted 操作）。

        匹配策略：按 source_id > 按文件路径。
        """
        yaml_summary = entry.get("yaml_summary", {})
        source_id = yaml_summary.get("source_id") if isinstance(yaml_summary, dict) else None

        query = db.query(Document).filter(
            Document.library_type == "public",
            Document.deleted_at == None,
        )

        if source_id:
            doc = query.filter(Document.source_id == source_id).first()
            if doc:
                return doc

        # 按文件路径查找（存储路径字段）
        # 由于Document可能没有直接存file_path，这里按title模糊匹配
        return None

    def _generate_report(
        self,
        db: Session,
        task: IngestionTask,
        results: dict[str, int],
        manifest: dict,
    ) -> IngestionReport:
        """A5: 生成结构化入库报告。"""
        now = utcnow()

        report = IngestionReport(
            task_id=task.id,
            package_id=task.package_id,
            process_time=now,
            status=task.status,
            counts={
                "processed": task.total_files,
                "success": results["success"],
                "failed": results["failed"],
                "pending_review": results["pending_review"],
            },
            failures=getattr(self, "_temp_failures", []),
            pending_review=getattr(self, "_temp_pending", []),
        )
        db.add(report)
        db.flush()
        return report

    def _task_status(self, task: IngestionTask) -> dict[str, Any]:
        """构造任务状态响应。"""
        return {
            "upload_id": task.upload_id,
            "package_id": task.package_id,
            "status": task.status,
            "total_files": task.total_files,
            "processed_files": task.processed_files,
            "success_count": task.success_count,
            "failed_count": task.failed_count,
            "pending_review_count": task.pending_review_count,
            "report_id": task.report_id,
            "error_message": task.error_message,
            "created_at": task.created_at.isoformat() if task.created_at else "",
            "updated_at": task.updated_at.isoformat() if task.updated_at else "",
        }

    # ── 查询接口 ──

    def get_task_status(self, db: Session, upload_id: str) -> dict[str, Any] | None:
        """查询上传任务的处理状态。"""
        task = db.query(IngestionTask).filter(
            IngestionTask.upload_id == upload_id,
        ).first()
        if not task:
            return None
        return self._task_status(task)

    def get_report(self, db: Session, upload_id: str) -> dict[str, Any] | None:
        """获取入库报告（A5）。"""
        task = db.query(IngestionTask).filter(
            IngestionTask.upload_id == upload_id,
        ).first()
        if not task or not task.report_id:
            return None

        report = db.query(IngestionReport).filter(
            IngestionReport.id == task.report_id,
        ).first()
        if not report:
            return None

        return {
            "upload_id": task.upload_id,
            "package_id": report.package_id,
            "process_time": report.process_time.isoformat() if report.process_time else "",
            "status": report.status,
            "counts": report.counts,
            "failures": report.failures or [],
            "pending_review": report.pending_review or [],
        }

    def list_tasks(
        self,
        db: Session,
        page: int = 1,
        page_size: int = 20,
    ) -> dict[str, Any]:
        """查询zip上传历史列表。"""
        base = db.query(IngestionTask).order_by(IngestionTask.created_at.desc())
        total = base.count()
        rows = base.offset((page - 1) * page_size).limit(page_size).all()

        items = [self._task_status(r) for r in rows]
        return {"items": items, "total": total, "page": page, "page_size": page_size}


# 模块级单例
_pipeline: IngestionPipeline | None = None


def get_pipeline() -> IngestionPipeline:
    """获取入库流水线单例。"""
    global _pipeline
    if _pipeline is None:
        _pipeline = IngestionPipeline()
    return _pipeline
