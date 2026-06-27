/**
 * 注册页 — 全屏独立页面（不套 AppShell）。
 * Route: /register
 *
 * 手机号 + 验证码 + 密码 + 确认密码。
 * 验证码在前端生成并打印到控制台（有效期60秒）。
 */
import { useState, useRef, useCallback, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { apiPost } from '@/api/api'
import './login.css'

interface RegisterResponse {
  user_id: string
  phone: string
}

export function Register() {
  const navigate = useNavigate()

  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // 验证码
  const [generatedCode, setGeneratedCode] = useState('')
  const [countdown, setCountdown] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startCountdown = useCallback(() => {
    setCountdown(60)
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  function handleGetCode() {
    if (countdown > 0) return
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError('请输入正确的手机号')
      return
    }
    setError('')
    const randomCode = String(Math.floor(100000 + Math.random() * 900000))
    setGeneratedCode(randomCode)
    console.log(`[日耕] 验证码：${randomCode}（有效期60秒）`)
    startCountdown()
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError('请输入正确的手机号')
      return
    }
    if (!generatedCode) {
      setError('请先获取验证码')
      return
    }
    if (code.trim() !== generatedCode) {
      setError('验证码错误')
      return
    }
    if (password.length < 6) {
      setError('密码至少6位')
      return
    }
    if (password !== confirmPassword) {
      setError('两次密码输入不一致')
      return
    }

    setLoading(true)
    try {
      await apiPost<RegisterResponse>('/auth/register', {
        phone,
        password,
        nickname: phone,
      })
      setSuccess('注册成功！即将跳转登录页…')
      setTimeout(() => navigate('/login', { replace: true }), 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : '注册失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const brandSlogan = '日耕朝夕，耕愈工作，耕暖生活'
  const brandConcept = '日耕（RiGeng）— 为不愿止步的高知职场人打造'

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

          <h2 className="rg-login__title">创建账号</h2>
          <p className="rg-login__subtitle">开启你的日耕之旅</p>

          <form className="rg-login__form" onSubmit={handleSubmit}>
            {/* 错误/成功提示 */}
            {success ? (
              <div className="rg-login__success">{success}</div>
            ) : (
              <div className="rg-login__error">{error || ' '}</div>
            )}

            {/* 手机号 */}
            <div className="rg-login__field">
              <label className="rg-login__label" htmlFor="reg-phone">手机号</label>
              <input
                id="reg-phone"
                className="rg-login__input"
                type="tel"
                maxLength={11}
                placeholder="请输入手机号"
                value={phone}
                onChange={(e) => { setPhone(e.target.value.replace(/\D/g, '')); setError('') }}
              />
            </div>

            {/* 验证码 */}
            <div className="rg-login__field">
              <label className="rg-login__label" htmlFor="reg-code">验证码</label>
              <div className="rg-login__code-row">
                <input
                  id="reg-code"
                  className="rg-login__input"
                  type="text"
                  maxLength={6}
                  placeholder="请输入验证码"
                  value={code}
                  onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError('') }}
                />
                <button
                  type="button"
                  className="rg-login__code-btn"
                  disabled={countdown > 0}
                  onClick={handleGetCode}
                  style={countdown > 0 ? { borderColor: 'var(--color-neutral-200)', color: 'var(--color-neutral-300)' } : undefined}
                >
                  {countdown > 0 ? `${countdown}s` : '获取验证码'}
                </button>
              </div>
            </div>

            {/* 密码 */}
            <div className="rg-login__field">
              <label className="rg-login__label" htmlFor="reg-password">密码</label>
              <input
                id="reg-password"
                className="rg-login__input"
                type="password"
                placeholder="请设置密码（至少6位）"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError('') }}
              />
            </div>

            {/* 确认密码 */}
            <div className="rg-login__field">
              <label className="rg-login__label" htmlFor="reg-confirm">确认密码</label>
              <input
                id="reg-confirm"
                className="rg-login__input"
                type="password"
                placeholder="请再次输入密码"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError('') }}
              />
            </div>

            {/* 提交 */}
            <button
              type="submit"
              className="rg-login__submit"
              disabled={loading}
            >
              {loading ? '注册中…' : '注册'}
            </button>
          </form>

          {/* 登录入口 */}
          <div className="rg-login__register-link">
            <span>已有账号？</span>
            <Link to="/login">去登录</Link>
          </div>

          <div className="rg-login__footer-tip">
            <p>注册即表示同意服务条款 · 7天全功能免费试用</p>
          </div>
        </div>
      </div>
    </div>
  )
}
