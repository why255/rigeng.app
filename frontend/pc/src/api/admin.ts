/**
 * 管理后台 API 封装。
 * 角色校验由后端完成，前端仅透传。
 */
import { apiGet, apiPost, apiPatch, apiDelete } from './api'

/* ─────── 基础类型 ─────── */

export interface PageResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface AdminUserItem {
  user_id: string
  phone: string
  nickname: string | null
  role: string
  vip_level: string
  status: string
  trial_expire_at: string | null
  created_at: string
  tags?: { id: string; name: string; color: string }[]
}

export interface AdminUserDetail {
  user_id: string
  phone: string
  nickname: string | null
  gender: string | null
  role: string
  status: string
  vip: Record<string, any> | null
  trial: Record<string, any> | null
  teacher_profile: Record<string, any> | null
  assigned_teacher: Record<string, any> | null
  student_count: number
  contribution_points?: number
  storage_used_mb?: number
  module_usage?: { slug: string; name: string; count: number }[]
  user_tags?: { id: string; name: string; color: string }[]
  created_at: string
}

export interface AdminTeacherItem {
  user_id: string
  phone: string
  nickname: string | null
  bio: string | null
  expertise_tags: string[]
  service_status: string
  rating: number | null
  student_count: number
  created_at: string
}

export interface AdminTeacherStudent {
  user_id: string
  phone: string
  nickname: string | null
  vip_level: string
  assigned_at: string
  nda_signed: boolean
}

export interface AdminAuditLogItem {
  id: string
  operator_id: string
  action: string
  target_user_id: string | null
  detail: Record<string, any> | null
  created_at: string
}

export interface PageResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

// 用户
export function getUsers(params?: Record<string, string>) {
  return apiGet<PageResponse<AdminUserItem>>('/admin/users', params)
}
export function getUserDetail(userId: string) {
  return apiGet<AdminUserDetail>(`/admin/users/${userId}`)
}
export function changeRole(userId: string, role: string) {
  return apiPatch(`/admin/users/${userId}/role`, { role })
}

// 老师
export function grantTeacher(userId: string) {
  return apiPost('/admin/teachers/grant', { user_id: userId })
}
export function revokeTeacher(userId: string) {
  return apiPost('/admin/teachers/revoke', { user_id: userId })
}
export function getTeachers(params?: Record<string, string>) {
  return apiGet<PageResponse<AdminTeacherItem>>('/admin/teachers', params)
}
export function getTeacherStudents(teacherId: string, params?: Record<string, string>) {
  return apiGet<PageResponse<AdminTeacherStudent>>(`/admin/teachers/${teacherId}/students`, params)
}

// 分配
export function assignStudent(teacherId: string, studentId: string) {
  return apiPost('/admin/teacher-assignments', { teacher_id: teacherId, student_id: studentId })
}
export function unassignStudent(assignmentId: string) {
  return apiDelete(`/admin/teacher-assignments/${assignmentId}`)
}

// 审计
export function getAuditLogs(params?: Record<string, string>) {
  return apiGet<PageResponse<AdminAuditLogItem>>('/admin/audit-logs', params)
}

/* ─────── VIP 套餐 ─────── */

