"""智能记录服务 — 路由层（步骤15）。

API 端点（匹配前端 recordings.ts API封装）：
  GET    /recordings/today              — 今日录音统计
  GET    /recordings/recent             — 最近录音列表
  POST   /recordings/start              — 开始录音
  POST   /recordings/chunk              — 上传音频流分片（实时ASR转写）
  POST   /recordings/stop               — 停止录音（触发处理流水线）
  POST   /recordings/{id}/asr-auth      — 获取实时ASR WebSocket授权
  GET    /recordings/{id}/transcript    — 获取转写文本
  GET    /recordings/{id}/audio         — 下载/流式播放录音音频
  GET    /recordings/{id}/extraction    — 获取萃取结果
  POST   /recordings/{id}/archive       — 归档到知识库
  POST   /recordings/{id}/sync-actions  — 行动项同步到朝有规划
  GET    /recordings                    — 获取录音历史列表（支持搜索）
  DELETE  /recordings/{id}              — 删除录音
  GET    /recordings/teleprompter       — 面试提词器（跨模块联动）
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile, WebSocket
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ...shared.database import get_db
from ...shared.response import ok
from ...shared.security import CurrentUser, get_current_user
from . import service
from .schemas import (
    ActionItemSyncRequest,
    ArchiveRequest,
    RecordingStartRequest,
    RecordingStopRequest,
)

router = APIRouter(tags=["智能记录"], prefix="/recordings")
logger = logging.getLogger("smart_record.router")


# ═══════════════════════════════════════════════
# 录音生命周期
# ═══════════════════════════════════════════════

@router.post("/start")
def start(
    body: RecordingStartRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """开始录音：创建录音记录，状态设为recording。"""
    return ok(service.start_recording(db, user.user_id, body.scene))


@router.post("/stop")
def stop(
    body: RecordingStopRequest,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """停止录音：更新状态→transcribing，自动触发转写+萃取流水线。"""
    result = service.stop_recording(
        db, user.user_id, body.recording_id,
        duration_seconds=body.duration_seconds or 0,
    )
    # 自动触发处理流水线
    service.auto_process_recording(db, body.recording_id, user.user_id)
    return ok(result)


# ═══════════════════════════════════════════════
# 实时 ASR：音频流上传 + 实时转写
# ═══════════════════════════════════════════════

@router.post("/chunk")
def upload_chunk(
    chunk: UploadFile = File(...),
    recording_id: str = Form(...),
    chunk_index: int = Form(default=0),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """上传音频流分片，实时调用腾讯云ASR转写。

    前端使用 MediaRecorder 每5秒产出一个chunk，
    后端收到后调用腾讯云 SentenceRecognition 实时转写，
    转写结果实时存入 TranscriptSegment 表。
    """
    audio_data = chunk.file.read()
    result = service.process_audio_chunk(
        db, user.user_id, recording_id, audio_data, chunk_index,
    )
    return ok(result)


@router.get("/{recording_id}/audio")
def audio(
    recording_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """流式播放/下载录音音频文件。"""
    info = service.serve_recording_audio(db, recording_id, user.user_id)
    return FileResponse(
        path=info["file_path"],
        media_type=info.get("content_type", "audio/webm"),
        headers={"Content-Length": str(info.get("file_size", 0))},
    )


@router.post("/{recording_id}/asr-auth")
def asr_auth(
    recording_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取腾讯云实时语音识别 WebSocket 授权参数。

    前端可使用返回的 ws_url 直接连接腾讯云 ASR WebSocket，
    进行真正的流式实时转写（延迟<500ms）。
    """
    # 验证录音存在
    recording = db.query(service.Recording).filter(
        service.Recording.id == recording_id,
        service.Recording.user_id == user.user_id,
        service.Recording.deleted_at.is_(None),
    ).first()
    if not recording:
        from ...shared.errors import APIError
        raise APIError(60002, "录音不存在", 404)

    from ..voice_engine.service import get_realtime_asr_auth
    return ok(get_realtime_asr_auth())


# ═══════════════════════════════════════════════
# 查询：统计 / 列表
# ═══════════════════════════════════════════════

@router.get("/today")
def today_stats(
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取今日录音统计：录音数、总时长、完成/处理中数量。"""
    return ok(service.get_today_stats(db, user.user_id))


@router.get("/recent")
def recent(
    limit: int = Query(default=5, le=20),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取最近录音列表。"""
    return ok(service.get_recent_recordings(db, user.user_id, limit))


@router.get("")
def history(
    search: str | None = Query(None),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取录音历史列表，支持按标题搜索。"""
    return ok(service.get_recording_history(db, user.user_id, search))


# ═══════════════════════════════════════════════
# 转写 / 萃取
# ═══════════════════════════════════════════════

@router.get("/{recording_id}/transcript")
def transcript(
    recording_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取转写文本分段。如果尚未转写，自动触发转写处理。"""
    return ok(service.get_transcript(db, user.user_id, recording_id))


@router.get("/{recording_id}/extraction")
def extraction(
    recording_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取AI萃取结果。如果尚未萃取，自动触发萃取处理。"""
    return ok(service.get_extraction(db, user.user_id, recording_id))


# ═══════════════════════════════════════════════
# 归档 / 同步
# ═══════════════════════════════════════════════

@router.post("/{recording_id}/archive")
def archive(
    recording_id: str,
    body: ArchiveRequest | None = None,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """归档萃取结果到知识库。创建结构化文档，进入待审核区。"""
    hr_category = body.hr_category if body else None
    return ok(service.archive_to_knowledge_base(
        db, user.user_id, recording_id, hr_category,
    ))


@router.post("/{recording_id}/sync-actions")
def sync_actions(
    recording_id: str,
    body: ActionItemSyncRequest | None = None,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """将萃取出的行动项同步到朝有规划，作为今日任务。"""
    action_item_ids = body.action_item_ids if body else None
    plan_id = body.plan_id if body else None
    return ok(service.sync_action_items_to_plan(
        db, user.user_id, recording_id, action_item_ids, plan_id,
    ))


# ═══════════════════════════════════════════════
# 删除
# ═══════════════════════════════════════════════

@router.delete("/{recording_id}")
def delete(
    recording_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """软删除录音及其关联数据（转写/萃取/行动项）。"""
    return ok(service.delete_recording(db, user.user_id, recording_id))


# ═══════════════════════════════════════════════
# 跨模块：面试提词器
# ═══════════════════════════════════════════════

@router.get("/teleprompter/questions")
def teleprompter(
    position: str | None = Query(None),
    stage: str | None = Query(None),
    user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取面试提词器问题列表（联动智能问答）。"""
    return ok(service.get_teleprompter(db, user.user_id, position, stage))
