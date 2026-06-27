"""智能记录服务 — 核心业务逻辑（步骤15）。

跨模块调用链（步骤15 §15.3）：
  录音 → ③语音引擎（ASR转写）
  转写 → ③AI引擎（结构化萃取）
  萃取 → ②知识库（归档） + ①朝有规划（行动项同步）
  文件 → ④文件存储（音频压缩/存储）

设计原则：
  - 只写业务逻辑层，基础能力全部调用已有服务
  - 面试提词器联动智能问答（跨模块）
  - 1小时录音≤1GB（文件存储服务的自动压缩）
"""
from __future__ import annotations

import base64
import json
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from ...shared.config import settings
from ...shared.database import new_uuid, utcnow
from ...shared.errors import APIError, E_FILE_NOT_FOUND, E_PARAM_FORMAT
from ...shared.models.recording import (
    RECORDING_SCENES, RECORDING_STATUSES,
    ActionItem, ExtractionResult, Recording, TranscriptSegment,
)

logger = logging.getLogger("smart_record")

# 场景→颜色映射
SCENE_COLORS: dict[str, str] = {
    "面试": "#6B8FBF",
    "会议": "#D4A574",
    "日常": "#BCAAA4",
    "自定义": "#E8A94D",
}


def _scene_color(scene: str) -> str:
    return SCENE_COLORS.get(scene, "#BCAAA4")


def _format_duration(seconds: int) -> str:
    """格式化秒数为 mm:ss 或 hh:mm:ss。"""
    if seconds <= 0:
        return "00:00"
    m, s = divmod(seconds, 60)
    h, m = divmod(m, 60)
    if h > 0:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"


def _recording_to_list_dict(r: Recording) -> dict[str, Any]:
    """录音ORM → 列表项字典。"""
    # 计算进度
    progress = None
    if r.status == "transcribing":
        progress = 30  # MVP 固定进度
    elif r.status == "extracting":
        progress = 70
    elif r.status == "completed":
        progress = 100

    return {
        "id": r.id,
        "title": r.title or "未命名录音",
        "scene": r.scene or "日常",
        "scene_color": _scene_color(r.scene or ""),
        "date": _format_date_relative(r.created_at),
        "duration": _format_duration(r.duration_seconds or 0),
        "duration_sec": r.duration_seconds or 0,
        "status": r.status or "recording",
        "progress": progress,
    }


def _format_date_relative(dt: datetime | None) -> str:
    """格式化日期为相对描述。"""
    if not dt:
        return ""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if dt.date() == now.date():
        return f"今天 {dt.strftime('%H:%M')}"
    yesterday = now.date() - timedelta(days=1)
    if dt.date() == yesterday:
        return f"昨天 {dt.strftime('%H:%M')}"
    return dt.strftime("%m-%d %H:%M")


# ═══════════════════════════════════════════════
# 录音生命周期
# ═══════════════════════════════════════════════

def start_recording(db: Session, user_id: str, scene: str) -> dict[str, Any]:
    """开始录音：创建 Recording 记录，状态=recording。"""
    if scene not in RECORDING_SCENES:
        scene = "自定义"

    recording = Recording(
        user_id=user_id,
        title=f"{scene}录音",
        scene=scene,
        status="recording",
        duration_seconds=0,
    )
    db.add(recording)
    db.commit()
    db.refresh(recording)

    logger.info("录音已开始: recording_id=%s scene=%s", recording.id, scene)

    return {
        "recording_id": recording.id,
        "scene": scene,
        "status": "recording",
    }


def stop_recording(db: Session, user_id: str, recording_id: str) -> dict[str, Any]:
    """停止录音：更新状态→transcribing，记录时长，触发异步转写。"""
    recording = db.query(Recording).filter(
        Recording.id == recording_id,
        Recording.user_id == user_id,
        Recording.deleted_at.is_(None),
    ).first()

    if not recording:
        raise APIError(60002, "录音不存在", 404)

    if recording.status != "recording":
        raise APIError(20001, "该录音已停止或已处理", 400)

    recording.status = "transcribing"
    recording.transcript_status = "processing"
    db.commit()
    db.refresh(recording)

    logger.info("录音已停止: recording_id=%s duration=%ds", recording_id, recording.duration_seconds or 0)

    return {
        "recording_id": recording.id,
        "status": recording.status,
        "duration_seconds": recording.duration_seconds or 0,
        "file_size_bytes": recording.file_size_bytes or 0,
    }


