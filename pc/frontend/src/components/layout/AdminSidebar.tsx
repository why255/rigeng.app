import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Icon } from '@iconify/react'

/**
 * 管理后台侧边栏 — 4 板块 × 9 大模块菜单
 * 支持折叠动画 + 按角色动态过滤
 */

/* ─────── 类型定义 ─────── */
interface SubMenuItem {
  label: string
  path: string
  icon: string
  roles: string[] // 空 = 所有角色可见
}

interface MenuGroup {
  label: string
  icon: string
  roles: string[]
  children: SubMenuItem[]
}

type Role = 'superadmin' | 'operator' | 'teacher' | 'project_manager'

/* ─────── 角色判断 ─────── */
function getUser(): { role: Role; nickname: string } {
  try {
    const u = JSON.parse(localStorage.getItem('rg_user') || '{}')
    return { role: u.role || 'student', nickname: u.nickname || '管理员' }
  } catch { return { role: 'student' as Role, nickname: '管理员' } }
}

function canSee(roles: string[], userRole: Role): boolean {
  if (roles.length === 0) return true
  return roles.includes(userRole)
}

/* ─────── 菜单配置 ─────── */
const ADMIN_MENUS: MenuGroup[] = [
  // ── 板块一：核心管理 ──
  {
    label: '核心管理', icon: 'mingcute:user-setting-line',
    roles: ['superadmin', 'operator'],
    children: [
      { label: '控制台', path: '/admin', icon: 'mingcute:dashboard-line', roles: ['superadmin', 'operator'] },
      { label: '用户管理', path: '/admin/users', icon: 'mingcute:user-4-line', roles: ['superadmin', 'operator'] },
      { label: 'VIP 套餐', path: '/admin/users/vip', icon: 'mingcute:vip-line', roles: ['superadmin'] },
      { label: '贡献值配置', path: '/admin/users/contribution', icon: 'mingcute:coin-line', roles: ['superadmin'] },
    ],
  },
  // ── 板块二：教师管理 ──
  {
    label: '教师管理', icon: 'mingcute:group-line',
    roles: ['superadmin', 'operator'],
    children: [
      { label: '教师列表', path: '/admin/teachers', icon: 'mingcute:idcard-line', roles: ['superadmin', 'operator'] },
      { label: '工作量看板', path: '/admin/teachers/workload', icon: 'mingcute:chart-bar-line', roles: ['superadmin', 'operator'] },
      { label: '匹配管理', path: '/admin/teachers/matching', icon: 'mingcute:user-connection-line', roles: ['superadmin', 'operator', 'project_manager'] },
    ],
  },
  // ── 板块三：内容审核 ──
  {
    label: '内容审核', icon: 'mingcute:document-line',
    roles: ['superadmin', 'operator'],
    children: [
      { label: '文档审核队列', path: '/admin/content/audit', icon: 'mingcute:task-line', roles: ['superadmin', 'operator'] },
      { label: '携君库管理', path: '/admin/content/xiejun', icon: 'mingcute:book-6-line', roles: ['superadmin', 'operator'] },
      { label: '贡献审核', path: '/admin/content/contribution', icon: 'mingcute:heart-line', roles: ['superadmin', 'operator'] },
      { label: 'RAG 质量监控', path: '/admin/content/rag', icon: 'mingcute:radar-line', roles: ['superadmin', 'operator'] },
    ],
  },
  // ── 板块四：运营监控 ──
  {
    label: '运营监控', icon: 'mingcute:chart-pie-line',
    roles: ['superadmin', 'operator', 'project_manager'],
    children: [
      { label: '数据仪表盘', path: '/admin/monitor/dashboard', icon: 'mingcute:chart-line', roles: ['superadmin', 'operator', 'project_manager'] },
      { label: '服务健康', path: '/admin/monitor/health', icon: 'mingcute:pulse-line', roles: ['superadmin'] },
      { label: '存储用量', path: '/admin/monitor/storage', icon: 'mingcute:server-line', roles: ['superadmin', 'operator'] },
      { label: 'AI Token', path: '/admin/monitor/token', icon: 'mingcute:code-line', roles: ['superadmin', 'operator'] },
      { label: '系统告警', path: '/admin/monitor/alerts', icon: 'mingcute:alert-line', roles: ['superadmin', 'operator', 'project_manager'] },
    ],
  },
  // ── 板块五：消息推送 ──
  {
    label: '消息推送', icon: 'mingcute:notification-line',
    roles: ['superadmin', 'operator'],
    children: [
      { label: '推送模板', path: '/admin/push/templates', icon: 'mingcute:file-code-line', roles: ['superadmin'] },
      { label: '频控配置', path: '/admin/push/quota', icon: 'mingcute:settings-3-line', roles: ['superadmin'] },
      { label: '系统公告', path: '/admin/push/notices', icon: 'mingcute:announcement-line', roles: ['superadmin', 'operator'] },
      { label: '推送日志', path: '/admin/push/logs', icon: 'mingcute:history-line', roles: ['superadmin', 'operator'] },
    ],
  },
  // ── 板块六：安全监控 ──
  {
    label: '安全监控', icon: 'mingcute:safe-lock-line',
    roles: ['superadmin', 'operator'],
    children: [
      { label: '危机事件', path: '/admin/security/crisis', icon: 'mingcute:warning-line', roles: ['superadmin'] },
      { label: '情绪预警', path: '/admin/security/emotion', icon: 'mingcute:heart-pulse-line', roles: ['superadmin', 'operator'] },
      { label: '违规追踪', path: '/admin/security/violations', icon: 'mingcute:shield-line', roles: ['superadmin', 'operator'] },
      { label: '沉默用户', path: '/admin/security/inactive', icon: 'mingcute:sleep-line', roles: ['superadmin', 'operator'] },
      { label: '隐私审计', path: '/admin/security/privacy', icon: 'mingcute:eye-close-line', roles: ['superadmin'] },
    ],
  },
  // ── 板块七：系统配置 ──
  {
    label: '系统配置', icon: 'mingcute:settings-4-line',
    roles: ['superadmin'],
    children: [
      { label: '参数配置', path: '/admin/settings/params', icon: 'mingcute:sliders-line', roles: ['superadmin'] },
      { label: '功能开关', path: '/admin/settings/flags', icon: 'mingcute:toggle-line', roles: ['superadmin'] },
      { label: '品牌配置', path: '/admin/settings/brand', icon: 'mingcute:palette-line', roles: ['superadmin'] },
      { label: 'HR 模块', path: '/admin/settings/hr-modules', icon: 'mingcute:layout-line', roles: ['superadmin'] },
      { label: 'ABS 问卷', path: '/admin/settings/abs', icon: 'mingcute:survey-line', roles: ['superadmin'] },
      { label: '算法管理', path: '/admin/settings/algorithm', icon: 'mingcute:code-line', roles: ['superadmin'] },
      { label: '模型降级', path: '/admin/settings/model-degradation', icon: 'mingcute:robot-line', roles: ['superadmin'] },
    ],
  },
  // ── 板块八：审计日志 ──
  {
    label: '审计日志', icon: 'mingcute:clipboard-line',
    roles: ['superadmin'],
    children: [
      { label: '操作日志', path: '/admin/audit', icon: 'mingcute:list-check-line', roles: ['superadmin'] },
    ],
  },
]

