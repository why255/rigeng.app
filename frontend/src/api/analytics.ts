/**
 * 数据分析 · Full Analytics API 函数。
 * 对接后端 /api/v1/analytics/* 路由（dashboard/full, drilldown, emotion, care, teacher-bridge, mobile）。
 */
import { apiGet, apiPost, apiPut } from './api'

// ── Types ──

export interface FullDashboard {
  modules: {
    key: string
    name: string
    metrics: {
      name: string
      value: number
      unit: string
      trend: string
      color: string
    }[]
  }[]
}

export interface DrilldownResult {
  metric_key: string
  level: number
  label: string
  children: any[]
}

export interface EmotionIndex {
  score: number
  trend: string
  date: string
}

export interface EmotionCurve {
  period: string
  data_points: { date: string; score: number }[]
}

export interface PushQuota {
  used: number
  limit: number
  remaining: number
}

export interface PushLogEntry {
  id: string
  type: string
  message: string
  sent_at: string
  channel: string
}

export interface PushLogResult {
  logs: PushLogEntry[]
  quota: PushQuota
}

export interface CareModeResult {
  mode: 'active' | 'passive'
}

export interface BridgeTeacherResult {
  session_id: string
  advice: string
}

export interface MobileSummary {
  today_tasks: number
  today_completed: number
  emotion_score: number
  pending_items: number
}

export interface VoiceReportResult {
  audio_url: string
  transcript: string
}

// ── API Functions ──

/** 获取完整数据面板（所有模块指标汇总） */
export async function getFullDashboard() {
  return apiGet<FullDashboard>('/analytics/dashboard/full')
}

/** 指标下钻 */
export async function drillDown(metricKey: string, level?: number) {
  return apiGet<DrilldownResult>(
    `/analytics/drilldown/${metricKey}`,
    level ? { level: String(level) } : undefined,
  )
}

/** 获取情绪指数 */
export async function getEmotionIndex() {
  return apiGet<EmotionIndex>('/analytics/emotion/index')
}

/** 获取情绪曲线 */
export async function getEmotionCurve(period?: string) {
  return apiGet<EmotionCurve>(
    '/analytics/emotion/curve',
    period ? { period } : undefined,
  )
}

/** 提交情绪自评分数 */
export async function submitEmotionScore(body: { score: number }) {
  return apiPost('/analytics/emotion/score', body)
}

/** 申诉情绪评分 */
export async function appealEmotionScore(body: {
  date: string
  corrected_score: number
  reason: string
}) {
  return apiPost('/analytics/emotion/appeal', body)
}

/** 触发正向关怀 */
export async function triggerPositiveCare() {
  return apiPost('/analytics/care/positive/trigger')
}

/** 触发反向关怀 */
export async function triggerNegativeCare() {
  return apiPost('/analytics/care/negative/trigger')
}

/** 获取关怀推送日志 */
export async function getPushLog() {
  return apiGet<PushLogResult>('/analytics/care/push-log')
}

/** 切换关怀模式（active=主动推送 | passive=被动响应） */
export async function switchCareMode(body: { mode: 'active' | 'passive' }) {
  return apiPut<CareModeResult>('/analytics/care/mode', body)
}

/** 导师桥接 — 请求专家/顾问支持 */
export async function bridgeTeacher(body: {
  problem_type: string
  context?: string
}) {
  return apiPost<BridgeTeacherResult>('/analytics/teacher/bridge', body)
}

/** 移动端摘要数据 */
export async function getMobileSummary() {
  return apiGet<MobileSummary>('/analytics/mobile/summary')
}

/** 移动端语音报告 */
export async function getVoiceReport() {
  return apiPost<VoiceReportResult>('/analytics/mobile/voice-report')
}
