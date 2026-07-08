import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUsers, getTeachers } from '@/api/admin'
import './admin.css'

function getRole(): string {
  try {
    const u = JSON.parse(localStorage.getItem('rg_user') || '{}')
    return u.role || ''
  } catch { return '' }
}

/** 管理后台首页 — 统计卡片 + 快捷入口 */
export function AdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({ total: 0, students: 0, teachers: 0, admins: 0 })

  useEffect(() => {
    if (getRole() !== 'superadmin') { navigate('/', { replace: true }); return }
    Promise.all([
      getUsers().catch(() => ({ items: [], total: 0 })),
      getTeachers().catch(() => ({ items: [], total: 0 })),
    ]).then(([users, teachers]) => {
      const items = users.items || []
      const students = items.filter((u: any) => u.role === 'student').length
      const admins = items.filter((u: any) => u.role === 'superadmin').length
      setStats({
        total: users.total || items.length,
        students,
        teachers: teachers.total || teachers.items?.length || 0,
        admins,
      })
    })
  }, [navigate])

  return (
          <div className="adm-page">
        <h2>管理后台</h2>
        <div className="adm-stats">
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">用户总数</div>
            <div className="adm-stat-card__value">{stats.total}</div>
          </div>
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">学员</div>
            <div className="adm-stat-card__value">{stats.students}</div>
          </div>
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">老师</div>
            <div className="adm-stat-card__value">{stats.teachers}</div>
          </div>
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">管理员</div>
            <div className="adm-stat-card__value">{stats.admins}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <button className="adm-btn adm-btn--primary" onClick={() => navigate('/admin/users')}>用户管理</button>
          <button className="adm-btn adm-btn--outline" onClick={() => navigate('/admin/teachers')}>老师管理</button>
        </div>
      </div>
  )
}
