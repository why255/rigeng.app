/**
 * 智能办公 (M6) API 封装
 * 对应后端 smart_office 相关接口
 */
import { apiGet, apiPost } from './api'

// Types
export interface HRModuleItem {
  key: string
  name: string
  icon: string
  tool_count: number
  description: string
}

export interface ToolCard {
  key: string
  name: string
  description: string
  input_placeholder: string
}

export interface SystemBuildState {
  build_id: string
  current_step: number
  step_name: string
  status: string
  step_data?: any
}

export interface OfficeDocument {
  id: string
  title: string
  module_key: string
  doc_type: string
  status: string
  created_at: string
}

export interface DraftItem {
  id: string
  doc_id: string
  title: string
  step_num: number
  saved_at: string
}

// GET /api/v1/office/modules — 获取HR模块列表
export async function getHRModules() {
  return apiGet<{ modules: HRModuleItem[] }>('/office/modules')
}

// GET /api/v1/office/tools/:moduleKey — 获取模块工具列表
export async function getModuleTools(moduleKey: string) {
  return apiGet<{ module_key: string; tools: ToolCard[] }>(`/office/tools/${moduleKey}`)
}

// POST /api/v1/office/system/start — 启动体系搭建
export async function startSystemBuild(body: { module_key?: string }) {
  return apiPost<{ build_id: string; current_step: number }>('/office/system/start', body)
}

// GET /api/v1/office/system/builds — 获取体系搭建列表
export async function getSystemBuilds() {
  return apiGet<{ builds: SystemBuildState[] }>('/office/system/builds')
}

// GET /api/v1/office/system/:buildId — 获取搭建状态
export async function getBuildState(buildId: string) {
  return apiGet<SystemBuildState>(`/office/system/${buildId}`)
}

// POST /api/v1/office/system/step/:stepNum — 提交步骤答案
export async function submitBuildStep(stepNum: number, body: { answer: string; module_key?: string }) {
  return apiPost<{ completed: boolean; next_step?: number }>(`/office/system/step/${stepNum}`, body)
}

// POST /api/v1/office/generate — 生成文档
export async function generateDocument(body: {
  module_key: string
  tool_key: string
  input_text: string
  doc_type?: string
}) {
  return apiPost<{ doc_id: string; title: string; content: any }>('/office/generate', body)
}

// POST /api/v1/office/drafts — 保存草稿
export async function saveDraft(body: { doc_id?: string; title: string; step_num: number; content: any }) {
  return apiPost<{ draft_id: string }>('/office/drafts', body)
}

// GET /api/v1/office/drafts — 获取草稿列表
export async function getDrafts() {
  return apiGet<{ drafts: DraftItem[] }>('/office/drafts')
}

// POST /api/v1/office/policy/upload — 上传政策文件
export async function uploadPolicy(body: { doc_id: string; file_content: string; original_filename: string }) {
  return apiPost('/office/policy/upload', body)
}

// POST /api/v1/office/policy/compare — 政策对比
export async function comparePolicy(body: { doc_id: string; policy_id: string }) {
  return apiPost('/office/policy/compare', body)
}

// GET /api/v1/office/documents/:docId/versions — 获取文档版本列表
export async function getDocVersions(docId: string) {
  return apiGet<{ versions: any[] }>(`/office/documents/${docId}/versions`)
}

// POST /api/v1/office/documents/:docId/rollback — 回滚文档版本
export async function rollbackVersion(docId: string, body: { version_num: number }) {
  return apiPost(`/office/documents/${docId}/rollback`, body)
}

// POST /api/v1/office/documents/:docId/archive — 归档文档
export async function archiveDocument(docId: string) {
  return apiPost<{ success: boolean }>(`/office/documents/${docId}/archive`)
}

// POST /api/v1/office/collaborate/invite — 邀请协作者
export async function inviteCollaborator(body: { doc_id: string; teacher_id: string }) {
  return apiPost('/office/collaborate/invite', body)
}

// GET /api/v1/office/module-connections — 获取模块关联
export async function getModuleConnections() {
  return apiGet<{ connections: any[] }>('/office/module-connections')
}
