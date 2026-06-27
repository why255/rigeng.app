/**
 * ProtectedRoute — 路由守卫组件。
 *
 * 未认证用户重定向到 /login，认证检查期间显示加载状态。
 * 用法：<ProtectedRoute><YourPage /></ProtectedRoute>
 */
import { Navigate, useLocation } from 'react-router-dom'
import { type ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isChecking, isAuthenticated } = useAuth()
  const location = useLocation()

  // 正在检查认证状态 → 显示加载
  if (isChecking) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--color-brand-bg-page)',
        color: 'var(--color-neutral-500)',
        fontFamily: 'var(--font-family-base)',
        gap: 'var(--spacing-lg)',
      }}>
        <div style={{
          width: 40,
          height: 40,
          border: '3px solid var(--color-neutral-100)',
          borderTopColor: 'var(--color-brand-primary)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <span style={{ fontSize: 'var(--font-size-l5)' }}>验证登录状态…</span>
      </div>
    )
  }

  // 未认证 → 跳转登录页（保留来源路径便于登录后回跳）
  if (!isAuthenticated) {
    const from = location.pathname !== '/login' ? location.pathname : '/'
    return <Navigate to={`/login?redirect=${encodeURIComponent(from)}`} replace />
  }

  return <>{children}</>
}
