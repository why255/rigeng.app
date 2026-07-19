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
import os
import re
import shutil
import subprocess
import tempfile
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from ...shared.config import settings
from ...shared.database import new_uuid, utcnow
from ...shared.errors import APIError, E_FILE_NOT_FOUND, E_PARAM_FORMAT
from ...shared.llm_utils import safe_extract_json, LLMParsingError
from ...shared.models.recording import (
    RECORDING_SCENES, RECORDING_STATUSES,
    ActionItem, ExtractionResult, Recording, TranscriptSegment,
)
from ...shared.models.knowledge import FileObject
from ..voice_engine.service import llm_generate, MODULE_SYSTEM_PROMPTS, asr_online, asr_qwen_omni
from ...engines.persona import build_persona_prompt
from ...engines.llm_orchestrator import llm_generate_with_orchestration
from ...engines.data_foundation import emit_event

logger = logging.getLogger("smart_record")

# ── 音频存储 ──
RECORDINGS_STORAGE = os.path.join(os.path.dirname(__file__), "..", "..", "..", "storage", "recordings")


def _chunk_dir(recording_id: str) -> str:
    p = os.path.join(RECORDINGS_STORAGE, recording_id, "chunks")
    os.makedirs(p, exist_ok=True)
    return p


def _audio_path(recording_id: str) -> str:
    d = os.path.join(RECORDINGS_STORAGE, recording_id)
    os.makedirs(d, exist_ok=True)
    return os.path.join(d, "audio.webm")

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


def stop_recording(db: Session, user_id: str, recording_id: str, duration_seconds: int = 0) -> dict[str, Any]:
    """停止录音：更新状态→transcribing，记录时长，触发异步转写。

    Args:
        duration_seconds: 客户端测量的真实录音时长（秒），优先于chunk估算值
    """
    recording = db.query(Recording).filter(
        Recording.id == recording_id,
        Recording.user_id == user_id,
        Recording.deleted_at.is_(None),
    ).first()

    if not recording:
        raise APIError(60002, "录音不存在", 404)

    if recording.status != "recording":
        raise APIError(20001, "该录音已停止或已处理", 400)

    # ── 使用客户端测量真实时长（优先于chunk估算值）──
    if duration_seconds > 0:
        recording.duration_seconds = duration_seconds

    # ── 合并音频chunk为完整文件 ──
    _finalize_recording_audio(db, recording_id, user_id)

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


def upload_recording(db: Session, user_id: str, scene: str,
                    audio_data: bytes, filename: str = "") -> dict[str, Any]:
    """上传完整录音文件（PC端使用）。

    与移动端实时录音不同，PC端直接上传完整音频文件。
    流程：创建录音记录 → 保存音频文件 → 触发转写+萃取流水线。
    """
    if scene not in RECORDING_SCENES:
        scene = "自定义"

    # 1. 创建录音记录
    recording = Recording(
        user_id=user_id,
        title=f"{scene}录音",
        scene=scene,
        status="transcribing",
        transcript_status="processing",
        duration_seconds=0,
    )
    db.add(recording)
    db.commit()
    db.refresh(recording)

    # 2. 保存音频文件
    apath = _audio_path(recording.id)
    with open(apath, "wb") as f:
        f.write(audio_data)

    file_size = len(audio_data)

    # 3. 尝试获取音频时长
    duration_seconds = 0
    try:
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", apath],
            capture_output=True, text=True, timeout=15,
        )
        if probe.returncode == 0 and probe.stdout.strip():
            duration_seconds = int(float(probe.stdout.strip()))
    except Exception as e:
        logger.warning("无法获取音频时长: recording_id=%s err=%s", recording.id, e)

    # 4. 创建 FileObject
    file_obj = FileObject(
        storage_url=apath,
        file_type="audio",
        size_bytes=file_size,
        compress_status="raw",
        storage_layer="cloud",
    )
    db.add(file_obj)
    db.flush()

    # 5. 更新录音记录
    recording.file_object_id = file_obj.id
    recording.file_size_bytes = file_size
    recording.duration_seconds = duration_seconds
    db.commit()
    db.refresh(recording)

    logger.info("录音文件上传完成: recording_id=%s scene=%s size=%d dur=%ds",
                recording.id, scene, file_size, duration_seconds)

    # 6. 自动触发处理流水线（转写 + 萃取）
    auto_process_recording(db, recording.id, user_id)

    return {
        "recording_id": recording.id,
        "scene": scene,
        "status": "completed",
        "duration_seconds": duration_seconds,
        "file_size_bytes": file_size,
    }


# ═══════════════════════════════════════════════
# 转写处理
# ═══════════════════════════════════════════════

