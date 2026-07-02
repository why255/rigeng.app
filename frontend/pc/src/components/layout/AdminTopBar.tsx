import { useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'

/**
 * 管理后台顶部栏（50px）
 * 左：折叠按钮 + 面包屑
 * 右：全屏切换 + 主题切换 + 用户下拉
 */

interface Crumb {
  label: string
  path?: string
}

/** 路由 path → 中文名映射 */
const PATH_LABEL: Record<string, string> = {
  '/admin': '控制台',
  '/admin/users': '用户管理',
  '/admin/users/vip': 'VIP 套餐',
  '/admin/users/contribution': '贡献值配置',
  '/admin/teachers': '教师管理',
  '/admin/teachers/workload': '工作量看板',
  '/admin/teachers/matching': '匹配管理',
  '/admin/content': '内容审核',
  '/admin/content/audit': '文档审核',
  '/admin/content/xiejun': '携君库管理',
  '/admin/content/contribution': '贡献审核',
  '/admin/content/rag': 'RAG 监控',
  '/admin/monitor': '运营监控',
  '/admin/monitor/dashboard': '数据仪表盘',
  '/admin/monitor/health': '服务健康',
  '/admin/monitor/storage': '存储用量',
  '/admin/monitor/token': 'AI Token',
  '/admin/monitor/alerts': '系统告警',
  '/admin/push': '消息推送',
  '/admin/push/templates': '推送模板',
  '/admin/push/quota': '频控配置',
  '/admin/push/notices': '系统公告',
  '/admin/push/logs': '推送日志',
  '/admin/security': '安全监控',
  '/admin/security/crisis': '危机事件',
  '/admin/security/emotion': '情绪预警',
  '/admin/security/violations': '违规追踪',
  '/admin/security/inactive': '沉默用户',
  '/admin/security/privacy': '隐私审计',
  '/admin/settings': '系统配置',
  '/admin/settings/params': '参数配置',
  '/admin/settings/flags': '功能开关',
  '/admin/settings/brand': '品牌配置',
  '/admin/settings/hr-modules': 'HR 模块',
  '/admin/settings/abs': 'ABS 问卷',
  '/admin/audit': '审计日志',
  '/teacher': '工作台',
  '/teacher/students': '我的学员',
  '/teacher/appointments': '辅导预约',
  '/teacher/intelligence': '情报采集',
  '/teacher/collaboration': '项目协作',
  '/teacher/performance': '个人绩效',
}

function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean)
  const crumbs: Crumb[] = []
  let accumulated = ''
  for (const seg of segments) {
    accumulated += '/' + seg
    const label = PATH_LABEL[accumulated]
    if (label) {
      crumbs.push({ label, path: accumulated })
    }
  }
  if (crumbs.length === 0 && pathname !== '/') {
    crumbs.push({ label: pathname })
  }
  return crumbs
}

function getUserInfo() {
  try {
    const u = JSON.parse(localStorage.getItem('rg_user') || '{}')
    return { nickname: u.nickname || '管理员', avatar: u.avatar || '', role: u.role || '' }
  } catch { return { nickname: '管理员', avatar: '', role: '' } }
}

const ROLE_LABELS: Record<string, string> = {
  superadmin: '超级管理员',
  operator: '运营管理员',
  teacher: '老师',
  project_manager: '项目负责人',
}

export function AdminTopBar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const crumbs = buildCrumbs(location.pathname)
  const user = getUserInfo()
  const [menuOpen, setMenuOpen] = useState(false)
  const [dark, setDark] = useState(() => document.documentElement.getAttribute('data-theme') === 'dark')

  const toggleTheme = useCallback(() => {
    const next = !dark
    setDark(next)
    document.documentElement.setAttribute('data-theme', next ? 'dark' : '')
    localStorage.setItem('rg_admin_theme', next ? 'dark' : 'light')
  }, [dark])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }, [])

  const handleLogout = useCallback(() => {
    localStorage.removeItem('rg_token')
    localStorage.removeItem('rg_user')
    navigate('/login', { replace: true })
  }, [navigate])

  return (
    <header className="adm-topbar">
      <div className="adm-topbar__left">
        {/* 折叠按钮 */}
        <button className="adm-topbar__fold" onClick={onToggle} title={collapsed ? '展开菜单' : '折叠菜单'}>
          <Icon icon={collapsed ? 'mingcute:indent-increase-line' : 'mingcute:indent-decrease-line'} width={20} />
        </button>

        {/* 面包屑 */}
        <nav className="adm-topbar__breadcrumb">
          {crumbs.map((c, i) => (
            <span key={c.path || i}>
              {i > 0 && <span className="adm-topbar__breadcrumb-sep">/</span>}
              {c.path ? (
                <button className="adm-topbar__breadcrumb-item" onClick={() => navigate(c.path!)}>
                  {c.label}
                </button>
              ) : (
                <span className="adm-topbar__breadcrumb-current">{c.label}</span>
              )}
            </span>
          ))}
        </nav>
      </div>

      <div className="adm-topbar__right">
        {/* 全屏切换 */}
        <button className="adm-topbar__icon-btn" onClick={toggleFullscreen} title="全屏">
          <Icon icon="mingcute:fullscreen-line" width={18} />
        </button>

        {/* 主题切换 */}
        <button className="adm-topbar__icon-btn" onClick={toggleTheme} title={dark ? '浅色模式' : '深色模式'}>
          <Icon icon={dark ? 'mingcute:sun-line' : 'mingcute:moon-line'} width={18} />
        </button>

        {/* 用户下拉 */}
        <div className="adm-topbar__user" onClick={() => setMenuOpen(!menuOpen)}>
          <div className="adm-topbar__user-avatar">
            {user.avatar ? (
              <img src={user.avatar} alt="" />
            ) : (
              <span>{user.nickname.charAt(0)}</span>
            )}
          </div>
          <span className="adm-topbar__user-name">{user.nickname}</span>
          <span className="adm-topbar__user-role">{ROLE_LABELS[user.role] || user.role}</span>
          <Icon icon="mingcute:down-line" width={14} />

          {menuOpen && (
            <>
              <div className="adm-topbar__user-overlay" onClick={(e) => { e.stopPropagation(); setMenuOpen(false) }} />
              <div className="adm-topbar__user-menu">
                <button onClick={() => { setMenuOpen(false); navigate('/admin') }}>控制台</button>
                <button onClick={handleLogout}>退出登录</button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
