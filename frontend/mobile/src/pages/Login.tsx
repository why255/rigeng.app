import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login } from '@rigeng/shared/api/auth'

/**
 * 移动端 H5 登录页面。
 * 手机号 + 密码登录，底部提供注册入口。
 *
 * 登录成功 → 自动跳转至 /（ProtectedRoute 内 / → /b/board1 小耕对话）。
 */
export function Login() {
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  /** 登录后默认跳转路径（移动端：/ → /b/board1 小耕对话） */
  const DEFAULT_REDIRECT = '/'

  async function handleSubmit() {
    setError('')

    if (!phone.trim() || !password.trim()) {
      setError('请填写手机号和密码')
      return
    }

    setLoading(true)
    try {
      await login(phone.trim(), password)
      navigate(DEFAULT_REDIRECT, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请重试')
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
          <p className="pg-login__slogan">欢迎回来，登录你的日耕账户</p>
        </div>

        {/* 表单 */}
        <div className="pg-login__form">
          {error && (
            <div className="pg-login__error">
              {error}
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
            <label className="pg-login__label">密码</label>
            <input
              className="pg-login__input"
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            className="pg-login__btn"
            disabled={loading}
            onClick={handleSubmit}
          >
            {loading ? '登录中...' : '登 录'}
          </button>
        </div>

        {/* 注册入口 */}
        <div className="pg-login__toggle">
          <span className="pg-login__toggle-text">还没有账号？</span>
          <Link className="pg-login__toggle-btn" to="/register">立即注册</Link>
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