def process_audio_chunk(db: Session, user_id: str, recording_id: str,
                        audio_data: bytes, chunk_index: int = 0) -> dict[str, Any]:
    """处理实时音频流分片：保存音频 + 调用腾讯云 ASR 实时转写。

    前端每5秒发送一个音频chunk（webm/opus格式），
    后端：1) 保存chunk到磁盘供后续音频回放；2) 转为WAV后调用ASR实时转写；
    3) 转写结果实时存入 TranscriptSegment。

    Returns:
        {"text": str, "confidence": float, "segment_index": int}
    """
    recording = db.query(Recording).filter(
        Recording.id == recording_id,
        Recording.user_id == user_id,
        Recording.deleted_at.is_(None),
    ).first()
    if not recording:
        raise APIError(60002, "录音不存在", 404)

    if not audio_data or len(audio_data) < 100:
        return {"text": "", "confidence": 0.0, "segment_index": chunk_index, "source": "empty_chunk"}

    # ── 1) 保存音频chunk到磁盘 ──
    try:
        cdir = _chunk_dir(recording_id)
        # 检测音频格式：WAV 文件以 "RIFF" 开头，webm 以特殊字节开头
        is_wav = audio_data[:4] == b'RIFF'
        ext = ".wav" if is_wav else ".webm"
        cpath = os.path.join(cdir, f"{chunk_index:04d}{ext}")
        with open(cpath, "wb") as f:
            f.write(audio_data)
    except Exception as e:
        logger.warning("保存音频chunk失败(chunk=%d): %s", chunk_index, e)

    # ── 2) 尝试调用 ASR 实时转写 ──
    try:
        text, confidence = _transcribe_audio_chunk(audio_data)
        if text:
            # 保存转写分段
            chunk_duration_sec = 5
            start_sec = chunk_index * chunk_duration_sec
            end_sec = start_sec + chunk_duration_sec

            ts = TranscriptSegment(
                recording_id=recording_id,
                user_id=user_id,
                segment_index=chunk_index,
                speaker="未知",
                speaker_role="speaker",
                start_time_seconds=float(start_sec),
                end_time_seconds=float(end_sec),
                text=text,
                confidence=confidence,
                is_candidate=False,
            )
            db.add(ts)
            db.commit()

            logger.info("实时ASR转写成功: recording_id=%s chunk=%d text=%s",
                        recording_id, chunk_index, text[:50])

            return {
                "text": text,
                "confidence": confidence,
                "segment_index": chunk_index,
                "source": "tencent_asr",
            }
    except Exception as e:
        logger.warning("腾讯云ASR实时转写失败(chunk=%d): %s，等待后续chunk", chunk_index, e)

    # ASR失败 → 返回空，不阻塞录音
    return {"text": "", "confidence": 0.0, "segment_index": chunk_index, "source": "asr_failed"}


# ── 填充词过滤器：防止 Qwen Omni 等 LLM ASR 引擎在静音/噪音上幻觉 ──
_FILLER_PATTERN = re.compile(
    r'^[\s,，。！？.!?…、；：;:""''（）()【】《》<>…—–-]*$'
)
_FILLER_CHARS = set('嗯啊哦呃唔诶咦噢呵哈嘿嗨呀哇哟嘞嘛呢吧吗啦哦哟呵嘿嗨')


def _is_filler_or_noise(text: str) -> bool:
    """检测 ASR 输出是否仅为填充词/噪音（非有效语音内容）。

    Qwen Omni 等多模态 LLM 用作 ASR 时，面对静音/呼吸/环境噪音会
    幻觉输出"嗯""啊""哦"等拟声词。此函数识别并过滤这些无效结果。

    Returns:
        True 如果文本只包含填充词/标点/空白，应被丢弃。
    """
    if not text or not text.strip():
        return True

    stripped = text.strip()
    # 纯标点/空白 → 无效
    if _FILLER_PATTERN.match(stripped):
        return True

    # 去掉标点和空白后，检查是否全为填充字符
    clean = re.sub(r'[\s,，。！？.!?…、；：;:""''（）()【】《》<>…—–-]', '', stripped)
    if not clean:
        return True

    # 如果所有非标点字符都在填充词集合中 → 幻觉
    if all(ch in _FILLER_CHARS for ch in clean):
        return True

    # 长度 ≤2 且全是填充词 → 也过滤（避免短幻觉）
    if len(clean) <= 2 and all(ch in _FILLER_CHARS for ch in clean):
        return True

    return False


