/**
 * 公私智库 · Knowledge Base API 函数。
 * 步骤12：对齐后端 /api/v1/kb/* 路由。
 */
import { apiGet, apiPost, apiPatch } from './api';

// ── Types (前端展示用，由API层做后端字段→前端字段映射) ──

export type LibraryType = 'private' | 'public';

export type DocStatus = 'published' | 'pending' | 'rejected' | 'archived';

export type ExportFormat = 'pdf' | 'word' | 'image';

export interface DocumentItem {
  id: string;
  title: string;
  description?: string | null;
  library: LibraryType;
  category: string;
  fileType: string;
  fileSize: number;
  keywords?: string[];
  creator?: string;
  status: DocStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DocStats {
  totalDocs: number;
  privateCount: number;
  publicCount: number;
  storageUsed: number;    // GB
  storageLimit: number;   // GB
  todayNew: number;
}

export interface Category {
  id: string;
  name: string;
  count: number;
  children?: Category[];
}

export interface SearchResult {
  items: DocumentItem[];
  query: string;
  total: number;
  semanticMatches: number;
}

export interface PendingDocItem {
  id: string;
  title: string;
  fileType: string;
  source: string;
  submittedAt: string;
  status: 'pending' | 'rejected';
  rejectReason?: string;
}

export interface KpiData {
  completionRate: number;
  completionRateChange: number;
  sopCount: number;
  sopCountChange: number;
  streakDays: number;
}

export interface TrendPoint {
  label: string;
  value: number;
}

export interface DistributionItem {
  name: string;
  value: number;
}

export interface ComparisonData {
  current: { label: string; value: number };
  previous: { label: string; value: number };
  change: number;
  direction: 'up' | 'down';
}

export interface KnowledgeSettings {
  autoArchive: boolean;
  watermarkEnabled: boolean;
  storageAlertThreshold: number;
}

// ── Internal: 后端文档→前端 DocumentItem 映射 ──

/** 后端 Document 字典 → 前端 DocumentItem */
function mapDoc(d: Record<string, any>): DocumentItem {
  const docType = d.doc_type || 'sop';
  return {
    id: d.doc_id || d.id || '',
    title: d.title || '未命名文档',
    description: d.description || null,
    library: (d.library_type === 'public' ? 'public' : 'private') as LibraryType,
    category: d.hr_category || '其他',
    fileType: docTypeToFileType(docType),
    fileSize: d.file_size || d.size_bytes || 0,
    keywords: d.keywords || d.tags || [],
    creator: d.creator || '系统',
    status: mapDocStatus(d.status, d.audit_status),
    createdAt: d.created_at || d.createdAt || new Date().toISOString(),
    updatedAt: d.updated_at || d.updatedAt || new Date().toISOString(),
  };
}

function docTypeToFileType(docType: string): string {
  switch (docType) {
    case 'sop':
    case 'improvement_strategy':
    case 'improvement_guide':
    case 'growth_manual':
      return 'pdf';
    case 'extraction_report':
    case 'meeting_minutes':
      return 'docx';
    case 'interview_eval':
    case 'interview_review':
    case 'resume':
      return 'docx';
    case 'skill_crystal':
    case 'brand_content':
      return 'pdf';
    default:
      return 'docx';
  }
}

function mapDocStatus(status: string, auditStatus?: string): DocStatus {
  if (status === 'published') return 'published';
  if (status === 'recycled') return 'archived';
  if (auditStatus === 'rejected') return 'rejected';
  if (auditStatus === 'pending' || status === 'draft') return 'pending';
  return 'published';
}

// ── API Functions ──

/** 获取最近文档列表 */
export function fetchRecentDocs(limit: number = 5, sort: string = 'latest'): Promise<DocumentItem[]> {
  return apiGet<{ items: any[] }>('/kb/search', { top_n: String(limit) })
    .then(res => (res.items || []).map(mapDoc));
}

/** 获取文档统计 */
export function fetchDocStats(): Promise<DocStats> {
  return apiGet<DocStats>('/kb/stats');
}

/** 热门搜索词 */
export function fetchHotSearches(): Promise<string[]> {
  return apiGet<{ keywords: string[] }>('/kb/search/hot')
    .then(res => res.keywords || []);
}

/** RAG 语义检索 */
export function searchDocs(query: string, limit: number = 20): Promise<SearchResult> {
  return apiGet<{ items: any[]; total: number }>('/kb/search', {
    query,
    top_n: String(limit),
    sources: 'private,public',
  }).then(res => ({
    items: (res.items || []).map(mapDoc),
    query,
    total: res.total || 0,
    semanticMatches: 0, // MVP: keyword-only
  }));
}

/** 按分类获取文档列表 */
export function fetchDocsByCategory(
  category?: string,
  library?: LibraryType,
  page: number = 1,
  limit: number = 20,
): Promise<{ items: DocumentItem[]; total: number; page: number }> {
  const sources = library === 'public' ? 'public' : library === 'private' ? 'private' : 'private,public';
  return apiGet<{ items: any[]; total: number }>('/kb/search', {
    top_n: String(limit),
    sources,
  }).then(res => {
    let items = (res.items || []).map(mapDoc);
    if (category) {
      items = items.filter(d => d.category === category);
    }
    // 简易分页
    const start = (page - 1) * limit;
    return {
      items: items.slice(start, start + limit),
      total: items.length,
      page,
    };
  });
}

/** 获取分类树 */
export function fetchCategories(): Promise<Category[]> {
  return apiGet<{ categories: Category[] }>('/kb/categories')
    .then(res => res.categories || []);
}

/** 获取单个文档详情 */
export function fetchDocDetail(id: string): Promise<DocumentItem> {
  return apiGet<any>(`/kb/documents/${id}`).then(mapDoc);
}

/** 导出文档 */
export function exportDoc(
  id: string,
  format: ExportFormat = 'pdf',
  watermark?: string,
): Promise<{ downloadUrl: string }> {
  return apiGet<{ doc_id: string; downloadUrl: string; format: string; watermark?: string }>(`/kb/documents/${id}/export`);
}

/** 获取待审核文档列表 */
export function fetchPendingDocs(): Promise<PendingDocItem[]> {
  return apiGet<{ items: any[] }>('/kb/audit-queue')
    .then(res => (res.items || []).map((d: any) => ({
      id: d.doc_id || d.id || '',
      title: d.title || '未命名',
      fileType: docTypeToFileType(d.doc_type || 'sop'),
      source: d.source_module || '未知模块',
      submittedAt: d.created_at || d.entered_at || new Date().toISOString(),
      status: d.audit_status === 'rejected' ? 'rejected' : 'pending',
      rejectReason: d.reject_reason || undefined,
    })));
}

/** 通过审核 */
export function approveDoc(id: string): Promise<{ success: boolean }> {
  return apiPost<{ approved_count: number }>(`/kb/documents/${id}:approve`)
    .then(res => ({ success: res.approved_count > 0 }));
}

/** 驳回文档 */
export function rejectDoc(id: string, reason?: string): Promise<{ success: boolean }> {
  return apiPost<{ doc_id: string; audit_status: string }>(`/kb/documents/${id}:reject`, { reason })
    .then(res => ({ success: res.audit_status === 'rejected' }));
}

/** 获取模块设置 */
export function fetchKnowledgeSettings(): Promise<KnowledgeSettings> {
  return apiGet<KnowledgeSettings>('/kb/settings');
}

/** 更新模块设置 */
export function updateKnowledgeSettings(
  settings: Partial<KnowledgeSettings>,
): Promise<KnowledgeSettings> {
  return apiPatch<KnowledgeSettings>('/kb/settings', {
    auto_archive: settings.autoArchive,
    watermark_enabled: settings.watermarkEnabled,
    storage_alert_threshold: settings.storageAlertThreshold,
  });
}

// ── Analytics API (保持不变，走 /analytics 路由) ──

/** 后端 KPI 原始格式（snake_case） */
interface KpiRaw {
  completion_rate: number;
  sop_count: number;
  streak_days: number;
  emotion_score: number;
  total_recordings: number;
  total_docs: number;
  courage_value: number;
  total_tasks: number;
  completed_tasks: number;
}

/** 后端→前端 KPI 字段映射 */
function mapKpi(raw: KpiRaw): KpiData {
  return {
    completionRate: raw.completion_rate,
    completionRateChange: 0,
    sopCount: raw.sop_count,
    sopCountChange: 0,
    streakDays: raw.streak_days,
  };
}

/** 获取 KPI 数据 */
export function fetchKpi(): Promise<KpiData> {
  return apiGet<KpiRaw>('/analytics/kpi').then(mapKpi);
}

/** 获取趋势数据 */
export function fetchTrend(days: number = 7, dimension?: 'day' | 'week'): Promise<TrendPoint[]> {
  const params: Record<string, string> = { days: String(days) };
  if (dimension) params.dimension = dimension;
  return apiGet<{ points: TrendPoint[] }>('/analytics/trend', params)
    .then(res => res.points || []);
}

/** 获取模块分布数据 */
export function fetchDistribution(): Promise<DistributionItem[]> {
  return apiGet<{ items: DistributionItem[] }>('/analytics/distribution')
    .then(res => res.items || []);
}

/** 获取对比数据 */
export function fetchComparison(): Promise<ComparisonData[]> {
  return apiGet<ComparisonData[]>('/analytics/comparison');
}

/** 获取 SOP 周汇总 */
export function fetchSopWeekly(): Promise<{ week: string; count: number; items: DistributionItem[] }> {
  return apiGet<{ week: string; count: number; items: DistributionItem[] }>('/analytics/sop/weekly');
}

/** 获取详细趋势数据（多维度） */
export function fetchTrendDetail(period: 'week' | 'month' = 'week'): Promise<{
  completion: TrendPoint[];
  sop: TrendPoint[];
}> {
  return apiGet<{ completion: TrendPoint[]; sop: TrendPoint[] }>('/analytics/trend/detail', { period });
}

/** 获取各模块贡献度数据 */
export function fetchContribution(): Promise<DistributionItem[]> {
  return apiGet<DistributionItem[]>('/analytics/contribution');
}

/** 获取指标构成数据 */
export function fetchComposition(): Promise<{ name: string; value: number; color: string }[]> {
  return apiGet<{ name: string; value: number; color: string }[]>('/analytics/composition');
}

/** 获取情绪评分数据 */
export function fetchEmotion(): Promise<{
  score: number;
  label: string;
  aiAnalysis: string;
  selfReported: string;
}> {
  return apiGet<{
    score: number;
    label: string;
    aiAnalysis: string;
    selfReported: string;
  }>('/analytics/emotion');
}

/** 获取预警提示 */
export function fetchAlerts(): Promise<{
  level: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  module?: string;
}[]> {
  return apiGet<{
    level: 'info' | 'warning' | 'critical';
    title: string;
    message: string;
    module?: string;
  }[]>('/analytics/alerts');
}

/** 获取推荐服务 */
export function fetchRecommendations(): Promise<{
  title: string;
  description: string;
  icon: string;
  actionLabel: string;
  actionUrl: string;
}[]> {
  return apiGet<{
    title: string;
    description: string;
    icon: string;
    actionLabel: string;
    actionUrl: string;
  }[]>('/analytics/recommendations');
}

// ── 双向诊断（步骤13核心）──

export interface DiagnosisData {
  type: 'positive' | 'encouraging' | 'caring';
  message: string;
  tone: 'celebratory' | 'supportive' | 'gentle';
  emoji: string;
  completionRate: number;
  sopCount: number;
  streakDays: number;
  suggestion?: string;
}

/** 获取双向诊断（步骤13核心API） */
export function fetchDiagnosis(): Promise<DiagnosisData> {
  return apiGet<DiagnosisData>('/analytics/diagnosis');
}

// ── 导出的默认HR八大模块分类 ──
export const HR_EIGHT_CATEGORIES = [
  '战略解码', '人资规划', '招聘配置', '培训开发',
  '薪酬福利', '绩效管理', '员工关系', '企业文化',
];
