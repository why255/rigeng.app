import { useState, useRef, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { register } from '@rigeng/shared/api/auth'

/**
 * PC 端注册页面。
 * 手机号 + 验证码 + 密码 + 确认密码，验证码为前端模拟（控制台可见）。
 */
export function Register() {
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // 验证码相关
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
    if (!phone.trim()) {
      setError('请先输入手机号')
      return
    }
    setError('')
    // 生成6位随机验证码并打印到控制台
    const randomCode = String(Math.floor(100000 + Math.random() * 900000))
    setGeneratedCode(randomCode)
    console.log(`[日耕] 验证码：${randomCode}（有效期60秒）`)
    startCountdown()
  }

  async function handleSubmit() {
    setError('')
    setSuccess('')

    if (!phone.trim()) {
      setError('请填写手机号')
      return
    }
    if (!generatedCode) {
      setError('请先获取验证码')
      return
    }
    if (!code.trim()) {
      setError('请填写验证码')
      return
    }
    if (code.trim() !== generatedCode) {
      setError('验证码错误')
      return
    }
    if (!password.trim()) {
      setError('请填写密码')
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
      await register(phone.trim(), password, phone.trim())
      setSuccess('注册成功！即将跳转登录页...')
      setTimeout(() => navigate('/login', { replace: true }), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="pg-login-page">
      <div className="pg-login-card">
        {/* 品牌标识 */}
        <div className="pg-login__brand">
          <h1 className="pg-login__title">日耕</h1>
          <p className="pg-login__slogan">日耕朝夕，耕愈工作，耕暖生活</p>
        </div>

        {/* 表单 */}
        <div className="pg-login__form">
          {error && (
            <div className="pg-login__error">
              {error}
            </div>
          )}
          {success && (
            <div className="pg-login__error pg-login__error--success">
              {success}
            </div>
          )}

          <div className="pg-login__field">
            <label className="pg-login__label">手机号</label>
            <input
              className="pg-login__input"
              type="text"
              placeholder="请输入手机号"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="pg-login__field">
            <label className="pg-login__label">验证码</label>
            <div className="pg-login__code-row">
              <input
                className="pg-login__input pg-login__code-input"
                type="text"
                placeholder="请输入验证码"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <button
                className="pg-login__code-btn"
                type="button"
                disabled={countdown > 0}
                onClick={handleGetCode}
              >
                {countdown > 0 ? `${countdown}s` : '获取验证码'}
              </button>
            </div>
          </div>

          <div className="pg-login__field">
            <label className="pg-login__label">密码</label>
            <input
              className="pg-login__input"
              type="password"
              placeholder="请设置密码（至少6位）"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="pg-login__field">
            <label className="pg-login__label">确认密码</label>
            <input
              className="pg-login__input"
              type="password"
              placeholder="请再次输入密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <button
            className="pg-login__btn"
            disabled={loading}
            onClick={handleSubmit}
          >
            {loading ? '注册中...' : '注 册'}
          </button>
        </div>

        {/* 登录入口 */}
        <div className="pg-login__toggle">
          <span className="pg-login__toggle-text">已有账号？</span>
          <Link className="pg-login__toggle-btn" to="/login">去登录</Link>
        </div>
      </div>

      {/* 底部提示 */}
      <div className="pg-login__footer">
        <p>注册即表示同意服务条款</p>
        <p>7天全功能免费试用</p>
      </div>
    </div>
  )
}