def _transcribe_audio_chunk(audio_data: bytes) -> tuple[str, float]:
    """将音频chunk转为PCM后调用ASR实时转写。

    支持两种输入格式：
      - webm/opus: 需要 ffmpeg 转码为 WAV
      - WAV/PCM: 直接提取 PCM 数据（前端原生采集已输出 WAV）

    内置填充词过滤：Qwen Omni 等多模态 LLM 在静音/噪音上容易幻觉
    输出"嗯""啊"等拟声词，通过 _is_filler_or_noise() 过滤。

    Returns:
        (text, confidence) — 如果文本为填充词则返回 ("", 0.0)
    """
    import subprocess
    import tempfile
    import os

    audio_base64 = None

    # ── 检测是否已经是 WAV 格式 ──
    if audio_data[:4] == b'RIFF' and len(audio_data) > 44:
        # 已经是 WAV，直接提取 PCM 数据（跳过 44 字节 WAV 头）
        pcm_data = audio_data[44:]
        audio_base64 = base64.b64encode(pcm_data).decode("utf-8")
        audio_format = "wav"
    else:
        # webm/opus 格式，需要 ffmpeg 转码
        # 写入临时文件
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as f_in:
            f_in.write(audio_data)
            webm_path = f_in.name

        wav_path = webm_path + ".wav"
        try:
            # 用 ffmpeg 转 webm/opus → 16kHz 16bit mono WAV
            subprocess.run(
                ["ffmpeg", "-y", "-i", webm_path,
                 "-acodec", "pcm_s16le", "-ac", "1", "-ar", "16000",
                 "-loglevel", "error", wav_path],
                check=True, timeout=15,
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )
            # 读取 WAV 文件并跳过44字节头部
            with open(wav_path, "rb") as f:
                raw_audio = f.read()
            # 取PCM数据（跳过WAV头44字节）
            pcm_data = raw_audio[44:] if len(raw_audio) > 44 else raw_audio
            audio_base64 = base64.b64encode(pcm_data).decode("utf-8")
            audio_format = "wav"
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            # ffmpeg不可用 → 传递原始数据让ASR尽力处理
            logger.warning("ffmpeg不可用，chunk转写将使用原始音频格式(chunk=%s): %s",
                           webm_path[-20:], e)
            audio_base64 = base64.b64encode(audio_data).decode("utf-8")
            audio_format = "webm"
        finally:
            # 清理临时文件
            for path in [webm_path, wav_path]:
                try:
                    os.unlink(path)
                except OSError:
                    pass

    if not audio_base64:
        return "", 0.0

    # 智能记录专用：通义千问 Qwen3.5-Omni ASR（最快、支持Base64直传）
    from ..voice_engine.service import asr_qwen_omni
    try:
        result = asr_qwen_omni(audio_base64, audio_format=audio_format, sample_rate=16000)
    except Exception:
        from ..voice_engine.service import asr_online
        logger.info("Qwen Omni不可用，降级到腾讯云ASR")
        result = asr_online(audio_base64, audio_format=audio_format, sample_rate=16000)

    text = result.get("text", "").strip()
    confidence = result.get("confidence", 0.0)

    # ── 过滤 LLM ASR 幻觉填充词（静音/噪音 → "嗯""啊"等）──
    if _is_filler_or_noise(text):
        logger.info("ASR结果被填充词过滤器丢弃: chunk_text=%r", text[:80])
        return "", 0.0

    return text, confidence


def _finalize_recording_audio(db: Session, recording_id: str, user_id: str) -> None:
    """合并已保存的音频chunk为完整音频文件，创建FileObject记录。

    支持 webm 和 WAV 两种 chunk 格式：
      - webm: 直接拼接字节（webm 格式支持简单拼接）
      - WAV:  只保留第一个 chunk 的 WAV 头，后续 chunk 去除 44 字节头后拼接
    """
    import struct

    cdir = _chunk_dir(recording_id)
    if not os.path.isdir(cdir):
        logger.warning("无音频chunk目录: recording_id=%s", recording_id)
        return

    # 扫描所有音频 chunk（webm + wav）
    all_files = sorted([
        f for f in os.listdir(cdir)
        if f.endswith('.webm') or f.endswith('.wav')
    ])
    if not all_files:
        logger.warning("无音频chunk可合并: recording_id=%s", recording_id)
        return

    # 检测格式：如果有任何 .wav 文件则按 WAV 合并，否则按 webm 拼接
    has_wav = any(f.endswith('.wav') for f in all_files)

    apath = _audio_path(recording_id)
    total_size = 0
    try:
        with open(apath, "wb") as out:
            for i, cf in enumerate(all_files):
                cpath = os.path.join(cdir, cf)
                with open(cpath, "rb") as cin:
                    data = cin.read()

                if has_wav and cf.endswith('.wav'):
                    # WAV 合并：第一个 chunk 保留完整 WAV 头，
                    # 后续 chunk 去掉 44 字节头仅拼接 PCM 数据
                    if i == 0:
                        out.write(data)
                        total_size += len(data)
                    else:
                        pcm = data[44:] if len(data) > 44 else data
                        out.write(pcm)
                        total_size += len(pcm)
                else:
                    # webm 直接拼接
                    out.write(data)
                    total_size += len(data)

        # 如果是 WAV 合并，修正总长度字段（RIFF header offset 4）
        if has_wav and total_size > 44:
            with open(apath, "r+b") as f:
                f.seek(4)
                f.write(struct.pack('<I', total_size - 8))
                # 修正 data chunk 大小（offset 40）
                f.seek(40)
                f.write(struct.pack('<I', total_size - 44))
    except OSError as e:
        logger.error("音频合并失败: recording_id=%s err=%s", recording_id, e)
        return

    # 创建 FileObject
    file_obj = FileObject(
        storage_url=apath,
        file_type="audio",
        size_bytes=total_size,
        compress_status="raw",
        storage_layer="cloud",
    )
    db.add(file_obj)
    db.flush()

    # 关联到 Recording
    recording = db.query(Recording).filter(Recording.id == recording_id).first()
    if recording:
        recording.file_object_id = file_obj.id
        recording.file_size_bytes = total_size
    db.commit()

    logger.info("音频已合并: recording_id=%s size=%d chunks=%d", recording_id, total_size, len(chunk_files))

    # 清理chunk临时文件
    try:
        shutil.rmtree(cdir)
    except OSError:
        pass


