/**
 * 暮有复盘 · Reviews API 函数（步骤11 完整版）。
 */
import { apiGet, apiPost } from './api';

// ── Types ──

export type ReviewStage = 'greeting' | 'inventory' | 'extraction' | 'improvement' | 'archive';

export interface GentlePersistenceResponse {
  triggered: boolean;
  already_used: boolean;
  reply: string;
  allow_skip: boolean;
}

export interface SaveMessageResponse {
  saved: boolean;
  stage: ReviewStage;
  gentle_persistence?: GentlePersistenceResponse;
}

export interface ReviewMessage {
  stage: ReviewStage;
  role: 'assistant' | 'user';
  text: string;
  time?: string;
}

export interface EmotionScore {
  score: number; // -10 ~ +10
  timestamp?: string;
}

export interface CourageValue {
  value: number; // 0-100
  message?: string;
}

export interface ReviewStats {
  total_tasks: number;
  completed_tasks: number;
  completion_rate: number;
  sop_count: number;
  courage_value: number;
  courage_message?: string;
}

export interface YesterdayReviewSummary {
  sop_title: string;
  completion_rate: string;
  courage_value: number;
  archived: boolean;
  date?: string;
}

export interface SopStep {
  step_number: number;
  title: string;
  description: string;
}

export interface SopDetail {
  id: string;
  title: string;
  steps: SopStep[];
  key_phrases?: string;
  precautions?: string;
  quality_score?: number;
  kb_doc_id?: string;  // 知识库归档文档ID（步骤11：跨模块数据流）
  created_at?: string;
}

export interface DiagnosisAnswers {
  goal_completion: 'exceeded' | 'completed' | 'partial' | 'delayed' | 'not_started';
  new_experience: string;
  improvements: string;
  tomorrow_priority: string;
}

export interface DiagnosisResult {
  id: string;
  answers: DiagnosisAnswers;
  submitted_at?: string;
}

export interface ArchiveResult {
  archived: boolean;
  courage_value: number;
  completion_rate: number;
  message?: string;
}

export interface WeeklyDayProgress {
  day: string; // '周一' ~ '周日'
  day_index: number; // 0-6
  status: 'completed' | 'in_progress' | 'pending';
  completion_rate?: number; // 0-100
}

export interface WeeklyProgress {
  week_label: string;
  days: WeeklyDayProgress[];
}

export interface ReviewHistoryItem {
  id: string;
  date: string;
  day_of_week: string;
  sop_title?: string;
  quality_score?: number; // 1-5
  status: 'completed' | 'skipped';
}

// ── API Functions ──

/** 获取今日复盘统计数据 */
export function fetchTodayReviewStats(): Promise<ReviewStats> {
  return apiGet<ReviewStats>('/reviews/stats');
}

/** 获取昨日复盘摘要 */
export function fetchYesterdayReviewSummary(): Promise<YesterdayReviewSummary | null> {
  return apiGet<YesterdayReviewSummary | null>('/reviews/yesterday-summary');
}

/** 保存复盘对话记录（每个阶段结束时触发）。返回包含温柔坚持检测结果。 */
export function saveReviewMessage(data: {
  stage: ReviewStage;
  messages: Array<{ role: 'assistant' | 'user'; text: string }>;
  emotion_score?: number;
  courage_value?: number;
}): Promise<SaveMessageResponse> {
  return apiPost<SaveMessageResponse>('/reviews/messages', data);
}

/** 生成/保存 SOP（自动归档到知识库） */
export function saveSop(data: {
  title: string;
  steps: Array<{ step_number: number; title: string; description: string }>;
  key_phrases?: string;
  precautions?: string;
}): Promise<SopDetail> {
  return apiPost<SopDetail>('/reviews/sop', data);
}

/** 获取今日生成的 SOP */
export function fetchTodaySop(): Promise<SopDetail | null> {
  return apiGet<SopDetail | null>('/reviews/sop/today');
}

/** 提交诊断问卷 */
export function submitDiagnosis(answers: DiagnosisAnswers): Promise<DiagnosisResult> {
  return apiPost<DiagnosisResult>('/reviews/diagnosis', answers);
}

/** 归档今日复盘 */
export function archiveReview(): Promise<ArchiveResult> {
  return apiPost<ArchiveResult>('/reviews/archive');
}

/** 获取本周复盘进度 */
export function fetchWeeklyProgress(): Promise<WeeklyProgress> {
  return apiGet<WeeklyProgress>('/reviews/weekly-progress');
}

/** 获取历史复盘列表 */
export function fetchReviewHistory(): Promise<ReviewHistoryItem[]> {
  return apiGet<ReviewHistoryItem[]>('/reviews/history');
}

// ── 步骤11 新增API函数 ──

export interface NonReviewReminder {
  days: number;
  threshold: number;
  channel: 'push' | 'sms' | 'operator';
  level: 'gentle' | 'concerned' | 'urgent';
  message: string;
}

export interface NonReviewRemindersResult {
  consecutive_skip_days: number;
  reminders: NonReviewReminder[];
  needs_attention: boolean;
}

/** 检查连续未复盘天数及应触发的提醒 */
export function fetchNonReviewReminders(): Promise<NonReviewRemindersResult> {
  return apiGet<NonReviewRemindersResult>('/reviews/non-review-reminders');
}

// ── AI 复盘对话 ──

export interface ReviewChatResult {
  reply: string;
  model_used: string;
}

/** 暮有复盘 AI 对话 — 所有小耕回复由AI模型生成 */
export function reviewChat(data: {
  message: string;
  phase: 'collecting' | 'reviewing';
  stage: ReviewStage;
  context: Array<{ role: 'user' | 'assistant'; text: string }>;
  info_rounds: number;
  gentle_persistence_used: boolean;
}): Promise<ReviewChatResult> {
  return apiPost<ReviewChatResult>('/reviews/chat', data);
}
