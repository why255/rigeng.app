/**
 * 管理后台 API 封装。
 * 全部接口需要 superadmin 角色。
 */
import { apiGet, apiPost, apiPatch, apiDelete } from './api'

export interface AdminUserItem {
  user_id: string
  phone: string
  nickname: string | null
  role: string
  vip_level: string
  status: string
  trial_expire_at: string | null
  created_at: string
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
