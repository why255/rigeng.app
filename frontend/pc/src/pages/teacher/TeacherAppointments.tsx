import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'
import './admin.css'

function getMyRole(): string {
  try { return JSON.parse(localStorage.getItem('rg_user') || '{}').role || '' } catch { return '' }
}

const MOCK_APPOINTMENTS = Array.from({ length: 8 }, (_, i) => ({
  id: `apt-${i + 1}`,
  student: `学员${i + 1}`,
  type: i < 3 ? '视频辅导' : '文字咨询',
  status: (['pending', 'pending', 'confirmed', 'confirmed', 'completed', 'completed', 'pending', 'completed'] as const)[i],
  requested_at: new Date(2026, 5, 30 - i).toISOString().split('T')[0],
  meeting_time: i < 3 ? new Date(2026, 6, 1 + i, 10 + i, 0).toISOString() : undefined,
}))

export function TeacherAppointments() {
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState(MOCK_APPOINTMENTS)

  useEffect(() => {
    if (getMyRole() !== 'teacher') { navigate('/', { replace: true }); return }
  }, [navigate])

  const handleConfirm = (id: string) => {
    setAppointments((prev) => prev.map((a) => a.id === id ? { ...a, status: 'confirmed' as const } : a))
  }

  const handleReject = (id: string) => {
    if (!window.confirm('确定拒绝此预约？')) return
    setAppointments((prev) => prev.filter((a) => a.id !== id))
  }

  const pending = appointments.filter((a) => a.status === 'pending')

  return (
          <div className="adm-page">
        <h2>辅导预约管理</h2>

        {pending.length > 0 && (
          <div className="adm-panel" style={{ borderLeft: '4px solid var(--color-warning)', marginBottom: 24 }}>
            <div className="adm-panel__header">
              <span className="adm-panel__title">待处理预约</span>
              <span className="adm-tag adm-tag--pending">{pending.length} 条待处理</span>
            </div>
            <div className="adm-panel__body">
              {pending.map((a) => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-neutral-50)' }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{a.student}</span>
                    <span className="adm-tag adm-tag--primary" style={{ marginLeft: 8 }}>{a.type}</span>
                    <span style={{ fontSize: 13, color: 'var(--color-neutral-500)', marginLeft: 8 }}>{a.requested_at}</span>
                  </div>
                  <div className="adm-actions">
                    <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={() => handleConfirm(a.id)}>
                      <Icon icon="mingcute:check-line" width={14} /> 确认
                    </button>
                    <button className="adm-btn adm-btn--danger adm-btn--sm" onClick={() => handleReject(a.id)}>
                      <Icon icon="mingcute:close-line" width={14} /> 拒绝
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 全部预约列表 */}
        <div className="adm-panel" style={{ overflow: 'hidden' }}>
          <div className="adm-panel__header">
            <span className="adm-panel__title">全部预约记录</span>
          </div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>学员</th>
                  <th>类型</th>
                  <th>状态</th>
                  <th>请求时间</th>
                  <th>辅导时间</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{a.student}</td>
                    <td><span className="adm-tag adm-tag--primary">{a.type}</span></td>
                    <td>
                      <span className={`adm-tag ${a.status === 'pending' ? 'adm-tag--pending' : a.status === 'confirmed' ? 'adm-tag--advance' : 'adm-tag--active'}`}>
                        {{ pending: '待处理', confirmed: '已确认', completed: '已完成' }[a.status]}
                      </span>
                    </td>
                    <td>{a.requested_at}</td>
                    <td>{a.meeting_time ? new Date(a.meeting_time).toLocaleString('zh-CN') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
  )
}
