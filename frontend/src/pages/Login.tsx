/**
 * 登录页 — 全屏独立页面（不套 AppShell）。
 * Route: /login
 *
 * PC 端：左侧品牌渐变面板 + 右侧手机号密码表单
 * 移动端：品牌标识在上 + 表单在下
 *
 * UA 分流跳转：
 *   - PC 设备   → /m/morning-plan（朝有规划）
 *   - 移动设备  → /（→ /b/board1 小耕对话）
 */
import { useState, useCallback, useEffect, type FormEvent } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { apiPost, apiGet } from '@/api/api'
import './login.css'

/** ── UA 检测（对齐后端 DeviceDetectMiddleware 正则） ── */

const MOBILE_UA_RE = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|webOS/i

/** 根据客户端 UA 判断是否为移动设备 */
function isMobileDevice(): boolean {
  return MOBILE_UA_RE.test(navigator.userAgent)
}

/** PC 端登录后默认跳转路径 */
const PC_DEFAULT_REDIRECT = '/m/morning-plan'

interface LoginResponse {
  token: string
  user?: {
    user_id: string
    nickname?: string
    care_mode?: string
    voice_type?: string
  }
}

export function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirect') || (
    isMobileDevice() ? '/' : PC_DEFAULT_REDIRECT
  )
  const [checkingAuth, setCheckingAuth] = useState(true)

  // 如果已有有效 token，直接跳转目标页
  useEffect(() => {
    const token = localStorage.getItem('rg_token')
    if (!token) {
      setCheckingAuth(false)
      return
    }
    apiGet('/users/me')
      .then(() => navigate(redirectTo, { replace: true }))
      .catch(() => setCheckingAuth(false))
  }, [navigate, redirectTo])

  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // ── 提交登录 ──
  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()
      setError('')
      setLoading(true)

      try {
        if (!/^1[3-9]\d{9}$/.test(phone)) {
          setError('请输入正确的手机号')
          setLoading(false)
          return
        }
        if (password.length < 6) {
          setError('密码至少6位')
          setLoading(false)
          return
        }

        const data = await apiPost<LoginResponse>('/auth/login', { phone, password })

        // 存储 token 和用户信息
        localStorage.setItem('rg_token', data.token)
        if (data.user) {
          localStorage.setItem('rg_user', JSON.stringify(data.user))
        }

        // 跳转到目标页
        navigate(redirectTo, { replace: true })
      } catch (e) {
        setError(e instanceof Error ? e.message : '登录失败，请稍后重试')
      } finally {
        setLoading(false)
      }
    },
    [phone, password, redirectTo, navigate],
  )

  const brandSlogan = '日耕相伴，有趣有料，有闲有爱'
  const brandConcept = '日耕（RiGeng）— 为不愿止步的高知职场人打造'

  if (checkingAuth) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'var(--color-brand-bg-page)',
      }}>
        <div style={{
          width: 40,
          height: 40,
          border: '3px solid var(--color-neutral-100)',
          borderTopColor: 'var(--color-brand-primary)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
      </div>
    )
  }

  return (
    <div className="rg-login">
      {/* ── 左侧品牌区（PC 可见） ── */}
      <div className="rg-login__brand">
        <div className="rg-login__brand-logo">耕</div>
        <div className="rg-login__brand-name">日耕</div>
        <div className="rg-login__brand-slogan">{brandSlogan}</div>
        <div className="rg-login__brand-concept">{brandConcept}</div>
      </div>

      {/* ── 右侧表单区 ── */}
      <div className="rg-login__form-panel">
        <div className="rg-login__form-card">
          {/* 移动端品牌标识 */}
          <div className="rg-login__mobile-brand">
            <div className="rg-login__mobile-logo">耕</div>
            <h1>日耕</h1>
            <p>{brandSlogan}</p>
          </div>

          <h2 className="rg-login__title">欢迎回来</h2>
          <p className="rg-login__subtitle">登录你的日耕账户，继续精进之旅</p>

          {/* 表单 */}
          <form className="rg-login__form" onSubmit={handleSubmit}>
            {/* 手机号 */}
            <div className="rg-login__field">
              <label className="rg-login__label" htmlFor="login-phone">手机号</label>
              <input
                id="login-phone"
                className="rg-login__input"
                type="tel"
                maxLength={11}
                placeholder="请输入手机号"
                value={phone}
                onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '')); setError('') }}
              />
            </div>

            {/* 密码 */}
            <div className="rg-login__field">
              <label className="rg-login__label" htmlFor="login-password">密码</label>
              <input
                id="login-password"
                className="rg-login__input"
                type="password"
                placeholder="请输入密码（至少6位）"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError('') }}
              />
            </div>

            {/* 错误提示 */}
            <div className="rg-login__error">{error || ' '}</div>

            {/* 提交按钮 */}
            <button
              type="submit"
              className="rg-login__submit"
              disabled={loading}
            >
              {loading ? '登录中…' : '登录'}
            </button>
          </form>

          {/* 注册入口 */}
          <div className="rg-login__register-link">
            <span>还没有账号？</span>
            <Link to="/register">立即注册</Link>
          </div>

          {/* 底部提示 */}
          <div className="rg-login__footer-tip">
            <p>注册即表示同意服务条款 · 7天全功能免费试用</p>
          </div>
        </div>
      </div>
    </div>
  )
}