def serve_recording_audio(db: Session, recording_id: str, user_id: str) -> dict[str, Any]:
    """获取录音音频文件的路径和信息，供 StreamingResponse 使用。"""
    recording = db.query(Recording).filter(
        Recording.id == recording_id,
        Recording.user_id == user_id,
        Recording.deleted_at.is_(None),
    ).first()
    if not recording:
        raise APIError(60002, "录音不存在", 404)

    # 优先通过 file_object_id 查找
    if recording.file_object_id:
        file_obj = db.query(FileObject).filter(
            FileObject.id == recording.file_object_id,
            FileObject.deleted_at.is_(None),
        ).first()
        if file_obj and file_obj.storage_url and os.path.isfile(file_obj.storage_url):
            return {
                "file_path": file_obj.storage_url,
                "content_type": "audio/webm",
                "file_size": file_obj.size_bytes or 0,
            }

    # 降级：直接查找合并后的音频文件
    apath = _audio_path(recording_id)
    if os.path.isfile(apath):
        return {
            "file_path": apath,
            "content_type": "audio/webm",
            "file_size": os.path.getsize(apath),
        }

    raise E_FILE_NOT_FOUND


def _batch_transcribe_audio(
    db: Session, recording_id: str, user_id: str, recording_duration_sec: int = 0
) -> int:
    """对合并后的完整音频文件进行批量ASR转写。

    返回创建的 TranscriptSegment 数量，失败时返回0。
    """
    apath = _audio_path(recording_id)
    if not os.path.isfile(apath):
        logger.warning("批量转写：音频文件不存在 recording_id=%s", recording_id)
        return 0

    with open(apath, "rb") as f:
        audio_data = f.read()
    if len(audio_data) < 500:
        return 0

    # 尝试转写
    text = ""
    confidence = 0.0
    try:
        text, confidence = _transcribe_audio_chunk(audio_data)
    except Exception as e:
        logger.warning("批量转写ASR失败: recording_id=%s err=%s", recording_id, e)
        return 0

    if not text.strip():
        logger.info("批量转写：ASR返回空文本 recording_id=%s", recording_id)
        return 0

    # 按中文标点拆分为句子
    sentences = re.split(r'(?<=[。！？.!?\n])\s*', text)
    sentences = [s.strip() for s in sentences if s.strip()]
    if not sentences:
        sentences = [text.strip()]

    total_dur = recording_duration_sec or max(len(sentences) * 5, 10)
    for i, sent in enumerate(sentences):
        start_sec = round(i * total_dur / len(sentences), 1)
        end_sec = round((i + 1) * total_dur / len(sentences), 1)
        ts = TranscriptSegment(
            recording_id=recording_id,
            user_id=user_id,
            segment_index=i,
            speaker="未知",
            speaker_role="speaker",
            start_time_seconds=start_sec,
            end_time_seconds=end_sec,
            text=sent,
            confidence=confidence,
            is_candidate=False,
        )
        db.add(ts)
    db.commit()

    logger.info("批量转写完成: recording_id=%s sentences=%d confidence=%.2f",
                recording_id, len(sentences), confidence)
    return len(sentences)


