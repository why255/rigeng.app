import { Navigate } from 'react-router-dom'

function getToken(): string | null {
  try {
    return localStorage.getItem('rg_token')
  } catch {
    return null
  }
}

function getUserRole(): string {
  try {
    const u = JSON.parse(localStorage.getItem('rg_user') || '{}')
    return u.role || ''
  } catch {
    return ''
  }
}

interface AdminRouteProps {
  children: React.ReactNode
  /** 允许访问的角色列表 */
  roles: string[]
  /** 登录页路径（未登录时重定向到此） */
  loginPath?: string
}

/**
 * 管理后台路由守卫。
 * - 无 token → 重定向到 loginPath（默认 /admin/login）
 * - 有 token 但角色不符合 → 渲染 403
 * - 角色匹配 → 正常渲染
 */
export function AdminRoute({ children, roles, loginPath = '/admin/login' }: AdminRouteProps) {
  const token = getToken()

  if (!token) {
    return <Navigate to={loginPath} replace />
  }

  const role = getUserRole()
  if (!roles.includes(role)) {
    return <ForbiddenPage />
  }

  return <>{children}</>
}

/** 403 无权限页面 */
function ForbiddenPage() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: '#FDF8F3', color: '#2D1810', fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    }}>
      <div style={{ fontSize: 80, fontWeight: 800, color: '#8B4513', marginBottom: 16 }}>403</div>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>无权限访问</h1>
      <p style={{ color: '#8D6E63', marginBottom: 24 }}>您的账号没有管理后台的访问权限</p>
      <a href="/" style={{ color: '#8B4513', textDecoration: 'none', fontWeight: 600 }}>返回首页</a>
    </div>
  )
}
