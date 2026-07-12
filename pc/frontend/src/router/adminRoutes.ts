/**
 * 管理后台路由配置
 *
 * 每个路由可配置 meta.roles 限制可访问角色：
 *   superadmin | operator | teacher | project_manager
 * 空数组或不设置 = 所有已登录角色可见（仍需通过 ProtectedRoute）
 */

export interface AdminRouteMeta {
  title: string
  roles?: string[]
}

export interface AdminRouteConfig {
  path: string
  meta: AdminRouteMeta
}

/** 管理后台全部路由及角色限制 */
export const ADMIN_ROUTES: AdminRouteConfig[] = [
  // 控制台
  { path: '/admin', meta: { title: '控制台', roles: ['superadmin', 'operator'] } },

  // 用户管理
  { path: '/admin/users', meta: { title: '用户管理', roles: ['superadmin', 'operator'] } },
  { path: '/admin/users/vip', meta: { title: 'VIP 套餐', roles: ['superadmin'] } },
  { path: '/admin/users/contribution', meta: { title: '贡献值配置', roles: ['superadmin'] } },

  // 教师管理
  { path: '/admin/teachers', meta: { title: '教师管理', roles: ['superadmin', 'operator'] } },
  { path: '/admin/teachers/workload', meta: { title: '工作量看板', roles: ['superadmin', 'operator'] } },
  { path: '/admin/teachers/matching', meta: { title: '匹配管理', roles: ['superadmin', 'operator', 'project_manager'] } },

  // 内容审核
  { path: '/admin/content/audit', meta: { title: '文档审核', roles: ['superadmin', 'operator'] } },
  { path: '/admin/content/xiejun', meta: { title: '携君库管理', roles: ['superadmin', 'operator'] } },
  { path: '/admin/content/contribution', meta: { title: '贡献审核', roles: ['superadmin', 'operator'] } },
  { path: '/admin/content/rag', meta: { title: 'RAG 监控', roles: ['superadmin', 'operator'] } },

  // 运营监控
  { path: '/admin/monitor/dashboard', meta: { title: '数据仪表盘', roles: ['superadmin', 'operator', 'project_manager'] } },
  { path: '/admin/monitor/health', meta: { title: '服务健康', roles: ['superadmin'] } },
  { path: '/admin/monitor/storage', meta: { title: '存储用量', roles: ['superadmin', 'operator'] } },
  { path: '/admin/monitor/token', meta: { title: 'AI Token', roles: ['superadmin', 'operator'] } },
  { path: '/admin/monitor/alerts', meta: { title: '系统告警', roles: ['superadmin', 'operator', 'project_manager'] } },

  // 消息推送
  { path: '/admin/push/templates', meta: { title: '推送模板', roles: ['superadmin'] } },
  { path: '/admin/push/quota', meta: { title: '频控配置', roles: ['superadmin'] } },
  { path: '/admin/push/notices', meta: { title: '系统公告', roles: ['superadmin', 'operator'] } },
  { path: '/admin/push/logs', meta: { title: '推送日志', roles: ['superadmin', 'operator'] } },

  // 安全监控
  { path: '/admin/security/crisis', meta: { title: '危机事件', roles: ['superadmin'] } },
  { path: '/admin/security/emotion', meta: { title: '情绪预警', roles: ['superadmin', 'operator'] } },
  { path: '/admin/security/violations', meta: { title: '违规追踪', roles: ['superadmin', 'operator'] } },
  { path: '/admin/security/inactive', meta: { title: '沉默用户', roles: ['superadmin', 'operator'] } },
  { path: '/admin/security/privacy', meta: { title: '隐私审计', roles: ['superadmin'] } },

  // 系统配置
  { path: '/admin/settings/params', meta: { title: '参数配置', roles: ['superadmin'] } },
  { path: '/admin/settings/flags', meta: { title: '功能开关', roles: ['superadmin'] } },
  { path: '/admin/settings/brand', meta: { title: '品牌配置', roles: ['superadmin'] } },
  { path: '/admin/settings/hr-modules', meta: { title: 'HR 模块', roles: ['superadmin'] } },
  { path: '/admin/settings/abs', meta: { title: 'ABS 问卷', roles: ['superadmin'] } },
  { path: '/admin/settings/algorithm', meta: { title: '算法管理', roles: ['superadmin'] } },
  { path: '/admin/settings/model-degradation', meta: { title: '模型降级', roles: ['superadmin'] } },

  // 审计日志
  { path: '/admin/audit', meta: { title: '审计日志', roles: ['superadmin'] } },

  // 老师工作台
  { path: '/teacher', meta: { title: '工作台', roles: ['teacher'] } },
  { path: '/teacher/students', meta: { title: '我的学员', roles: ['teacher'] } },
  { path: '/teacher/appointments', meta: { title: '辅导预约', roles: ['teacher'] } },
  { path: '/teacher/intelligence', meta: { title: '情报采集', roles: ['teacher'] } },
  { path: '/teacher/collaboration', meta: { title: '项目协作', roles: ['teacher'] } },
  { path: '/teacher/performance', meta: { title: '个人绩效', roles: ['teacher'] } },
]

/**
 * 检查当前用户是否有权访问某路由
 */
export function canAccessRoute(path: string, userRole: string): boolean {
  const route = ADMIN_ROUTES.find((r) => r.path === path)
  if (!route) return true // 非管理后台路由，放行
  if (!route.meta.roles || route.meta.roles.length === 0) return true
  return route.meta.roles.includes(userRole)
}

/**
 * 获取用户的默认首页
 */
export function getHomePath(role: string): string {
  switch (role) {
    case 'teacher': return '/teacher'
    case 'superadmin':
    case 'operator':
    case 'project_manager':
      return '/admin'
    default: return '/'
  }
}
