import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '@rigeng/shared/api/auth'

/**
 * 管理后台 / 老师共用登录页。
 *
 * 登录流程：
 *   普通用户 → /login → role='user' → /
 *   管理员   → /admin/login → role='superadmin'|'operator'|'project_manager' → /admin
 *   老师     → /admin/login → role='teacher' → /teacher
 */

/** 登录后根据角色决定跳转路径 */
function getRedirectPath(role: string): string {
  switch (role) {
    case 'superadmin':
    case 'operator':
    case 'project_manager':
      return '/admin'
    case 'teacher':
      return '/teacher'
    default:
      return ''
  }
}

export function AdminLogin() {
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    setError('')

    if (!phone.trim() || !password.trim()) {
      setError('请填写手机号和密码')
      return
    }

    setLoading(true)
    try {
      await login(phone.trim(), password)
      // login() 将用户信息存入了 localStorage，从中读取角色
      const raw = localStorage.getItem('rg_user')
      const user = raw ? JSON.parse(raw) : {}
      const role = user.role || ''
      const redirect = getRedirectPath(role)

      if (!redirect) {
        setError('此账号无管理后台权限，请使用普通用户登录入口')
        return
      }

      navigate(redirect, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #2C1810 0%, #4A2C17 50%, #1A0F0A 100%)',
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    }}>
      <div style={{
        width: 400, maxWidth: '90vw',
        background: '#FFFFFF',
        borderRadius: 16,
        boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
        padding: '40px 36px',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, margin: '0 auto 12px',
            background: '#8B4513', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#FFF', fontSize: 24, fontFamily: '"ZCOOL XiaoWei", serif', fontWeight: 800 }}>耕</span>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#2D1810', margin: '0 0 4px' }}>日耕管理后台</h2>
          <p style={{ fontSize: 13, color: '#8D6E63', margin: 0 }}>Admin Console · 仅限内部人员</p>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#5D4037', marginBottom: 6 }}>
              手机号
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="请输入手机号"
              autoFocus
              style={{
                width: '100%', height: 44, padding: '0 14px',
                border: '1px solid #E0D5C5', borderRadius: 8,
                fontSize: 15, color: '#2D1810', outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#8B4513' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#E0D5C5' }}
            />
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#5D4037', marginBottom: 6 }}>
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              style={{
                width: '100%', height: 44, padding: '0 14px',
                border: '1px solid #E0D5C5', borderRadius: 8,
                fontSize: 15, color: '#2D1810', outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#8B4513' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = '#E0D5C5' }}
            />
          </div>

          {/* 错误提示 */}
          {error && (
            <div style={{
              padding: '8px 12px', marginBottom: 8,
              background: '#FFEBEE', borderRadius: 6,
              fontSize: 13, color: '#C62828',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', height: 44, marginTop: 16,
              background: loading ? '#A0522D' : '#8B4513',
              color: '#FFF', fontSize: 16, fontWeight: 600,
              border: 'none', borderRadius: 8,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
              letterSpacing: '0.05em',
            }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#A0522D' }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = '#8B4513' }}
          >
            {loading ? '登录中...' : '登 录'}
          </button>
        </form>

        {/* 底部提示 */}
        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 12, color: '#BBBBBB' }}>
          普通用户请使用 <a href="/login" style={{ color: '#8B4513', textDecoration: 'none', fontWeight: 600 }}>用户登录</a>
        </div>
      </div>
    </div>
  )
}