def process_transcript(db: Session, recording_id: str, user_id: str) -> dict[str, Any]:
    """处理转写：优先使用实时ASR分段，无则尝试批量ASR转写完整音频。"""
    recording = db.query(Recording).filter(
        Recording.id == recording_id,
        Recording.user_id == user_id,
        Recording.deleted_at.is_(None),
    ).first()
    if not recording:
        raise APIError(60002, "录音不存在", 404)

    # 1) 检查是否已有实时转写分段
    existing_segments = (
        db.query(TranscriptSegment)
        .filter(
            TranscriptSegment.recording_id == recording_id,
            TranscriptSegment.deleted_at.is_(None),
        )
        .all()
    )

    if existing_segments:
        recording.transcript_status = "done"
        recording.status = "extracting"
        recording.extraction_status = "processing"
        db.commit()
        logger.info("转写完成（实时ASR）: recording_id=%s segments=%d",
                    recording_id, len(existing_segments))
        return {
            "recording_id": recording_id,
            "segments_count": len(existing_segments),
            "status": "extracting",
            "source": "realtime_asr",
        }

    # 2) 尝试批量转写完整音频
    seg_count = _batch_transcribe_audio(
        db, recording_id, user_id,
        recording_duration_sec=recording.duration_seconds or 0,
    )

    if seg_count > 0:
        recording.transcript_status = "done"
        recording.status = "extracting"
        recording.extraction_status = "processing"
        db.commit()
        logger.info("转写完成（批量ASR）: recording_id=%s segments=%d",
                    recording_id, seg_count)
        return {
            "recording_id": recording_id,
            "segments_count": seg_count,
            "status": "extracting",
            "source": "batch_asr",
        }

    # 3) 无法转写 — 标记失败但继续流程
    logger.warning("无法转写: recording_id=%s scene=%s dur=%ds",
                   recording_id, recording.scene, recording.duration_seconds or 0)
    recording.transcript_status = "failed"
    recording.status = "extracting"
    recording.extraction_status = "processing"
    db.commit()

    return {
        "recording_id": recording_id,
        "segments_count": 0,
        "status": "extracting",
        "source": "failed",
    }


def get_transcript(db: Session, user_id: str, recording_id: str) -> dict[str, Any]:
    """获取转写结果。如果尚未转写且录音已停止，触发转写处理。"""
    recording = db.query(Recording).filter(
        Recording.id == recording_id,
        Recording.user_id == user_id,
        Recording.deleted_at.is_(None),
    ).first()
    if not recording:
        raise APIError(60002, "录音不存在", 404)

    # 如果尚未转写且录音已停止，触发转写（失败的不重试，避免循环）
    if recording.transcript_status not in ("done", "failed") and recording.status != "recording":
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


# ═══════════════════════════════════════════════
# AI萃取
# ═══════════════════════════════════════════════

