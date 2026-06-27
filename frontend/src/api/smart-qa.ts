/**
 * 智能问答 · Smart QA API 函数。
 * 对接后端 /api/v1/qa/* 路由（步骤16：三源引擎、四要素答案、纠错反馈、归档）。
 */
import { apiGet, apiPost, apiDelete } from './api'

// ── Types ──

export interface SourceEngineConfig {
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
  doc_id: string | null
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
  answer: QaAnswer
  is_clarification: boolean
  clarification_question: string
  suggestions: string[]
}

export interface ConversationMessage {
  role: 'assistant' | 'user'
  text: string
  answer: QaAnswer | null
}

export interface Conversation {
  conversation_id: string
  question: string
  rounds: number
  status: string
  messages: ConversationMessage[]
  created_at: string
}

export interface HotQuestionItem {
  id: string
  text: string
}

export interface FeedbackResult {
  feedback_id: string
  answer_id: string
  status: string
}

export interface ArchiveResult {
  success: boolean
  doc_id: string
  answer_id: string
  contribution_value: number
}

export interface HelpfulResult {
  answer_id: string
  helpful_count: number
}

export interface HistoryItem {
  conversation_id: string
  question: string
  created_at: string
}

// ── API Functions ──

/** 发起提问（三源检索 + AI答案生成） */
export async function askQuestion(body: {
  question: string
  conversation_id?: string | null
  source_engines?: SourceEngineConfig[]
}) {
  return apiPost<AskResponse>('/qa/ask', body)
}

/** 获取对话历史 */
export async function getConversation(conversationId: string) {
  return apiGet<Conversation>(`/qa/conversations/${conversationId}`)
}

/** 删除对话 */
export async function deleteConversation(conversationId: string) {
  return apiDelete<{ deleted: boolean }>(`/qa/conversations/${conversationId}`)
}

/** 提交纠错反馈 */
export async function submitFeedback(body: {
  answer_id: string
  feedback_type: string
  detail?: string | null
}) {
  return apiPost<FeedbackResult>('/qa/answers/${body.answer_id}/feedback', {
    answer_id: body.answer_id,
    feedback_type: body.feedback_type,
    detail: body.detail,
  })
}

/** 标记答案有帮助 */
export async function markHelpful(answerId: string) {
  return apiPost<HelpfulResult>(`/qa/answers/${answerId}/helpful`, {
    answer_id: answerId,
  })
}

/** 归档答案到知识库（SOP沉淀） */
export async function archiveAnswer(
  answerId: string,
  hrCategory?: string,
) {
  return apiPost<ArchiveResult>(`/qa/answers/${answerId}/archive`, {
    answer_id: answerId,
    hr_category: hrCategory,
  })
}

/** 获取热门问题推荐 */
export async function getHotQuestions() {
  return apiGet<{ items: HotQuestionItem[] }>('/qa/hot-questions')
}

/** 搜索问答历史 */
export async function searchHistory(q?: string) {
  return apiGet<{ items: HistoryItem[] }>('/qa/history', q ? { q } : undefined)
}
