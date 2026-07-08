/**
 * 朝有规划 · Plans API 函数。
 */
import { apiGet, apiPost, apiPatch, apiDelete } from './api';

// ── Types ──

export type Quadrant = 'urgent_important' | 'not_urgent_important' | 'urgent_not_important' | 'not_urgent_not_important';

export interface PlanTask {
  id: string;
  plan_id: string;
  title: string;
  description?: string | null;
  quadrant: Quadrant;
  source: 'user_input' | 'yesterday_unfinished' | 'smart_record_sync';
  status: 'pending' | 'completed';
  sort_order: number;
  time_estimate?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PlanStats {
  total_tasks: number;
  completed_tasks: number;
  completion_rate: number;
  pending_tasks: number;
}

export interface Plan {
  id: string;
  user_id: string;
  title: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  stats?: PlanStats | null;
  tasks: PlanTask[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface TodayOverview {
  task_count: number;
  completion_rate: number;
  pending_count: number;
}

export interface TaskList {
  tasks: PlanTask[];
}

export interface SyncItem {
  action: 'create_plan' | 'update_task' | 'complete_plan';
  payload: Record<string, unknown>;
  timestamp: number;
}

export interface SyncResult {
  synced: number;
  results: Array<{ action: string; status: string; plan_id?: string; task_id?: string; message?: string }>;
}

// ── API Functions ──

/** 获取今日活跃计划（含全部任务） */
export function fetchTodayPlan(): Promise<Plan | null> {
  return apiGet<Plan | null>('/plans/today');
}

/** 今日概览统计 */
export function fetchStats(): Promise<TodayOverview> {
  return apiGet<TodayOverview>('/plans/stats');
}

/** 获取指定计划 */
export function fetchPlan(planId: string): Promise<Plan> {
  return apiGet<Plan>(`/plans/${planId}`);
}

/** 创建新计划 */
export function createPlan(title: string, tasks: Array<{
  title: string;
  description?: string;
  quadrant?: string;
  source?: string;
  time_estimate?: string;
}>): Promise<Plan> {
  return apiPost<Plan>('/plans', { title, tasks });
}

/** 更新任务 */
export function updateTask(
  planId: string,
  taskId: string,
  updates: {
    title?: string;
    description?: string;
    quadrant?: string;
    status?: string;
    sort_order?: number;
    time_estimate?: string;
  },
): Promise<PlanTask> {
  return apiPatch<PlanTask>(`/plans/${planId}/tasks/${taskId}`, updates);
}

/** 移动任务到新象限 */
export function moveTaskQuadrant(planId: string, taskId: string, newQuadrant: string): Promise<PlanTask> {
  return apiPatch<PlanTask>(`/plans/${planId}/tasks/${taskId}/quadrant`, { new_quadrant: newQuadrant });
}

/** 标记计划已完成 */
export function completePlan(planId: string): Promise<Plan> {
  return apiPost<Plan>(`/plans/${planId}/complete`);
}

/** 确认今日计划（设为active，不标记任务完成） */
export function confirmPlan(planId: string): Promise<Plan> {
  return apiPost<Plan>(`/plans/${planId}/confirm`);
}

/** 归档计划 */
export function archivePlan(planId: string, date?: string): Promise<{ archived: boolean }> {
  return apiPost<{ archived: boolean }>(`/plans/${planId}/archive`, { date });
}

/** 批量离线同步 */
export function syncOffline(items: SyncItem[]): Promise<SyncResult> {
  return apiPost<SyncResult>('/plans/sync', { items });
}

/** 昨日未完成任务 */
export function fetchYesterdayUnfinished(): Promise<TaskList> {
  return apiGet<TaskList>('/plans/yesterday-unfinished');
}

/** 智能记录同步任务 */
export function fetchSmartRecordSync(): Promise<TaskList> {
  return apiGet<TaskList>('/plans/smart-record-sync');
}

// ── User settings (reuses existing user_auth endpoints) ──

/** 更新关怀模式 */
export function updateCareMode(careMode: 'active' | 'passive'): Promise<{ care_mode: string }> {
  return apiPatch<{ care_mode: string }>('/users/me/care-mode', { care_mode: careMode });
}

/** 获取当前用户信息 */
export function fetchCurrentUser(): Promise<{
  user_id: string;
  nickname?: string;
  care_mode: string;
  voice_type?: string;
}> {
  return apiGet<{
    user_id: string;
    nickname?: string;
    care_mode: string;
    voice_type?: string;
  }>('/users/me');
}

// ── 任务增删 ──

/** 删除任务 */
export function deleteTask(planId: string, taskId: string): Promise<{ deleted: boolean }> {
  return apiDelete<{ deleted: boolean }>(`/plans/${planId}/tasks/${taskId}`);
}

/** 向已有计划添加任务 */
export function addTask(planId: string, task: {
  title: string;
  description?: string;
  quadrant?: string;
  source?: string;
  time_estimate?: string;
}): Promise<PlanTask> {
  return apiPost<PlanTask>(`/plans/${planId}/tasks`, task);
}

/** 提升任务到今日计划 */
export function promoteTasks(planId: string, taskIds: string[], source: string = 'yesterday_unfinished'): Promise<{ promoted: number; task_ids: string[] }> {
  return apiPost<{ promoted: number; task_ids: string[] }>(`/plans/${planId}/promote`, { task_ids: taskIds, source });
}

/** 自动提升昨日未完成到今日计划 */
export function promoteFromYesterday(taskIds: string[]): Promise<{ promoted: number; task_ids: string[] }> {
  return apiPost<{ promoted: number; task_ids: string[] }>('/plans/promote-from-yesterday', { task_ids: taskIds, source: 'yesterday_unfinished' });
}

// ── AI 对话集成 ──

export interface ConverseResult {
  conversation_id: string;
  assistant_reply: string;
  is_crisis: boolean;
  is_hr_guided: boolean;
  suggestions: string[] | null;
  provider?: string | null;  // "anthropic" | "zhipu" | null
}

/** 调用小耕AI多轮对话（朝有规划模块） */
export function conversePlan(
  userInput: string,
  conversationId: string | null = null,
  contextMeta?: Record<string, unknown>,
): Promise<ConverseResult> {
  return apiPost<ConverseResult>('/voice/converse', {
    user_input: userInput,
    conversation_id: conversationId,
    module: 'morning_plan',
    context_meta: contextMeta,
  });
}