def process_extraction(db: Session, recording_id: str, user_id: str) -> dict[str, Any]:
    """执行AI萃取：从转写文本中结构化提取关键信息。

    优先调用AI引擎（voice_engine.llm_generate），失败时降级到模板生成。
    无转写文本时跳过（不生成假数据）。
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

    # ── 无转写文本时：不生成萃取，标记待处理 ──
    if not segments:
        logger.warning("无转写文本，跳过萃取: recording_id=%s", recording_id)
        recording.extraction_status = "pending"
        recording.status = "completed"
        db.commit()
        return {
            "recording_id": recording_id,
            "extraction_type": "",
            "status": "completed",
            "source": "no_transcript",
        }

    # 生成萃取内容（AI引擎）
    scene = recording.scene or "日常"
    try:
        content_json, summary, action_items_data, model_used, tokens = _generate_ai_extraction(
            scene, segments, user_id=user_id, db=db,
        )
    except Exception as e:
        logger.error("AI萃取失败: recording_id=%s error=%s", recording_id, e)
        raise APIError(60010, f"AI萃取失败: {e}", 500)

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
        model_used=model_used,
        extraction_cost_tokens=tokens,
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

    logger.info("萃取完成: recording_id=%s type=%s model=%s", recording_id, extraction.extraction_type, model_used)

    return {
        "recording_id": recording_id,
        "extraction_type": extraction.extraction_type,
        "status": "completed",
    }


def _generate_ai_extraction(
    scene: str, segments: list, user_id: str | None = None, db: Session | None = None,
) -> tuple[dict, str, list[dict], str, int]:
    """调用AI引擎从转录文本中提取结构化信息。

    Returns:
        (content_json, summary, action_items, model_used, tokens)
    """
    # 构建转录文本
    transcript_text = _build_transcript_text(segments)

    # 根据场景构建不同的prompt
    if scene == "面试":
        output_schema = (
            '{\n'
            '  "content": {\n'
            '    "name": "候选人姓名",\n'
            '    "role": "应聘岗位",\n'
            '    "avatarBg": "#6B8FBF",\n'
            '    "years": "工作经验年限(如5年)",\n'
            '    "school": "教育背景",\n'
            '    "skills": ["技能1", "技能2"],\n'
            '    "salary": "期望薪资范围",\n'
            '    "onboard": "到岗时间",\n'
            '    "competencies": [\n'
            '      {"label": "技术能力", "stars": 4},\n'
            '      {"label": "沟通表达", "stars": 3}\n'
            '    ]\n'
            '  },\n'
            '  "summary": "200字以内的面试综合评估摘要",\n'
            '  "action_items": [\n'
            '    {"title": "行动项标题", "description": "详细描述", "priority": "high|medium|low", "due_date": "YYYY-MM-DD"}\n'
            '  ]\n'
            '}'
        )
        prompt = (
            f'场景：面试录音\n'
            f'以下是一段面试录音的文字转录：\n{transcript_text}\n\n'
            f'请从面试对话中提取候选人的结构化信息。如果某些信息在对话中未提及，请留空或根据上下文合理推断。'
        )
    elif scene == "会议":
        output_schema = (
            '{\n'
            '  "content": {\n'
            '    "meeting_title": "会议标题",\n'
            '    "date": "YYYY-MM-DD",\n'
            '    "participants": ["参与者1", "参与者2"],\n'
            '    "key_decisions": ["关键决策1", "关键决策2"],\n'
            '    "discussion_points": ["讨论要点1", "讨论要点2"]\n'
            '  },\n'
            '  "summary": "200字以内的会议摘要",\n'
            '  "action_items": [\n'
            '    {"title": "行动项标题", "description": "详细描述", "priority": "high|medium|low", "due_date": "YYYY-MM-DD"}\n'
            '  ]\n'
            '}'
        )
        prompt = (
            f'场景：会议录音\n'
            f'以下是一段会议录音的文字转录：\n{transcript_text}\n\n'
            f'请提取会议的关键信息，包括会议标题、参与者、关键决策和讨论要点。'
        )
    else:
        output_schema = (
            '{\n'
            '  "content": {\n'
            '    "topic": "主题",\n'
            '    "key_insights": ["核心洞察1", "核心洞察2"],\n'
            '    "tags": ["标签1", "标签2"]\n'
            '  },\n'
            '  "summary": "200字以内的内容摘要",\n'
            '  "action_items": [\n'
            '    {"title": "行动项标题", "description": "详细描述", "priority": "high|medium|low", "due_date": "YYYY-MM-DD"}\n'
            '  ]\n'
            '}'
        )
        prompt = (
            f'场景：日常/自定义录音\n'
            f'以下是一段录音的文字转录：\n{transcript_text}\n\n'
            f'请提取录音中的主题、关键洞察和相关标签。'
        )

    result = llm_generate(
        prompt=prompt,
        system_prompt=MODULE_SYSTEM_PROMPTS.get("smart_record", ""),
        user_id=user_id,
        db=db,
        temperature=0.5,
        module="smart_record",
    )
    parsed = safe_extract_json(result["content"])
    if not parsed or not isinstance(parsed, dict):
        raise LLMParsingError("AI萃取返回无效JSON")

    content = parsed.get("content", {})
    summary = parsed.get("summary", "")
    action_items = parsed.get("action_items", [])

    return content, summary, action_items, result["model_used"], result["usage"]["total_tokens"]


def _build_transcript_text(segments: list) -> str:
    """将转录片段列表构建为可传入LLM的文本。"""
    if not segments:
        return "（暂无转录文本）"
    lines = []
    for seg in segments[:50]:  # 限制50段，避免超出上下文
        speaker = getattr(seg, "speaker", "") or ""
        text = getattr(seg, "text", "") or ""
        if speaker:
            lines.append(f"[{speaker}]: {text}")
        else:
            lines.append(text)
    return "\n".join(lines)


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
    if recording.extraction_status not in ("done", "pending"):
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
        # 无转写文本导致萃取被跳过 — 返回空结果
        return {
            "recording_id": recording.id,
            "extraction_type": "",
            "name": "",
            "role": "",
            "avatar_bg": "#BCAAA4",
            "years": "",
            "school": "",
            "skills": [],
            "salary": "",
            "onboard": "",
            "competencies": [],
            "summary": "",
            "action_items": [],
        }

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

    优先调用AI引擎生成面试提问建议，失败时降级到模板问题库。
    """
    position = position or "HR岗位"

    # 尝试AI生成
    try:
        ai_result = _generate_ai_teleprompter(position, user_id=user_id, db=db)
        if ai_result:
            return ai_result
    except Exception as e:
        logger.warning("AI提词器生成失败，降级到模板: %s", e)

    # 降级：返回结构化问题模板
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

    return {
        "scene": "面试",
        "position": position,
        "questions": questions,
        "tips": tips,
    }


