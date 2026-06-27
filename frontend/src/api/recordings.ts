/**
 * 智能记录 (M4) API 封装
 * 对应后端录音相关接口
 */
import { apiGet, apiPost, apiDelete } from './api'
import type { Recording, TranscriptSegment, ExtractionResult } from '@/data/mock'

/** GET /api/recordings/today — 今日录音统计 */
export async function getTodayStats() {
  return apiGet<{ count: number; totalMinutes: number }>('/recordings/today')
}

/** GET /api/recordings/recent — 最近录音列表 */
export async function getRecentRecordings() {
  return apiGet<Recording[]>('/recordings/recent')
}

/** POST /api/recordings/start — 开始录音 */
export async function startRecording(body: { scene: string }) {
  return apiPost<{ recording_id: string; scene: string; status: string }>('/recordings/start', body)
}

/** POST /api/recordings/stop — 停止录音 */
export async function stopRecording(recordingId: string) {
  return apiPost<{ recording_id: string; status: string; duration_seconds: number }>('/recordings/stop', { recording_id: recordingId })
}

/** GET /api/recordings/:id/transcript — 获取转写文本 */
export async function getTranscript(recordingId: string) {
  return apiGet<{ segments: TranscriptSegment[]; audioUrl: string }>(`/recordings/${recordingId}/transcript`)
}

/** GET /api/recordings/:id/extraction — 获取萃取结果 */
export async function getExtraction(recordingId: string) {
  return apiGet<ExtractionResult>(`/recordings/${recordingId}/extraction`)
}

/** GET /api/recordings — 获取历史列表 */
export async function getRecordingHistory(params?: { search?: string }) {
  return apiGet<Recording[]>('/recordings', params as Record<string, string>)
}

/** DELETE /api/recordings/:id — 删除录音 */
export async function deleteRecording(recordingId: string) {
  return apiDelete<{ deleted: boolean }>(`/recordings/${recordingId}`)
}

/** POST /api/recordings/:id/archive — 归档到知识库 */
export async function archiveRecording(recordingId: string, hrCategory?: string) {
  return apiPost<{ success: boolean; doc_id: string }>(`/recordings/${recordingId}/archive`, { hr_category: hrCategory })
}

/** POST /api/recordings/:id/sync-actions — 行动项同步到朝有规划 */
export async function syncActionItems(recordingId: string, actionItemIds?: string[], planId?: string) {
  return apiPost<{ synced_count: number; plan_task_ids: string[] }>(
    `/recordings/${recordingId}/sync-actions`,
    { action_item_ids: actionItemIds, plan_id: planId },
  )
}

/** GET /api/recordings/teleprompter/questions — 面试提词器 */
export async function getTeleprompter(position?: string, stage?: string) {
  return apiGet<{
    scene: string
    position: string
    questions: { question: string; purpose: string; expected_answer_hint: string }[]
    tips: string
  }>('/recordings/teleprompter/questions', { position, stage } as Record<string, string>)
}