/** 老师专属菜单 */
const TEACHER_MENUS: MenuGroup[] = [
  {
    label: '老师工作台', icon: 'mingcute:briefcase-line',
    roles: ['teacher'],
    children: [
      { label: '工作台首页', path: '/teacher', icon: 'mingcute:home-4-line', roles: ['teacher'] },
      { label: '我的学员', path: '/teacher/students', icon: 'mingcute:user-heart-line', roles: ['teacher'] },
      { label: '辅导预约', path: '/teacher/appointments', icon: 'mingcute:calendar-check-line', roles: ['teacher'] },
      { label: '情报采集', path: '/teacher/intelligence', icon: 'mingcute:search-line', roles: ['teacher'] },
      { label: '项目协作', path: '/teacher/collaboration', icon: 'mingcute:rocket-line', roles: ['teacher'] },
      { label: '个人绩效', path: '/teacher/performance', icon: 'mingcute:chart-line', roles: ['teacher'] },
    ],
  },
]

/* ─────── 组件 ─────── */

export function AdminSidebar({ collapsed }: { collapsed: boolean }) {
  const location = useLocation()
  const user = getUser()
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(ADMIN_MENUS.map((g) => g.label))
  )

  const menus = user.role === 'teacher' ? TEACHER_MENUS : ADMIN_MENUS

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  const visibleMenus = menus.filter((g) => canSee(g.roles, user.role))

  return (
    <aside className={`adm-sidebar${collapsed ? ' adm-sidebar--collapsed' : ''}`}>
      {/* Logo */}
      <div className="adm-sidebar__brand">
        <div className="adm-sidebar__brand-logo">
          <span>耕</span>
        </div>
        {!collapsed && (
          <div className="adm-sidebar__brand-text">
            <span className="adm-sidebar__brand-name">日耕后台</span>
            <span className="adm-sidebar__brand-sub">Admin Console</span>
          </div>
        )}
      </div>

      {/* 菜单组 */}
      <nav className="adm-sidebar__nav">
        {visibleMenus.map((group) => {
          const expanded = expandedGroups.has(group.label)
          const visibleChildren = group.children.filter((c) => canSee(c.roles, user.role))
          if (visibleChildren.length === 0) return null

          return (
            <div key={group.label} className="adm-sidebar__group">
              {/* 组标题 */}
              <button
                className="adm-sidebar__group-title"
                onClick={() => toggleGroup(group.label)}
              >
                <Icon icon={group.icon} width={18} />
                {!collapsed && (
                  <>
                    <span>{group.label}</span>
                    <Icon
                      icon={expanded ? 'mingcute:up-line' : 'mingcute:down-line'}
                      width={14}
                      className="adm-sidebar__group-arrow"
                    />
                  </>
                )}
              </button>

              {/* 子菜单 */}
              {!collapsed && expanded && (
                <div className="adm-sidebar__group-items">
                  {visibleChildren.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === '/admin'}
                      className={({ isActive }) =>
                        `adm-sidebar__item${isActive ? ' adm-sidebar__item--active' : ''}`
                      }
                    >
                      <Icon icon={item.icon} width={16} />
                      <span>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* 底部版本号 */}
      {!collapsed && (
        <div className="adm-sidebar__footer">
          <span>日耕管理后台 v1.0</span>
        </div>
      )}
    </aside>
  )
}
