/**
 * 统一权限判断 Hook
 * 基于 dengji.md 角色权限矩阵
 */

import { useCallback } from 'react'

export type Role = 'superadmin' | 'operator' | 'teacher' | 'project_manager' | 'student'

/** 从 localStorage 获取当前用户角色 */
export function getUserRole(): Role {
  try {
    const u = JSON.parse(localStorage.getItem('rg_user') || '{}')
    return (u.role as Role) || 'student'
  } catch {
    return 'student'
  }
}

/** 检查是否已登录 */
export function isAuthenticated(): boolean {
  return !!localStorage.getItem('rg_token')
}

/**
 * 路由级别权限：
 * - 超级管理员：全部页面
 * - 运营管理员：用户管理(部分)、教师管理(部分)、内容审核、仪表盘(只读)、消息推送(部分)、安全监控(部分)
 * - 老师：仅老师工作台
 * - 项目负责人：仅教师匹配 + 项目维度监控
 */
export function canAccessRoute(path: string, role?: Role): boolean {
  const r = role || getUserRole()

  // 超级管理员可以访问一切
  if (r === 'superadmin') return true

  // 老师只能访问工作台
  if (r === 'teacher') return path.startsWith('/teacher')

  // 运营管理员
  if (r === 'operator') {
    const allowedPaths = [
      '/admin', '/admin/users', '/admin/users/vip',
      '/admin/teachers', '/admin/teachers/workload', '/admin/teachers/matching',
      '/admin/content', '/admin/content/audit', '/admin/content/xiejun',
      '/admin/content/contribution', '/admin/content/rag',
      '/admin/monitor/dashboard', '/admin/monitor/storage', '/admin/monitor/token',
      '/admin/monitor/alerts',
      '/admin/push/notices', '/admin/push/logs',
      '/admin/security/emotion', '/admin/security/violations',
      '/admin/security/inactive',
    ]
    return allowedPaths.some((p) => path === p || (path.startsWith(p) && path[p.length] === '/'))
  }

  // 项目负责人
  if (r === 'project_manager') {
    const allowedPaths = [
      '/admin/teachers/matching',
      '/admin/monitor/dashboard', '/admin/monitor/alerts',
    ]
    return allowedPaths.some((p) => path === p || (path.startsWith(p) && path[p.length] === '/'))
  }

  return false
}

/**
 * 操作级别权限判断
 */
export function usePermission() {
  const role = getUserRole()

  const isSuperAdmin = role === 'superadmin'
  const isOperator = role === 'operator'
  const isTeacher = role === 'teacher'
  const isProjectManager = role === 'project_manager'

  /** 是否可以管理用户（角色变更、VIP配置） */
  const canManageUsers = isSuperAdmin

  /** 是否可以管理教师（授权/撤销） */
  const canManageTeachers = isSuperAdmin

  /** 是否可以审核内容 */
  const canAuditContent = isSuperAdmin || isOperator

  /** 是否可以查看系统健康 */
  const canViewHealth = isSuperAdmin

  /** 是否可以配置推送规则 */
  const canConfigPush = isSuperAdmin

  /** 是否可以查看危机事件 */
  const canViewCrisis = isSuperAdmin

  /** 是否可以修改系统配置 */
  const canConfigSystem = isSuperAdmin

  /** 是否可以查看审计日志 */
  const canViewAuditLogs = isSuperAdmin

  const canAccess = useCallback(
    (path: string) => canAccessRoute(path, role),
    [role]
  )

  return {
    role,
    isSuperAdmin,
    isOperator,
    isTeacher,
    isProjectManager,
    canManageUsers,
    canManageTeachers,
    canAuditContent,
    canViewHealth,
    canConfigPush,
    canViewCrisis,
    canConfigSystem,
    canViewAuditLogs,
    canAccess,
  }
}