export interface VipPlan {
  id: string
  level: string // trial | primary | medium | advanced
  name: string
  price: number // 月费，单位元；advanced 为 0（一人一价）
  storage_gb: number
  record_hours: number
  video_hours: number
  features: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export function getVipPlans() {
  return apiGet<VipPlan[]>('/admin/vip/plans')
}
export function updateVipPlan(planId: string, data: Partial<VipPlan>) {
  return apiPatch(`/admin/vip/plans/${planId}`, data)
}
export function createVipPlan(data: Omit<VipPlan, 'id' | 'created_at' | 'updated_at'>) {
  return apiPost('/admin/vip/plans', data)
}

/* ─────── 用户标签 ─────── */

export interface UserTag {
  id: string
  name: string
  color: string
  user_count: number
}

export function getUserTags() {
  return apiGet<UserTag[]>('/admin/user-tags')
}
export function createUserTag(data: { name: string; color: string }) {
  return apiPost<UserTag>('/admin/user-tags', data)
}
export function deleteUserTag(tagId: string) {
  return apiDelete(`/admin/user-tags/${tagId}`)
}
export function setUserTags(userId: string, tagIds: string[]) {
  return apiPost(`/admin/users/${userId}/tags`, { tag_ids: tagIds })
}

/* ─────── 批量操作 ─────── */

export function batchFreeze(userIds: string[]) {
  return apiPost('/admin/users/batch-freeze', { user_ids: userIds })
}
export function batchUnfreeze(userIds: string[]) {
  return apiPost('/admin/users/batch-unfreeze', { user_ids: userIds })
}
export function batchExport(userIds: string[]) {
  return apiPost('/admin/users/batch-export', { user_ids: userIds })
}

/* ─────── 贡献值规则 ─────── */

export interface ContributionRule {
  id: string
  action: string
  label: string
  points: number
  category: 'earn' | 'spend'
  is_active: boolean
}

export function getContributionRules() {
  return apiGet<ContributionRule[]>('/admin/contribution/rules')
}
export function updateContributionRule(ruleId: string, data: Partial<ContributionRule>) {
  return apiPatch(`/admin/contribution/rules/${ruleId}`, data)
}

/* ─────── 运营监控 API ─────── */

export interface DashboardStats {
  total_users: number
  dau: number
  mau: number
  new_users_today: number
  vip_conversion_rate: number
  active_modules: { name: string; pv: number; uv: number }[]
  knowledge_growth: { week_new: number; pending_audit: number; hr_coverage: number }
  transform_rate: { month3: number; month6: number; month12: number }
}

export function getDashboardStats() {
  return apiGet<DashboardStats>('/admin/monitor/dashboard')
}

export interface ServiceHealthItem {
  name: string
  status: 'healthy' | 'degraded' | 'down'
  heartbeat_at: string
  api_p50_ms: number
  api_p95_ms: number
  api_p99_ms: number
  error_rate: number
}

export function getServiceHealth() {
  return apiGet<ServiceHealthItem[]>('/admin/monitor/health')
}

export interface StorageStats {
  total_gb: number
  used_gb: number
  compression_rate: number
  top_users: { user_id: string; nickname: string; used_gb: number }[]
}

export function getStorageStats() {
  return apiGet<StorageStats>('/admin/monitor/storage')
}

export interface TokenStats {
  total_tokens: number
  total_cost: number
  by_module: { module: string; tokens: number; cost: number }[]
  top_users: { user_id: string; nickname: string; tokens: number }[]
  trend: { date: string; tokens: number }[]
}

export function getTokenStats() {
  return apiGet<TokenStats>('/admin/monitor/token')
}

export interface AlertItem {
  id: string
  type: string
  level: 'critical' | 'warning' | 'info'
  message: string
  status: 'open' | 'processing' | 'resolved'
  created_at: string
}

export function getAlerts(params?: Record<string, string>) {
  return apiGet<PageResponse<AlertItem>>('/admin/monitor/alerts', params)
}

/* ─────── 消息推送 API ─────── */

export interface PushTemplate {
  id: string
  category: string // positive | negative | greeting | system
  title: string
  content: string
  trigger_condition: string
  is_active: boolean
}

export function getPushTemplates(params?: Record<string, string>) {
  return apiGet<PushTemplate[]>('/admin/push/templates', params)
}
export function updatePushTemplate(id: string, data: Partial<PushTemplate>) {
  return apiPatch(`/admin/push/templates/${id}`, data)
}

export interface PushQuota {
  weekly_limit: number
  time_start: string // HH:mm
  time_end: string
  night_block: boolean
  sms_block: boolean
  new_user_protect_days: number
}

export function getPushQuota() {
  return apiGet<PushQuota>('/admin/push/quota')
}
export function updatePushQuota(data: Partial<PushQuota>) {
  return apiPatch('/admin/push/quota', data)
}

export interface PushNotice {
  id: string
  title: string
  content: string
  status: 'draft' | 'published' | 'expired'
  target: 'all' | 'vip' | 'custom'
  created_at: string
}

export function getPushNotices(params?: Record<string, string>) {
  return apiGet<PageResponse<PushNotice>>('/admin/push/notices', params)
}
export function createPushNotice(data: Partial<PushNotice>) {
  return apiPost('/admin/push/notices', data)
}
export function publishPushNotice(id: string) {
  return apiPost(`/admin/push/notices/${id}/publish`)
}

export interface PushLogItem {
  id: string
  user_id: string
  title: string
  channel: string
  status: string
  open_rate: number | null
  created_at: string
  blocked_reason?: string
}

export function getPushLogs(params?: Record<string, string>) {
  return apiGet<PageResponse<PushLogItem>>('/admin/push/logs', params)
}

/* ─────── 安全监控 API ─────── */

export interface CrisisEvent {
  id: string
  triggered_at: string
  response_time_s: number
  handled_by: string
  severity: string
  trend: { date: string; count: number }[]
}

export function getCrisisEvents(params?: Record<string, string>) {
  return apiGet<PageResponse<CrisisEvent>>('/admin/security/crisis', params)
}

export interface EmotionAlert {
  id: string
  score_drop: number
  consecutive_days: number
  alerted_at: string
  operator_action: string
}

export function getEmotionAlerts(params?: Record<string, string>) {
  return apiGet<PageResponse<EmotionAlert>>('/admin/security/emotion', params)
}

export interface ViolationItem {
  id: string
  type: string
  created_at: string
  status: string
}

export function getViolations(params?: Record<string, string>) {
  return apiGet<PageResponse<ViolationItem>>('/admin/security/violations', params)
}

export interface InactiveUser {
  user_id: string
  inactive_days: number
  last_active_at: string
  escalation_level: string
  operator_action: string
}

export function getInactiveUsers(params?: Record<string, string>) {
  return apiGet<PageResponse<InactiveUser>>('/admin/security/inactive', params)
}

export interface PrivacyAuditItem {
  id: string
  type: string
  operator: string
  target: string
  created_at: string
}

export function getPrivacyAudits(params?: Record<string, string>) {
  return apiGet<PageResponse<PrivacyAuditItem>>('/admin/security/privacy', params)
}

/* ─────── 系统配置 API ─────── */

export interface SystemConfig {
  trial_days: number
  vip_plans: VipPlan[]
  coach_session_limit: number
}

export function getSystemConfig() {
  return apiGet<SystemConfig>('/admin/settings/params')
}
export function updateSystemConfig(data: Partial<SystemConfig>) {
  return apiPatch('/admin/settings/params', data)
}

export interface FeatureFlag {
  module_slug: string
  name: string
  enabled: boolean
  version: string
}

export function getFeatureFlags() {
  return apiGet<FeatureFlag[]>('/admin/settings/flags')
}
export function updateFeatureFlag(slug: string, data: Partial<FeatureFlag>) {
  return apiPatch(`/admin/settings/flags/${slug}`, data)
}

export interface HrModule {
  id: string
  name: string
  sort_order: number
  is_active: boolean
}

export function getHrModules() {
  return apiGet<HrModule[]>('/admin/settings/hr-modules')
}
export function saveHrModules(data: HrModule[]) {
  return apiPut('/admin/settings/hr-modules', data)
}

export interface AbsQuestion {
  id: string
  dimension: string
  question: string
  type: 'single' | 'multiple' | 'scale' | 'text'
  options: string[]
  sort_order: number
}

export function getAbsQuestions() {
  return apiGet<AbsQuestion[]>('/admin/settings/abs')
}
export function saveAbsQuestion(data: Partial<AbsQuestion>) {
  return data.id
    ? apiPatch(`/admin/settings/abs/${data.id}`, data)
    : apiPost('/admin/settings/abs', data)
}
export function deleteAbsQuestion(id: string) {
  return apiDelete(`/admin/settings/abs/${id}`)
}

// 缺少的 apiPut 导入补充
function apiPut<T>(path: string, data: unknown) {
  return apiPatch<T>(path, data)
}
