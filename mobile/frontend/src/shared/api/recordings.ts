/**
 * 智能记录（M4）API 封装。
 *
 * 对应后端路由：
 *   GET    /api/recordings/today        今日录音统计
 *   GET    /api/recordings/recent       最近录音列表
 *   GET    /api/recordings              历史录音列表（分页）
 *   GET    /api/recordings/search        搜索录音
 *   POST   /api/recordings/start        开始录音
 *   POST   /api/recordings/chunk         上传音频流（实时）
 *   POST   /api/recordings/stop         停止录音
 *   GET    /api/recordings/:id/transcript  获取转写文本
 *   GET    /api/recordings/:id/audio       获取音频流
 *   GET    /api/recordings/:id/extraction  获取萃取结果
 *   POST   /api/recordings/:id/archive     归档到知识库
 */

import { apiGet, apiPost, resolveBaseUrl } from './api'

/* ---------- 类型定义 ---------- */

export type SceneType = '面试' | '会议' | '日常' | '自定义'
export type RecordingStatus = 'recording' | 'completed' | 'transcribing' | 'extracting' | 'extracted' | 'failed'

export interface Recording {
  id: string
  title: string
  scene: SceneType
  sceneColor: string
  date: string
  duration: string
  durationSec: number
  status: RecordingStatus
  progress?: number
}

export interface TodayStats {
  count: number
  total_minutes?: number  // 后端 snake_case
  totalMinutes?: number   // 前端 camelCase
  completed_count?: number
  processing_count?: number
}

export interface RecordingListResponse {
  items: Recording[]
  total: number
  page: number
  limit: number
}

export interface TranscriptSegment {
  speaker: string
  time: string
  text: string
  confidence: number
  is_candidate?: boolean   // 后端 snake_case
  isCandidate?: boolean    // 前端 camelCase（兼容）
}

export interface TranscriptResponse {
  // 兼容后端 snake_case 和前端 camelCase
  recording_id?: string
  recordingId?: string
  segments: TranscriptSegment[]
  duration_seconds?: number
  totalDuration?: string
  title?: string
  scene?: string
  audio_url?: string
}

export interface Competency {
  label: string
  stars: number
}

export interface ExtractionResult {
  id: string
  recording_id?: string
  recordingId?: string
  name: string
  role: string
  avatar_bg?: string
  avatarBg?: string
  years: string
  school: string
  skills: string[]
  salary: string
  onboard: string
  competencies: Competency[]
  scene?: SceneType
}

export interface StartRecordingResponse {
  recording_id?: string    // 后端 snake_case
  recordingId?: string     // 前端 camelCase（兼容）
  scene?: string
  status?: string
  uploadUrl?: string
}

/* ---------- 首页 API ---------- */

/** 获取今日录音统计 */
export function fetchTodayStats(): Promise<TodayStats> {
  return apiGet<TodayStats>('/recordings/today')
}

/** 获取最近录音列表 */
export function fetchRecentRecordings(): Promise<Recording[]> {
  return apiGet<Recording[]>('/recordings/recent')
}

/* ---------- 录音 API ---------- */

/** 开始录音 */
export function startRecording(scene: SceneType): Promise<StartRecordingResponse> {
  return apiPost<StartRecordingResponse>('/recordings/start', { scene })
}

/** 上传音频流分片（实时） */
export function uploadAudioChunk(recordingId: string, chunk: Blob, chunkIndex: number = 0): Promise<{ text: string; confidence: number; segment_index: number }> {
  const formData = new FormData()
  formData.append('chunk', chunk)
  formData.append('recording_id', recordingId)  // 后端期望 snake_case 字段名
  formData.append('chunk_index', String(chunkIndex))
  const token = localStorage.getItem('rg_token') ?? ''
  return fetch(`${resolveBaseUrl()}/recordings/chunk`, {
    method: 'POST',
    body: formData,
    headers: { Authorization: `Bearer ${token}` },
  }).then(async (res) => {
    if (!res.ok) {
      const errBody = await res.text()
      throw new Error(`上传失败 (${res.status}): ${errBody}`)
    }
    const json = await res.json()
    return json.data as { text: string; confidence: number; segment_index: number }
  })
}

/** 获取腾讯云实时语音识别 WebSocket 授权 */
export interface AsrAuthResponse {
  ws_url: string
  voice_id: string
  appid: string
  engine_model_type: string
  expired: number
}

export function fetchAsrAuth(recordingId: string): Promise<AsrAuthResponse> {
  return apiPost<AsrAuthResponse>(`/recordings/${recordingId}/asr-auth`)
}

/** 停止录音 */
export function stopRecording(recordingId: string, durationSeconds?: number): Promise<{ recording_id?: string; recordingId?: string; status?: string }> {
  return apiPost('/recordings/stop', { recording_id: recordingId, duration_seconds: durationSeconds ?? 0 })
}

/* ---------- 转写 API ---------- */

/** 获取转写文本（分段、说话人标签、置信度） */
export function fetchTranscript(recordingId: string): Promise<TranscriptResponse> {
  return apiGet<TranscriptResponse>(`/recordings/${recordingId}/transcript`)
}

/** 获取音频流 URL */
export function getAudioUrl(recordingId: string): string {
  const token = localStorage.getItem('rg_token') ?? ''
  return `${resolveBaseUrl()}/recordings/${recordingId}/audio?token=${encodeURIComponent(token)}`
}

/* ---------- 萃取 API ---------- */

/** 获取结构化萃取结果 */
export function fetchExtraction(recordingId: string): Promise<ExtractionResult> {
  return apiGet<ExtractionResult>(`/recordings/${recordingId}/extraction`)
}

/** 触发生成萃取（长耗时操作，轮询 extraction 接口直到完成） */
export function generateExtraction(recordingId: string): Promise<{ taskId: string }> {
  return apiPost<{ taskId: string }>(`/recordings/${recordingId}/extraction/generate`)
}

/* ---------- 归档 API ---------- */

/** 归档到知识库 */
export function archiveRecording(recordingId: string): Promise<{ knowledgeId: string }> {
  return apiPost<{ knowledgeId: string }>(`/recordings/${recordingId}/archive`)
}

/* ---------- 历史列表 API ---------- */

/** 获取录音历史列表（分页） */
export function fetchHistory(page: number = 1, limit: number = 20): Promise<RecordingListResponse> {
  return apiGet<RecordingListResponse>('/recordings', {
    page: String(page),
    limit: String(limit),
  })
}

/** 搜索录音 */
export function searchRecordings(query: string): Promise<Recording[]> {
  return apiGet<Recording[]>('/recordings/search', { q: query })
}