# ═══════════════════════════════════════════════
# 转写处理
# ═══════════════════════════════════════════════

def process_transcript(db: Session, recording_id: str, user_id: str) -> dict[str, Any]:
    """处理转写：模拟ASR转写，生成分段文本。

    生产环境：调用 voice_engine.recognize_speech() 进行真实ASR。
    MVP阶段：基于场景生成模拟转写数据。
    """
    recording = db.query(Recording).filter(
        Recording.id == recording_id,
        Recording.user_id == user_id,
        Recording.deleted_at.is_(None),
    ).first()
    if not recording:
        raise APIError(60002, "录音不存在", 404)

    # 清除旧分段（如有）
    db.query(TranscriptSegment).filter(
        TranscriptSegment.recording_id == recording_id,
    ).delete()

    # 模拟转写分段
    mock_segments = _generate_mock_transcript(recording.scene or "日常", recording.duration_seconds or 60)

    for i, seg in enumerate(mock_segments):
        ts = TranscriptSegment(
            recording_id=recording_id,
            user_id=user_id,
            segment_index=i,
            speaker=seg.get("speaker", "未知"),
            speaker_role=seg.get("speaker_role", "unknown"),
            start_time_seconds=seg.get("start_sec", i * 10.0),
            end_time_seconds=seg.get("end_sec", (i + 1) * 10.0),
            text=seg.get("text", ""),
            confidence=seg.get("confidence", 0.95),
            is_candidate=seg.get("is_candidate", False),
        )
        db.add(ts)

    recording.transcript_status = "done"
    recording.status = "extracting"
    recording.extraction_status = "processing"
    db.commit()

    logger.info("转写完成: recording_id=%s segments=%d", recording_id, len(mock_segments))

    return {
        "recording_id": recording_id,
        "segments_count": len(mock_segments),
        "status": "extracting",
    }


