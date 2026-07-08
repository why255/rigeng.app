/**
 * 智能问答（M5）API 封装（步骤16）。
 *
 * 对应后端路由：
 *   POST   /qa/ask                        发起提问（三源检索 + AI四要素答案）
 *   GET    /qa/conversations/:id          获取对话历史
 *   DELETE /qa/conversations/:id          删除对话
 *   POST   /qa/answers/:id/feedback       纠错反馈（防幻觉L3）
 *   POST   /qa/answers/:id/helpful        标记答案有帮助
 *   POST   /qa/answers/:id/archive        归档到知识库（SOP沉淀）
 *   GET    /qa/hot-questions              热门问题推荐
 *   GET    /qa/history                     搜索问答历史
 */

import { apiGet, apiPost, apiDelete } from './api'

/* ---------- 类型定义 ---------- */

export interface SourceEngine {
  key: 'private' | 'xiejun' | 'internet'
  enabled: boolean
}

export interface AnswerElement {
  key: string
  title: string
  icon: string
  color: string
  summary: string
  detail: string[]
}

export interface AnswerSource {
  title: string
  library: string
  label: string
  updated_at: string
  verified: boolean
  is_internet: boolean
  is_stale: boolean
  doc_id?: string
}

export interface QaAnswer {
  id: string
  question: string
  intro: string
  elements: AnswerElement[]
  source: AnswerSource | null
  conversation_id: string
  rounds: number
  created_at: string
}

export interface AskResponse {
  conversation_id: string
  answer: QaAnswer | null
  is_clarification: boolean
  clarification_question: string
  suggestions: string[]
}

export interface ConversationMessage {
  role: 'assistant' | 'user'
  text: string
  answer?: QaAnswer | null
}

export interface ConversationOut {
  conversation_id: string
  question: string
  rounds: number
  status: string
  messages: ConversationMessage[]
  created_at: string
}

export interface HotQuestion {
  id: string
  text: string
}

export interface ArchiveResponse {
  success: boolean
  doc_id: string
  answer_id: string
  contribution_value: number
}

export interface FeedbackResponse {
  feedback_id: string
  answer_id: string
  status: string
}

export interface HelpfulResponse {
  answer_id: string
  helpful_count: number
}

/* ---------- 提问 API ---------- */

/** 发起提问（新问题或追问） */
export function askQuestion(
  question: string,
  conversationId?: string,
  sourceEngines?: SourceEngine[],
): Promise<AskResponse> {
  return apiPost<AskResponse>('/qa/ask', {
    question,
    conversation_id: conversationId || undefined,
    source_engines: sourceEngines,
  })
}

/* ---------- 对话管理 API ---------- */

/** 获取对话历史 */
export function getConversation(conversationId: string): Promise<ConversationOut> {
  return apiGet<ConversationOut>(`/qa/conversations/${conversationId}`)
}

/** 删除对话 */
export function deleteConversation(conversationId: string): Promise<{ deleted: boolean }> {
  return apiDelete<{ deleted: boolean }>(`/qa/conversations/${conversationId}`)
}

/* ---------- 反馈 & 纠错 API ---------- */

/** 纠错反馈（防幻觉L3） */
export function submitFeedback(
  answerId: string,
  feedbackType: string,
  detail?: string,
): Promise<FeedbackResponse> {
  return apiPost<FeedbackResponse>(`/qa/answers/${answerId}/feedback`, {
    answer_id: answerId,
    feedback_type: feedbackType,
    detail: detail || undefined,
  })
}

/** 标记答案有帮助 */
export function markHelpful(answerId: string): Promise<HelpfulResponse> {
  return apiPost<HelpfulResponse>(`/qa/answers/${answerId}/helpful`, {
    answer_id: answerId,
  })
}

/* ---------- 归档 API ---------- */

/** 将答案归档到知识库（SOP沉淀） */
export function archiveAnswer(
  answerId: string,
  hrCategory?: string,
): Promise<ArchiveResponse> {
  return apiPost<ArchiveResponse>(`/qa/answers/${answerId}/archive`, {
    answer_id: answerId,
    hr_category: hrCategory || undefined,
  })
}

/* ---------- 查询 API ---------- */

/** 获取热门问题 */
export function fetchHotQuestions(): Promise<HotQuestion[]> {
  return apiGet<HotQuestion[]>('/qa/hot-questions')
}

/** 搜索问答历史 */
export function searchQaHistory(query?: string): Promise<ConversationOut[]> {
  return apiGet<ConversationOut[]>('/qa/history', query ? { q: query } : undefined)
}
