"""②公私知识库服务 路由层（步骤3 §4：K1-K16 核心）。"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ...shared.database import get_db
from ...shared.response import ok, page
from ...shared.security import CurrentUser, get_current_user
from . import service
from .schemas import ApproveIn, EditDocIn, FolderIn, RejectIn, SaveDocIn, UpdateSettingsIn

router = APIRouter(prefix="/kb", tags=["②公私知识库"])


@router.post("/documents")  # K1 saveToKnowledgeBase
def save_doc(body: SaveDocIn, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(service.save_document(db, user.user_id, body))


@router.get("/search")  # K2 searchKnowledgeBase
def search(
    query: str = Query(default=""),
    sources: str = Query(default="private"),  # 逗号分隔 private,public,internet
    exclude_negative: bool = Query(default=False),
    top_n: int = Query(default=5, le=50),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    src = [s.strip() for s in sources.split(",") if s.strip()]
    res = service.search(db, user.user_id, query=query, sources=src,
                         exclude_negative=exclude_negative, top_n=top_n)
    return ok(res)


@router.get("/audit-queue")  # K5
def audit_queue(page_no: int = Query(default=1, alias="page"), page_size: int = Query(default=20, le=100),
                user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    res = service.audit_queue(db, user.user_id, page_no, page_size)
    return page(res["items"], res["total"], page_no, page_size)


@router.post("/audit-queue:approve-all")  # K7
def approve_all(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(service.approve_all(db, user.user_id))


# ⚠️ 静态/具体路径必须声明在 /public/{doc_id} 之前，避免被参数路由捕获
@router.get("/public-copy-guard")  # 携君库复制校验 → >500字 40031
def copy_guard(length: int = Query(...), user: CurrentUser = Depends(get_current_user)):
    return ok(service.copy_guard(length))


@router.get("/public/{doc_id}/download")  # 携君库下载尝试 → 40030
def download_public(doc_id: str, user: CurrentUser = Depends(get_current_user)):
    service.export_public_download_blocked()


@router.get("/public/{doc_id}")  # K10 携君库阅读（只读）
def read_public(doc_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(service.read_public(db, doc_id))


@router.get("/documents/{doc_id}")  # K3
def get_doc(doc_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(service.get_document(db, user.user_id, doc_id))


@router.patch("/documents/{doc_id}")  # K4
def edit_doc(doc_id: str, body: EditDocIn, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(service.edit_document(db, user.user_id, doc_id, body))


@router.post("/documents/{doc_id}:approve")  # K6
def approve(doc_id: str, body: ApproveIn, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    ids = body.doc_ids or [doc_id]
    return ok(service.approve(db, user.user_id, ids, body.version_naming))


@router.post("/documents/{doc_id}:discard")  # K8
def discard(doc_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(service.discard(db, user.user_id, doc_id))


@router.post("/documents/{doc_id}:restore")  # K9
def restore(doc_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(service.restore(db, user.user_id, doc_id))


@router.post("/documents/{doc_id}:confirm-growth")  # K14
def confirm_growth(doc_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(service.confirm_growth(db, user.user_id, doc_id))


@router.post("/documents/{doc_id}:reject")  # 步骤12 驳回
def reject(doc_id: str, body: RejectIn, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(service.reject_document(db, user.user_id, doc_id, body))


@router.get("/documents/{doc_id}/export")  # 步骤12 导出
def export_doc(doc_id: str, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(service.export_document(db, user.user_id, doc_id))


@router.get("/stats")  # 步骤12 文档统计
def stats(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(service.get_stats(db, user.user_id))


@router.get("/categories")  # 步骤12 分类树
def categories(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(service.get_categories(db, user.user_id))


@router.get("/search/hot")  # 步骤12 热门搜索
def hot_searches(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(service.get_hot_searches(db, user.user_id))


@router.get("/settings")  # 步骤12 获取设置
def get_settings(user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(service.get_settings(db, user.user_id))


@router.patch("/settings")  # 步骤12 更新设置
def update_settings(body: UpdateSettingsIn, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(service.update_settings(db, user.user_id, body))


@router.post("/folders")  # K13
def create_folder(body: FolderIn, user: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return ok(service.create_folder(db, user.user_id, body))
