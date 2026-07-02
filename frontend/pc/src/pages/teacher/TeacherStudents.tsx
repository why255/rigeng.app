import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'
import './admin.css'

interface Student {
  user_id: string
  nickname: string
  phone: string
  vip_level: string
  last_active: string
  modules_used: number
  progress: string
}

const MOCK_STUDENTS: Student[] = Array.from({ length: 12 }, (_, i) => ({
  user_id: `stu-${i + 1}`,
  nickname: `学员${i + 1}`,
  phone: `138****${String(i).padStart(4, '0')}`,
  vip_level: ['trial', 'primary', 'medium', 'advanced'][i % 4],
  last_active: new Date(2026, 5, 30 - Math.floor(i / 2)).toISOString().split('T')[0],
  modules_used: Math.round(3 + Math.random() * 10),
  progress: ['拿下一个客户-洽谈中', '打磨产品-方案阶段', '交付订单-进行中', '品牌打造-建立中'][i % 4],
}))

function getMyRole(): string {
  try { return JSON.parse(localStorage.getItem('rg_user') || '{}').role || '' } catch { return '' }
}

export function TeacherStudents() {
  const navigate = useNavigate()

  useEffect(() => {
    if (getMyRole() !== 'teacher') { navigate('/', { replace: true }); return }
  }, [navigate])

  return (
          <div className="adm-page">
        <h2>我的学员</h2>

        <div className="adm-stats">
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">学员总数</div>
            <div className="adm-stat-card__value">{MOCK_STUDENTS.length}</div>
          </div>
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">活跃学员（7日内）</div>
            <div className="adm-stat-card__value">{MOCK_STUDENTS.filter((s) => {
              const d = new Date(s.last_active)
              return (Date.now() - d.getTime()) < 7 * 86400000
            }).length}</div>
          </div>
        </div>

        <div className="adm-panel" style={{ overflow: 'hidden' }}>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>昵称</th>
                  <th>手机号</th>
                  <th>VIP</th>
                  <th>最近活跃</th>
                  <th>使用模块</th>
                  <th>当前进展</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_STUDENTS.map((s) => (
                  <tr key={s.user_id}>
                    <td style={{ fontWeight: 600 }}>{s.nickname}</td>
                    <td>{s.phone}</td>
                    <td>
                      <span className={`adm-tag ${s.vip_level === 'trial' ? 'adm-tag--trial' : 'adm-tag--primary'}`}>
                        {{ trial: '试用', primary: '初级', medium: '中级', advanced: '高级' }[s.vip_level]}
                      </span>
                    </td>
                    <td>{s.last_active}</td>
                    <td>{s.modules_used} / 13</td>
                    <td><span className="adm-tag adm-tag--advance">{s.progress}</span></td>
                    <td>
                      <button className="adm-btn adm-btn--outline adm-btn--sm">
                        <Icon icon="mingcute:eye-line" width={14} /> 详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
  )
}
