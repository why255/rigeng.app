/**
 * 高维求职 · Career API 函数。
 */
import { apiGet, apiPost } from './api';

// ── Types ──

export interface ResumeFileUploadResult {
  career_progress_id: string;
  filename: string;
  text_preview: string;
  text_length: number;
  parsed_summary: string;
  key_skills: string[];
  key_experiences: string[];
  suggested_next: string;
}

// ── API Functions ──

/** 上传简历文件（PDF/Word），AI自动解析 */
export function uploadResumeFile(file: File): Promise<ResumeFileUploadResult> {
  const formData = new FormData();
  formData.append('file', file);

  const token = localStorage.getItem('rg_token') ?? '';
  return fetch('/api/v1/career/resume/file', {
    method: 'POST',
    body: formData,
    headers: { Authorization: `Bearer ${token}` },
  }).then(async (res) => {
    if (!res.ok) {
      const errBody = await res.text();
      let msg = `上传失败 (${res.status})`;
      try {
        const errJson = JSON.parse(errBody);
        msg = errJson.message || errJson.detail || msg;
      } catch { /* */ }
      throw new Error(msg);
    }
    const json = await res.json();
    return json.data as ResumeFileUploadResult;
  });
}

/** 获取五步法进度 */
export function fetchCareerProgress(): Promise<{
  career_progress_id: string;
  current_step: number;
  step_labels: Record<number, string>;
  status: string;
}> {
  return apiGet<{
    career_progress_id: string;
    current_step: number;
    step_labels: Record<number, string>;
    status: string;
  }>('/career/progress');
}

// ── AI 对话 ──

export interface CareerChatResult {
  reply: string;
  model_used: string;
}

/** 高维求职 AI 对话 — 所有小耕回复由AI模型生成 */
export function careerChat(data: {
  message: string;
  step: string;
  context: Array<{ role: string; text: string }>;
  sub_index: number;
  has_resume: boolean;
}): Promise<CareerChatResult> {
  return apiPost<CareerChatResult>('/career/chat', data);
}