def _generate_ai_teleprompter(
    position: str, user_id: str | None = None, db: Session | None = None,
) -> dict | None:
    """调用AI引擎生成面试提问建议。"""
    output_schema = (
        '{\n'
        '  "questions": [\n'
        '    {"question": "提问内容", "purpose": "评估目的", "expected_answer_hint": "理想回答要点"},\n'
        '    ...\n'
        '  ],\n'
        '  "tips": "面试官技巧提示(1-2句话)"\n'
        '}'
    )
    prompt = (
        f'你是一位资深面试官。请为以下岗位生成5个面试提问建议：\n'
        f'- 岗位：{position}\n\n'
        f'每个问题应包含：\n'
        f'- question: 具体的提问内容\n'
        f'- purpose: 评估目的\n'
        f'- expected_answer_hint: 理想回答应包含的要点\n\n'
        f'问题应覆盖：自我介绍与职业脉络、问题解决能力、职业动机、自我认知、主动性等方面。'
    )

    result = llm_generate(
        prompt=prompt,
        system_prompt=MODULE_SYSTEM_PROMPTS.get("smart_record", ""),
        user_id=user_id,
        db=db,
        temperature=0.7,
        module="smart_record",
    )
    parsed = safe_extract_json(result["content"])
    if not parsed or not isinstance(parsed, dict):
        return None

    questions = parsed.get("questions", [])
    if len(questions) < 3:
        return None

    return {
        "scene": "面试",
        "position": position,
        "questions": questions[:8],  # 最多8个问题
        "tips": parsed.get("tips", ""),
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


# ═══════════════════════════════════════════════
# 面试场景专用算法（日耕模块算法设计文档_V2.0）
# ═══════════════════════════════════════════════

def extract_interview(transcript: str, job_position: str = "", user_id=None, db=None) -> dict:
    """面试场景专用算法：从面试对话中提取结构化信息。

    提取维度：
      - 面试结构识别（面试阶段划分）
      - 候选人画像（姓名、经验年限、当前公司/职位）
      - 能力维度评分（专业能力、沟通表达、团队协作、稳定性，1-5分+证据）
      - STAR事件萃取（四要素完整性评分20/40/70/100）
      - 匹配分析（综合评分、推荐等级、权重分解）

    设计原则：
      - 能力评分必须引用对话中的具体内容作为依据
      - 缺乏信息的维度标注"信息不足"，不猜测打分
      - 品牌语："所言成资产，回顾有痕迹"
    """
    position_hint = f"\n应聘岗位: {job_position}" if job_position else ""

    prompt = (
        f"从以下面试对话中提取结构化信息。返回JSON:\n"
        f"{{\n"
        f'  "interview_stages": [{{"stage_name": "阶段名称", "start_marker": "开始标志"}}],\n'
        f'  "candidate_profile": {{"name": "姓名", "experience_years": "经验年限", "current_company": "当前公司", "current_position": "当前职位"}},\n'
        f'  "capability_scores": [\n'
        f'    {{"dimension": "专业能力|沟通表达|团队协作|稳定性", "score": 1-5, "evidence": "对话中的具体内容", "note": "信息不足则标注"}}\n'
        f'  ],\n'
        f'  "star_events": [\n'
        f'    {{"situation": "情境", "task": "任务", "action": "行动", "result": "结果", "completeness": 20|40|70|100}}\n'
        f'  ],\n'
        f'  "match_analysis": {{\n'
        f'    "overall_score": 0-100,\n'
        f'    "recommendation": "强烈推荐|推荐|保留|不推荐",\n'
        f'    "breakdown": {{"专业能力权重": 0.35, "沟通表达": 0.20, "团队协作": 0.15, "稳定性": 0.15, "薪资期望": 0.15}}\n'
        f'  }}\n'
        f"}}\n\n"
        f"要求：\n"
        f"- 能力维度评分必须引用对话中的具体内容作为依据\n"
        f"- 如果对话中缺乏某维度信息，标注'信息不足'而非猜测打分\n"
        f"- STAR完整性: 四要素齐全=100%, 缺R=70%, 缺A+R=40%, 只有S或T=20%\n\n"
        f"面试对话内容：\n{transcript}{position_hint}"
    )

    system_prompt = build_persona_prompt(module="smart_record")

    try:
        result = llm_generate_with_orchestration(
            prompt=prompt,
            system_prompt=system_prompt,
            module="smart_record",
            task_complexity="complex",
            temperature=0.2,
            user_id=user_id,
            db=db,
        )
        parsed = safe_extract_json(result["content"])
        if not parsed or not isinstance(parsed, dict):
            raise LLMParsingError("面试萃取返回无效JSON")

        # 发射事件到数据底座
        if user_id:
            try:
                emit_event(
                    user_id=user_id,
                    module="smart_record",
                    event_type="record.extracted_interview",
                    properties={
                        "job_position": job_position,
                        "transcript_length": len(transcript),
                        "model_used": result.get("model_used", "unknown"),
                    },
                    db=db,
                )
            except Exception as emit_err:
                logger.warning("事件发射失败（非致命）: %s", emit_err)

        return {
            "success": True,
            "data": parsed,
            "model_used": result.get("model_used", "unknown"),
            "usage": result.get("usage", {}),
        }
    except Exception as e:
        logger.error("面试萃取失败: %s", e)
        return {
            "success": False,
            "error": str(e),
            "data": None,
        }


# ═══════════════════════════════════════════════
# 会议行动项提取（日耕模块算法设计文档_V2.0）
# ═══════════════════════════════════════════════

def extract_action_items(meeting_transcript: str, meeting_date: str = "",
                         meeting_title: str = "", user_id=None, db=None) -> dict:
    """从会议记录中提取所有行动项（待办事项）。

    提取规则：
      - 只提取明确分配了责任人的事项
      - '可以考虑''也许可以''要不要'等不确定语气不提取
      - 已有明确DDL则提取，只有'尽快''有空的时候'则提取但标注deadline_str='待定'
      - 按优先级排序返回

    每个行动项包含：
      - action: 具体要做什么（动词开头）
      - owner: 负责人
      - deadline: 截止时间
      - priority: high / medium / low
      - source: 会议记录的哪一部分提出了这个行动项
    """
    date_hint = f"\n会议日期: {meeting_date}" if meeting_date else ""
    title_hint = f"\n会议标题: {meeting_title}" if meeting_title else ""

    prompt = (
        f"从会议记录中提取所有行动项(待办事项)。每个行动项必须包含:\n"
        f"- action: 具体要做什么(动词开头)\n"
        f"- owner: 负责人\n"
        f"- deadline: 截止时间\n"
        f"- priority: high/medium/low\n"
        f"- source: 会议记录的哪一部分提出了这个行动项\n\n"
        f"提取规则:\n"
        f"- 只提取明确分配了责任人的事项\n"
        f"- '可以考虑''也许可以''要不要'等不确定语气→不提取\n"
        f"- 已有明确DDL→提取，只有'尽快''有空的时候'→提取但标注deadline_str='待定'\n\n"
        f"返回JSON数组，按优先级排序\n\n"
        f"会议记录内容：\n{meeting_transcript}{date_hint}{title_hint}"
    )

    system_prompt = build_persona_prompt(module="smart_record")

    try:
        result = llm_generate_with_orchestration(
            prompt=prompt,
            system_prompt=system_prompt,
            module="smart_record",
            task_complexity="medium",
            temperature=0.2,
            user_id=user_id,
            db=db,
        )
        parsed = safe_extract_json(result["content"])
        if not parsed:
            raise LLMParsingError("会议行动项提取返回无效JSON")

        # 确保返回的是列表
        if isinstance(parsed, dict):
            # 兼容LLM返回包裹在对象中的情况
            action_items_list = parsed.get("action_items", [])
            if not action_items_list and isinstance(parsed, dict):
                # 可能是直接返回了数组但被解析为dict
                action_items_list = [parsed] if any(k in parsed for k in ("action", "owner")) else []
        elif isinstance(parsed, list):
            action_items_list = parsed
        else:
            action_items_list = []

        # 发射事件到数据底座
        if user_id:
            try:
                emit_event(
                    user_id=user_id,
                    module="smart_record",
                    event_type="record.extracted_action_items",
                    properties={
                        "meeting_title": meeting_title,
                        "meeting_date": meeting_date,
                        "transcript_length": len(meeting_transcript),
                        "items_count": len(action_items_list),
                        "model_used": result.get("model_used", "unknown"),
                    },
                    db=db,
                )
            except Exception as emit_err:
                logger.warning("事件发射失败（非致命）: %s", emit_err)

        return {
            "success": True,
            "action_items": action_items_list,
            "total_count": len(action_items_list),
            "model_used": result.get("model_used", "unknown"),
            "usage": result.get("usage", {}),
        }
    except Exception as e:
        logger.error("会议行动项提取失败: %s", e)
        return {
            "success": False,
            "error": str(e),
            "action_items": [],
            "total_count": 0,
        }


# ═══════════════════════════════════════════════
# 录音可靠性保障管理器（日耕模块算法设计文档_V2.0）
# ═══════════════════════════════════════════════

class RecordingReliabilityManager:
    """录音可靠性保障管理器。

    处理录音过程中的异常场景，保障录音数据不丢失。
    纯配置/状态管理，不需要LLM调用。

    场景覆盖：
      - 屏幕关闭：切换到后台录音模式，优化语音采集
      - 来电中断：保存检查点，暂停录音
      - 通话结束：恢复录音或重新开始
    """

    @staticmethod
    def handle_screen_off() -> dict:
        """处理屏幕关闭事件。

        录音切换到后台模式，保持语音采集但降低功耗。
        品牌语："所言成资产，回顾有痕迹"——即使后台录音也不丢失。
        """
        return {
            "status": "recording_in_background",
            "quality": "speech_optimized",
        }

    @staticmethod
    def handle_incoming_call() -> dict:
        """处理来电中断事件。

        保存检查点数据，暂停录音，确保已录制内容不丢失。
        """
        return {
            "action": "pause_and_checkpoint",
            "checkpoint": {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "mode": "interrupted_by_call",
                "auto_resume": False,
            },
        }

    @staticmethod
    def handle_call_ended() -> dict:
        """处理通话结束事件。

        默认恢复录音模式，前端可根据用户选择改为重新开始。
        """
        return {"mode": "resume"}
