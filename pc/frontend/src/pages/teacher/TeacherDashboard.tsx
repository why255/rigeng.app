import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Icon } from '@iconify/react'
import './admin.css'

function getMyRole(): string {
  try { return JSON.parse(localStorage.getItem('rg_user') || '{}').role || '' } catch { return '' }
}

export function TeacherDashboard() {
  const navigate = useNavigate()
  const [stats] = useState({
    pending_appointments: 3,
    student_count: 12,
    today_hours: 2.5,
    rating: 4.8,
    success_rate: 85,
  })

  useEffect(() => {
    if (getMyRole() !== 'teacher') { navigate('/', { replace: true }); return }
  }, [navigate])

  const shortcuts = [
    { path: '/teacher/students', icon: 'mingcute:user-heart-line', label: '我的学员', color: '#8B4513' },
    { path: '/teacher/appointments', icon: 'mingcute:calendar-check-line', label: '辅导预约', color: '#C03A39' },
    { path: '/teacher/intelligence', icon: 'mingcute:search-line', label: '情报采集', color: '#1976D2' },
    { path: '/teacher/collaboration', icon: 'mingcute:rocket-line', label: '项目协作', color: '#4CAF50' },
  ]

  return (
          <div className="adm-page">
        <h2>老师工作台</h2>
        <p style={{ color: 'var(--color-neutral-500)', marginTop: -8, marginBottom: 24 }}>
          欢迎回来！今天也是帮助学员成长的一天。
        </p>

        {/* 指标卡片 */}
        <div className="adm-stats">
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">待处理预约</div>
            <div className="adm-stat-card__value" style={{ color: stats.pending_appointments > 0 ? 'var(--color-error)' : undefined }}>
              {stats.pending_appointments}
            </div>
          </div>
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">学员数</div>
            <div className="adm-stat-card__value">{stats.student_count}</div>
          </div>
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">今日辅导时长</div>
            <div className="adm-stat-card__value">{stats.today_hours}h</div>
          </div>
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">综合评分</div>
            <div className="adm-stat-card__value">{stats.rating} ⭐</div>
          </div>
        </div>

        {/* 快捷入口 */}
        <div className="adm-panel">
          <div className="adm-panel__header">
            <span className="adm-panel__title">快捷入口</span>
          </div>
          <div className="adm-panel__body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
              {shortcuts.map((s) => (
                <Link key={s.path} to={s.path}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    padding: '20px 12px', borderRadius: 12, border: '1px solid var(--color-neutral-100)',
                    textDecoration: 'none', transition: 'all 0.2s',
                    background: 'var(--color-brand-white)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = s.color; e.currentTarget.style.boxShadow = `0 4px 16px ${s.color}15` }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-neutral-100)'; e.currentTarget.style.boxShadow = 'none' }}
                >
                  <Icon icon={s.icon} width={32} style={{ color: s.color }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-neutral-700)' }}>{s.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
  )
}
