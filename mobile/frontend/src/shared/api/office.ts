/**
 * 智能办公 · Office API 函数。
 */
import { apiGet, apiPost } from './api';

// ── Types ──

export interface HrModuleCategory {
  module_key: string;
  module_name: string;
  description: string;
  icon: string;
  color: string;
  tools: Array<{
    tool_key: string;
    title: string;
    description: string;
    icon: string;
    doc_template: string;
  }>;
}

export interface DocumentSection {
  heading: string;
  body: string;
  level: number;
}

export interface GenerateDocumentResult {
  doc_id: string;
  title: string;
  module_key: string;
  doc_type: string;
  content: DocumentSection[];
  source_tags: string[];
  regenerate_count: number;
  brand_logo_visible: boolean;
}

export interface OfficeChatResult {
  reply: string;
  model_used: string;
}

// ── API Functions ──

/** 获取HR八大模块及工具卡片 */
export function fetchHrModules(): Promise<{ modules: HrModuleCategory[] }> {
  return apiGet<{ modules: HrModuleCategory[] }>('/office/modules');
}

/** AI生成文档 */
export function generateDocument(data: {
  module_key: string;
  doc_type: string;
  tool_key?: string;
  build_id?: string;
  custom_prompt?: string;
  brand_logo_visible?: boolean;
}): Promise<GenerateDocumentResult> {
  return apiPost<GenerateDocumentResult>('/office/generate', data);
}

/** 智能办公 AI 对话 — 所有小耕回复由AI模型生成 */
export function officeChat(data: {
  message: string;
  module_key: string;
  module_name: string;
  tool_key: string;
  tool_label: string;
  context: Array<{ role: string; text: string }>;
  question_index: number;
}): Promise<OfficeChatResult> {
  return apiPost<OfficeChatResult>('/office/chat', data);
}
