/**
 * 移动端 H5 登录页 — 上品牌渐变面板 + 下表单
 * Route: /login
 */
import { useState, useCallback, useEffect, type FormEvent } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { apiPost, apiGet } from '@rigeng/shared/api/api'
import './login.css'

interface LoginResponse {
  token: string
  user?: {
    user_id: string
    nickname?: string
    care_mode?: string
    voice_type?: string
  }
}

export interface LoginProps {
  defaultRedirect?: string
}

export function Login({ defaultRedirect = '/' }: LoginProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = searchParams.get('redirect') || defaultRedirect
  const [checkingAuth, setCheckingAuth] = useState(true)

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

        localStorage.setItem('rg_token', data.token)
        if (data.user) {
          localStorage.setItem('rg_user', JSON.stringify(data.user))
        }

        navigate(redirectTo, { replace: true })
      } catch (e) {
        setError(e instanceof Error ? e.message : '登录失败，请稍后重试')
      } finally {
        setLoading(false)
      }
    },
    [phone, password, redirectTo, navigate],
  )

  const brandSlogan = '日耕朝夕，耕愈工作，耕暖生活'
  const brandConcept = '— 为不愿止步的高知职场人打造'

  if (checkingAuth) {
    return (
      <div className="rg-login-mobile__loading">
        <div className="rg-login-mobile__spinner" />
      </div>
    )
  }

  return (
    <div className="rg-login-mobile">
      {/* 上部品牌区 — 棕色渐变 + 金字塔文字 */}
      <div className="rg-login-mobile__brand">
        <div className="rg-login-mobile__brand-logo">耕</div>
        <div className="rg-login-mobile__brand-name">日耕</div>
        <div className="rg-login-mobile__brand-slogan">{brandSlogan}</div>
        <div className="rg-login-mobile__brand-concept">{brandConcept}</div>
      </div>

      {/* 下部表单区 */}
      <div className="rg-login-mobile__form-panel">
        <div className="rg-login-mobile__form-card">
          <h2 className="rg-login-mobile__title">欢迎回来</h2>
          <p className="rg-login-mobile__subtitle">登录你的日耕账户，继续精进之旅</p>

          <form className="rg-login-mobile__form" onSubmit={handleSubmit}>
            <div className="rg-login-mobile__field">
              <label className="rg-login-mobile__label" htmlFor="login-phone">手机号</label>
              <input
                id="login-phone"
                className="rg-login-mobile__input"
                type="tel"
                maxLength={11}
                placeholder="请输入手机号"
                value={phone}
                onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '')); setError('') }}
              />
            </div>

            <div className="rg-login-mobile__field">
              <label className="rg-login-mobile__label" htmlFor="login-password">密码</label>
              <input
                id="login-password"
                className="rg-login-mobile__input"
                type="password"
                placeholder="请输入密码（至少6位）"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError('') }}
              />
            </div>

            <div className="rg-login-mobile__error">{error || ' '}</div>

            <button
              type="submit"
              className="rg-login-mobile__submit"
              disabled={loading}
            >
              {loading ? '登录中…' : '登录'}
            </button>
          </form>

          <div className="rg-login-mobile__register-link">
            <span>还没有账号？</span>
            <Link to="/register">立即注册</Link>
          </div>

          <div className="rg-login-mobile__footer-tip">
            <p>注册即表示同意服务条款 · 7天全功能免费试用</p>
          </div>
        </div>
      </div>
    </div>
  )
}