def get_transcript(db: Session, user_id: str, recording_id: str) -> dict[str, Any]:
    """获取转写结果。如果尚未转写，触发转写处理。"""
    recording = db.query(Recording).filter(
        Recording.id == recording_id,
        Recording.user_id == user_id,
        Recording.deleted_at.is_(None),
    ).first()
    if not recording:
        raise APIError(60002, "录音不存在", 404)

    # 如果尚未转写，触发转写
    if recording.transcript_status != "done":
        process_transcript(db, recording_id, user_id)
        db.refresh(recording)

    # 查询分段
    segments = (
        db.query(TranscriptSegment)
        .filter(
            TranscriptSegment.recording_id == recording_id,
            TranscriptSegment.deleted_at.is_(None),
        )
        .order_by(TranscriptSegment.segment_index)
        .all()
    )

    segment_list = []
    for seg in segments:
        start_sec = seg.start_time_seconds or 0
        m = int(start_sec // 60)
        s = int(start_sec % 60)
        time_str = f"{m:02d}:{s:02d}"

        segment_list.append({
            "speaker": seg.speaker or "未知",
            "time": time_str,
            "text": seg.text or "",
            "confidence": int((seg.confidence or 0.95) * 100),
            "is_candidate": bool(seg.is_candidate),
        })

    return {
        "recording_id": recording.id,
        "title": recording.title or "",
        "scene": recording.scene or "",
        "duration_seconds": recording.duration_seconds or 0,
        "audio_url": f"/api/v1/recordings/{recording_id}/audio",
        "segments": segment_list,
    }


def _generate_mock_transcript(scene: str, duration_seconds: int) -> list[dict]:
    """生成模拟转写分段（MVP阶段，生产环境用ASR替换）。"""
    if scene == "面试":
        return [
            {"speaker": "面试官", "speaker_role": "interviewer", "start_sec": 0, "end_sec": 8,
             "text": "你好，欢迎来参加面试。请先简单介绍一下你自己吧。", "confidence": 0.97},
            {"speaker": "候选人", "speaker_role": "candidate", "start_sec": 8, "end_sec": 25,
             "text": "面试官你好，我有5年相关工作经验，毕业于计算机专业，擅长后端开发和系统架构设计。",
             "confidence": 0.95, "is_candidate": True},
            {"speaker": "面试官", "speaker_role": "interviewer", "start_sec": 25, "end_sec": 35,
             "text": "你在之前的项目中遇到过什么技术挑战吗？", "confidence": 0.98},
            {"speaker": "候选人", "speaker_role": "candidate", "start_sec": 35, "end_sec": 55,
             "text": "之前负责一个高并发系统改造，通过引入消息队列和缓存层，将系统吞吐量提升了3倍，响应时间降低了60%。",
             "confidence": 0.88, "is_candidate": True},
            {"speaker": "面试官", "speaker_role": "interviewer", "start_sec": 55, "end_sec": 65,
             "text": "听起来很不错。你平时怎么做技术选型的？", "confidence": 0.96},
            {"speaker": "候选人", "speaker_role": "candidate", "start_sec": 65, "end_sec": 80,
             "text": "我会根据业务需求、团队能力和生态成熟度综合评估。核心原则是简单优先、演进式架构。",
             "confidence": 0.93, "is_candidate": True},
        ]
    elif scene == "会议":
        return [
            {"speaker": "主持人", "speaker_role": "speaker", "start_sec": 0, "end_sec": 10,
             "text": "今天我们同步一下上周的进度，以及本周的重点事项。", "confidence": 0.97},
            {"speaker": "成员A", "speaker_role": "speaker", "start_sec": 10, "end_sec": 25,
             "text": "上周完成了用户模块的重构，本周计划启动权限系统的开发。",
             "confidence": 0.94},
            {"speaker": "成员B", "speaker_role": "speaker", "start_sec": 25, "end_sec": 40,
             "text": "数据分析模块的接口文档已经更新，需要后端确认字段定义。",
             "confidence": 0.91},
            {"speaker": "主持人", "speaker_role": "speaker", "start_sec": 40, "end_sec": 50,
             "text": "好的，那本周重点：权限系统开发 + 数据分析接口联调，大家确认一下。",
             "confidence": 0.96},
        ]
    else:
        # 日常 / 自定义
        return [
            {"speaker": "用户", "speaker_role": "speaker", "start_sec": 0, "end_sec": 12,
             "text": "今天想到一个关于员工培训体系优化的好点子。", "confidence": 0.95},
            {"speaker": "用户", "speaker_role": "speaker", "start_sec": 12, "end_sec": 28,
             "text": "可以把培训分成三个层级：新人入职培训、岗位技能提升、管理层领导力发展。",
             "confidence": 0.92},
            {"speaker": "用户", "speaker_role": "speaker", "start_sec": 28, "end_sec": 40,
             "text": "每个层级都设置必修课和选修课，跟晋升体系挂钩。",
             "confidence": 0.94},
        ]


# ═══════════════════════════════════════════════
# AI萃取
# ═══════════════════════════════════════════════

def process_extraction(db: Session, recording_id: str, user_id: str) -> dict[str, Any]:
    """执行AI萃取：从转写文本中结构化提取关键信息。

    生产环境：调用 voice_engine.llm_generate() 进行真实AI萃取。
    MVP阶段：基于场景生成模拟萃取数据。
    """
    recording = db.query(Recording).filter(
        Recording.id == recording_id,
        Recording.user_id == user_id,
        Recording.deleted_at.is_(None),
    ).first()
    if not recording:
        raise APIError(60002, "录音不存在", 404)

    # 查询转写文本
    segments = (
        db.query(TranscriptSegment)
        .filter(
            TranscriptSegment.recording_id == recording_id,
            TranscriptSegment.deleted_at.is_(None),
        )
        .order_by(TranscriptSegment.segment_index)
        .all()
    )

    # 生成萃取内容
    scene = recording.scene or "日常"
    content_json, summary, action_items_data = _generate_mock_extraction(scene, segments)

    # 清除旧萃取结果
    db.query(ExtractionResult).filter(
        ExtractionResult.recording_id == recording_id,
    ).delete()
    # 清除旧行动项
    db.query(ActionItem).filter(
        ActionItem.recording_id == recording_id,
    ).delete()

    # 创建萃取结果
    extraction = ExtractionResult(
        recording_id=recording_id,
        user_id=user_id,
        extraction_type="interview_profile" if scene == "面试" else (
            "meeting_minutes" if scene == "会议" else "daily_notes"
        ),
        content_json=content_json,
        summary=summary,
        model_used="mock_mvp",
        extraction_cost_tokens=0,
    )
    db.add(extraction)
    db.flush()

    # 创建行动项
    for ai_data in action_items_data:
        action_item = ActionItem(
            recording_id=recording_id,
            extraction_id=extraction.id,
            user_id=user_id,
            title=ai_data.get("title", ""),
            description=ai_data.get("description", ""),
            priority=ai_data.get("priority", "medium"),
            due_date=ai_data.get("due_date"),
            synced_to_plan=False,
        )
        db.add(action_item)

    recording.extraction_status = "done"
    recording.status = "completed"
    recording.title = _generate_recording_title(scene, content_json)
    db.commit()

    logger.info("萃取完成: recording_id=%s type=%s", recording_id, extraction.extraction_type)

    return {
        "recording_id": recording_id,
        "extraction_type": extraction.extraction_type,
        "status": "completed",
    }


def _generate_mock_extraction(scene: str, segments: list) -> tuple[dict, str, list[dict]]:
    """生成模拟萃取数据。"""
    if scene == "面试":
        content = {
            "name": "候选人",
            "role": "后端工程师 · 面试记录",
            "avatarBg": "#6B8FBF",
            "years": "5 年",
            "school": "计算机专业",
            "skills": ["Java", "Spring Boot", "MySQL", "Redis", "系统架构"],
            "salary": "25K - 35K · 14 薪",
            "onboard": "1 个月内",
            "competencies": [
                {"label": "技术能力", "stars": 4},
                {"label": "沟通表达", "stars": 4},
                {"label": "项目经验", "stars": 5},
                {"label": "文化匹配", "stars": 3},
            ],
        }
        summary = "候选人具备5年后端开发经验，技术能力扎实，有高并发系统改造的成功案例。沟通表达清晰，项目经验丰富。建议进入下一轮面试。"
        action_items = [
            {"title": "安排二面技术深度面试", "description": "聚焦分布式系统和数据库优化方向", "priority": "high", "due_date": date.today().isoformat()},
            {"title": "整理候选人评估报告", "description": "汇总本次面试的技术评估和胜任力分析", "priority": "medium", "due_date": date.today().isoformat()},
        ]
    elif scene == "会议":
        content = {
            "meeting_title": "周进度同步会",
            "date": date.today().isoformat(),
            "participants": ["主持人", "成员A", "成员B"],
            "key_decisions": [
                "本周重点：权限系统开发 + 数据分析接口联调",
                "后端需确认数据分析接口字段定义",
            ],
            "discussion_points": [
                "上周完成用户模块重构",
                "数据分析模块接口文档已更新",
            ],
        }
        summary = "会议明确了本周两大重点任务：权限系统开发和数据分析接口联调。需要后端尽快确认接口字段定义。"
        action_items = [
            {"title": "启动权限系统开发", "description": "基于用户模块重构后的接口，开发RBAC权限管理", "priority": "high", "due_date": date.today().isoformat()},
            {"title": "确认数据分析接口字段定义", "description": "后端与前端对齐数据分析模块的接口字段", "priority": "high", "due_date": date.today().isoformat()},
            {"title": "更新项目进度看板", "description": "将本周重点任务更新到项目甘特图", "priority": "medium", "due_date": date.today().isoformat()},
        ]
    else:
        content = {
            "topic": "员工培训体系优化方案",
            "key_insights": [
                "三级培训体系：新人入职→岗位技能→管理层领导力",
                "必修课+选修课模式，与晋升体系挂钩",
            ],
            "tags": ["培训体系", "组织发展", "人才管理"],
        }
        summary = "提出了一个三级员工培训体系的优化方案，覆盖新人入职、岗位技能提升和管理层领导力发展三个层级，建议将培训与晋升体系关联以提升员工参与度。"
        action_items = [
            {"title": "细化三级培训体系方案", "description": "完善新人入职/岗位技能/管理层领导力三个层级的课程设计", "priority": "medium", "due_date": date.today().isoformat()},
        ]

    return content, summary, action_items


def _generate_recording_title(scene: str, content: dict) -> str:
    """根据萃取内容生成录音标题。"""
    if scene == "面试" and content.get("name"):
        role = content.get("role", "").replace(" · 面试记录", "")
        return f"{role}面试 - {content['name']}"
    elif scene == "会议" and content.get("meeting_title"):
        return content["meeting_title"]
    elif content.get("topic"):
        return content["topic"]
    return f"{scene}录音"


def get_extraction(db: Session, user_id: str, recording_id: str) -> dict[str, Any]:
    """获取萃取结果。如果尚未萃取，触发萃取处理。"""
    recording = db.query(Recording).filter(
        Recording.id == recording_id,
        Recording.user_id == user_id,
        Recording.deleted_at.is_(None),
    ).first()
    if not recording:
        raise APIError(60002, "录音不存在", 404)

    # 如果尚未萃取，触发萃取
    if recording.extraction_status != "done":
        process_extraction(db, recording_id, user_id)
        db.refresh(recording)

    # 查询萃取结果
    extraction = (
        db.query(ExtractionResult)
        .filter(
            ExtractionResult.recording_id == recording_id,
            ExtractionResult.deleted_at.is_(None),
        )
        .first()
    )

    if not extraction:
        raise APIError(60002, "萃取结果不存在", 404)

    content = extraction.content_json or {}
    competencies = [
        {"label": c.get("label", ""), "stars": c.get("stars", 0)}
        for c in content.get("competencies", [])
    ]

    # 查询行动项
    action_items = (
        db.query(ActionItem)
        .filter(
            ActionItem.recording_id == recording_id,
            ActionItem.deleted_at.is_(None),
        )
        .all()
    )
    action_items_list = [
        {
            "id": ai.id,
            "title": ai.title,
            "description": ai.description or "",
            "priority": ai.priority or "medium",
            "synced_to_plan": ai.synced_to_plan,
        }
        for ai in action_items
    ]

    return {
        "recording_id": recording.id,
        "extraction_type": extraction.extraction_type or "",
        "name": content.get("name", ""),
        "role": content.get("role", ""),
        "avatar_bg": content.get("avatarBg", "#BCAAA4"),
        "years": content.get("years", ""),
        "school": content.get("school", ""),
        "skills": content.get("skills", []),
        "salary": content.get("salary", ""),
        "onboard": content.get("onboard", ""),
        "competencies": competencies,
        "summary": extraction.summary or "",
        "action_items": action_items_list,
    }


# ═══════════════════════════════════════════════
# 归档到知识库
# ═══════════════════════════════════════════════

def archive_to_knowledge_base(db: Session, user_id: str, recording_id: str,
                              hr_category: str | None = None) -> dict[str, Any]:
    """归档萃取结果到知识库。

    调用②知识库服务的 save_document，创建结构化文档。
    跨模块调用：直接写入 Document 表（同一数据库，避免HTTP调用的耦合）。
    """
    recording = db.query(Recording).filter(
        Recording.id == recording_id,
        Recording.user_id == user_id,
        Recording.deleted_at.is_(None),
    ).first()
    if not recording:
        raise APIError(60002, "录音不存在", 404)

    # 获取萃取结果
    extraction = (
        db.query(ExtractionResult)
        .filter(
            ExtractionResult.recording_id == recording_id,
            ExtractionResult.deleted_at.is_(None),
        )
        .first()
    )

    if not extraction:
        raise APIError(20001, "请先完成萃取后再归档", 400)

    # 如果已归档，直接返回
    if recording.archived_to_kb and recording.kb_doc_id:
        return {
            "success": True,
            "doc_id": recording.kb_doc_id,
            "recording_id": recording_id,
        }

    # 确定文档类型和HR分类
    scene = recording.scene or "日常"
    doc_type_map = {
        "面试": "interview_eval",
        "会议": "meeting_minutes",
        "日常": "extraction_report",
        "自定义": "user_note",
    }
    doc_type = doc_type_map.get(scene, "extraction_report")

    if not hr_category:
        hr_category_map = {
            "面试": "招聘配置",
            "会议": "人资规划",
            "日常": "培训开发",
            "自定义": "员工关系",
        }
        hr_category = hr_category_map.get(scene)

    # 写入Document表（调用知识库模型）
    from ...shared.models.knowledge import Document, AuditQueue

    doc = Document(
        owner_user_id=user_id,
        library_type="private",
        doc_type=doc_type,
        source_module="M4",  # 智能记录
        hr_category=hr_category,
        title=recording.title or f"{scene}萃取报告",
        content={
            "extraction_type": extraction.extraction_type,
            "content": extraction.content_json,
            "summary": extraction.summary,
            "scene": scene,
            "duration_seconds": recording.duration_seconds,
            "recording_id": recording_id,
        },
        file_object_id=recording.file_object_id,
        status="draft",
        audit_status="pending",
        is_desensitized=False,
        is_negative_blocked=False,
        vector_status="pending",
        version=1,
    )
    db.add(doc)
    db.flush()

    # 进入待审核区
    now = utcnow()
    db.add(AuditQueue(
        doc_id=doc.id,
        entered_at=now,
        expire_remind_at=now + timedelta(days=30),
    ))

    # 更新录音归档状态
    recording.archived_to_kb = True
    recording.kb_doc_id = doc.id
    db.commit()

    logger.info("萃取已归档到知识库: recording_id=%s doc_id=%s", recording_id, doc.id)

    return {
        "success": True,
        "doc_id": doc.id,
        "recording_id": recording_id,
    }


# ═══════════════════════════════════════════════
# 行动项同步到朝有规划
# ═══════════════════════════════════════════════

def sync_action_items_to_plan(db: Session, user_id: str, recording_id: str,
                              action_item_ids: list[str] | None = None,
                              plan_id: str | None = None) -> dict[str, Any]:
    """将行动项同步到朝有规划。

    跨模块调用：直接写入 PlanTask 表（基于步骤1设计的统一数据模型）。
    来源标记为 smart_record_sync，在朝有规划中可识别。
    """
    recording = db.query(Recording).filter(
        Recording.id == recording_id,
        Recording.user_id == user_id,
        Recording.deleted_at.is_(None),
    ).first()
    if not recording:
        raise APIError(60002, "录音不存在", 404)

    # 查询待同步行动项
    query = db.query(ActionItem).filter(
        ActionItem.recording_id == recording_id,
        ActionItem.deleted_at.is_(None),
    )
    if action_item_ids:
        query = query.filter(ActionItem.id.in_(action_item_ids))
    else:
        query = query.filter(ActionItem.synced_to_plan.is_(False))

    action_items = query.all()

    if not action_items:
        return {"synced_count": 0, "plan_task_ids": []}

    # 获取或创建今日计划
    from ...shared.models.plan import Plan, PlanTask
    from sqlalchemy import and_

    today = date.today()
    today_start = datetime(today.year, today.month, today.day, 0, 0, 0)
    today_end = datetime(today.year, today.month, today.day, 23, 59, 59)

    target_plan = None
    if plan_id:
        target_plan = db.query(Plan).filter(
            Plan.id == plan_id,
            Plan.user_id == user_id,
        ).first()

    if not target_plan:
        target_plan = db.query(Plan).filter(
            and_(
                Plan.user_id == user_id,
                Plan.created_at >= today_start,
                Plan.created_at <= today_end,
                Plan.status.in_(["draft", "active"]),
            )
        ).first()

    # 如果今日没有计划，创建一个
    if not target_plan:
        target_plan = Plan(
            user_id=user_id,
            title=f"今日计划（含智能记录行动项）",
            status="active",
            stats_json={"total_tasks": 0, "completed_tasks": 0, "completion_rate": 0, "pending_tasks": 0},
        )
        db.add(target_plan)
        db.flush()

    # 同步行动项为计划任务
    plan_task_ids = []
    synced = 0

    for ai in action_items:
        # 避免重复同步
        if ai.synced_to_plan and ai.plan_task_id:
            continue

        task = PlanTask(
            plan_id=target_plan.id,
            user_id=user_id,
            title=ai.title,
            description=ai.description,
            quadrant="not_urgent_important",  # 默认：重要不紧急
            source="smart_record_sync",
            status="pending",
            sort_order=999 + synced,
            time_estimate=ai.due_date,
        )
        db.add(task)
        db.flush()

        ai.synced_to_plan = True
        ai.plan_task_id = task.id
        plan_task_ids.append(task.id)
        synced += 1

    # 更新计划统计
    all_tasks = db.query(PlanTask).filter(
        and_(PlanTask.plan_id == target_plan.id, PlanTask.deleted_at.is_(None))
    ).all()
    total = len(all_tasks)
    completed = sum(1 for t in all_tasks if t.status == "completed")
    target_plan.stats_json = {
        "total_tasks": total,
        "completed_tasks": completed,
        "completion_rate": round(completed / total * 100) if total > 0 else 0,
        "pending_tasks": total - completed,
    }

    db.commit()

    logger.info("行动项已同步到朝有规划: recording_id=%s synced=%d plan_id=%s",
                recording_id, synced, target_plan.id)

    return {
        "synced_count": synced,
        "plan_task_ids": plan_task_ids,
    }


# ═══════════════════════════════════════════════
# 查询接口
# ═══════════════════════════════════════════════

def get_today_stats(db: Session, user_id: str) -> dict[str, Any]:
    """获取今日录音统计。"""
    today = date.today()
    today_start = datetime(today.year, today.month, today.day, 0, 0, 0)
    today_end = datetime(today.year, today.month, today.day, 23, 59, 59)

    recordings = db.query(Recording).filter(
        Recording.user_id == user_id,
        Recording.created_at >= today_start,
        Recording.created_at <= today_end,
        Recording.deleted_at.is_(None),
    ).all()

    count = len(recordings)
    total_seconds = sum(r.duration_seconds or 0 for r in recordings)
    completed = sum(1 for r in recordings if r.status == "completed")
    processing = count - completed

    return {
        "count": count,
        "total_minutes": total_seconds // 60,
        "completed_count": completed,
        "processing_count": processing,
    }


def get_recent_recordings(db: Session, user_id: str, limit: int = 5) -> list[dict[str, Any]]:
    """获取最近录音列表。"""
    recordings = (
        db.query(Recording)
        .filter(
            Recording.user_id == user_id,
            Recording.deleted_at.is_(None),
        )
        .order_by(desc(Recording.created_at))
        .limit(limit)
        .all()
    )
    return [_recording_to_list_dict(r) for r in recordings]


def get_recording_history(db: Session, user_id: str, search: str | None = None) -> list[dict[str, Any]]:
    """获取录音历史列表，支持搜索。"""
    query = db.query(Recording).filter(
        Recording.user_id == user_id,
        Recording.deleted_at.is_(None),
    )

    if search:
        query = query.filter(Recording.title.ilike(f"%{search}%"))

    recordings = query.order_by(desc(Recording.created_at)).limit(50).all()
    return [_recording_to_list_dict(r) for r in recordings]


def delete_recording(db: Session, user_id: str, recording_id: str) -> dict[str, Any]:
    """软删除录音及其关联数据。"""
    recording = db.query(Recording).filter(
        Recording.id == recording_id,
        Recording.user_id == user_id,
        Recording.deleted_at.is_(None),
    ).first()
    if not recording:
        raise APIError(60002, "录音不存在", 404)

    recording.deleted_at = utcnow()
    # 级联软删除关联数据
    db.query(TranscriptSegment).filter(
        TranscriptSegment.recording_id == recording_id,
    ).update({"deleted_at": utcnow()})
    db.query(ExtractionResult).filter(
        ExtractionResult.recording_id == recording_id,
    ).update({"deleted_at": utcnow()})
    db.query(ActionItem).filter(
        ActionItem.recording_id == recording_id,
    ).update({"deleted_at": utcnow()})
    db.commit()

    logger.info("录音已删除: recording_id=%s", recording_id)

    return {"deleted": True, "recording_id": recording_id}


# ═══════════════════════════════════════════════
# 面试提词器（跨模块联动：智能问答）
# ═══════════════════════════════════════════════

def get_teleprompter(db: Session, user_id: str, position: str | None = None,
                     stage: str | None = None) -> dict[str, Any]:
    """获取面试提词器问题列表。

    跨模块联动：调用③语音/AI引擎服务（llm_generate）生成面试提问建议。
    MVP阶段：返回结构化的问题模板库。
    """
    position = position or "HR岗位"

    # MVP: 返回结构化问题模板（生产环境调用AI引擎生成）
    questions = [
        {
            "question": f"请候选人简要自我介绍（1-2分钟），重点了解其与{position}相关的核心经验。",
            "purpose": "评估候选人的表达能力、职业脉络和岗位匹配度",
            "expected_answer_hint": "候选人应能清晰概括自己的职业轨迹、核心优势、与岗位的关联",
        },
        {
            "question": "请描述一个你在工作中遇到的最有挑战性的问题，以及你是如何解决的。",
            "purpose": "评估候选人的问题解决能力和韧性",
            "expected_answer_hint": "关注STAR结构（情境→任务→行动→结果），以及候选人的反思和成长",
        },
        {
            "question": "你为什么要离开当前/上一家公司？对下一份工作的期望是什么？",
            "purpose": "了解候选人的职业动机和价值取向",
            "expected_answer_hint": "建设性的离职原因+清晰的职业规划+对公司/岗位的了解",
        },
        {
            "question": f"你认为一个优秀的{position}需要具备哪些核心能力？你觉得自己在哪些方面最突出？",
            "purpose": "评估候选人的自我认知和对岗位的理解深度",
            "expected_answer_hint": "能力描述应具体而非空泛，有案例支撑",
        },
        {
            "question": "你有什么问题想问我？",
            "purpose": "评估候选人的主动性和思考深度",
            "expected_answer_hint": "有深度的问题说明候选人做了功课，对公司/岗位有真实兴趣",
        },
    ]

    tips = "面试中注意：①多用追问「能举个例子吗」来验证回答的真实性；②关注候选人的非语言信息（眼神、肢体）；③给候选人充分的提问时间，好的候选人通常问题也很多。"

    # 组装响应
    return {
        "scene": "面试",
        "position": position,
        "questions": questions,
        "tips": tips,
    }


# ═══════════════════════════════════════════════
# 自动触发处理流水线
# ═══════════════════════════════════════════════

def auto_process_recording(db: Session, recording_id: str, user_id: str) -> dict[str, Any]:
    """自动处理流水线：转写 → 萃取 → 完成。

    在停止录音后自动调用，模拟异步处理流程。
    MVP阶段同步执行；生产环境应使用Celery/任务队列异步处理。
    """
    # 1. 转写
    transcript_result = process_transcript(db, recording_id, user_id)

    # 2. 萃取
    extraction_result = process_extraction(db, recording_id, user_id)

    logger.info("自动处理流水线完成: recording_id=%s", recording_id)

    return {
        "recording_id": recording_id,
        "transcript": transcript_result,
        "extraction": extraction_result,
        "status": "completed",
    }
