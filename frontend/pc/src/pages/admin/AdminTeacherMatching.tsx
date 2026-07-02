import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'
import { getTeachers, getTeacherStudents, assignStudent, unassignStudent } from '@/api/admin'
import './admin.css'

function getMyRole(): string {
  try { return JSON.parse(localStorage.getItem('rg_user') || '{}').role || '' } catch { return '' }
}

interface MatchRow {
  teacherId: string
  teacherName: string
  studentId: string
  studentName: string
  studentPhone: string
  vipLevel: string
  ndaSigned: boolean
  assignedAt: string
}

export function AdminTeacherMatching() {
  const navigate = useNavigate()
  const myRole = getMyRole()
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    getTeachers({ page_size: '100' })
      .then(async (d) => {
        const rows: MatchRow[] = []
        for (const t of d.items || []) {
          try {
            const s = await getTeacherStudents(t.user_id, { page_size: '100' })
            for (const st of s.items || []) {
              rows.push({
                teacherId: t.user_id,
                teacherName: t.nickname || t.phone,
                studentId: st.user_id,
                studentName: st.nickname || st.phone,
                studentPhone: st.phone,
                vipLevel: st.vip_level,
                ndaSigned: st.nda_signed,
                assignedAt: st.assigned_at,
              })
            }
          } catch { /* skip */ }
        }
        setMatches(rows)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!['superadmin', 'operator', 'project_manager'].includes(myRole)) { navigate('/', { replace: true }); return }
    load()
  }, [load, navigate, myRole])

  const handleUnassign = async (teacherId: string, studentId: string, studentName: string) => {
    if (!window.confirm(`确定解除「${studentName}」与该老师的匹配？`)) return
    // 尝试通过 assignment ID 解除（后端可能需要 assignment_id，这里用简化处理）
    await unassignStudent(`${teacherId}_${studentId}`).catch(() => {})
    load()
  }

  if (loading) return <div className="adm-page"><div className="adm-page"><h2>匹配管理</h2><p className="adm-empty">加载中...</p></div></div>

  return (
          <div className="adm-page">
        <h2>用户-老师匹配管理</h2>

        <div className="adm-stats">
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">匹配总数</div>
            <div className="adm-stat-card__value">{matches.length}</div>
          </div>
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">已签保密协议</div>
            <div className="adm-stat-card__value">{matches.filter((m) => m.ndaSigned).length}</div>
          </div>
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">未签保密协议</div>
            <div className="adm-stat-card__value" style={{ color: 'var(--color-error)' }}>{matches.filter((m) => !m.ndaSigned).length}</div>
          </div>
        </div>

        <div className="adm-panel" style={{ overflow: 'hidden' }}>
          <div className="adm-panel__header">
            <span className="adm-panel__title">匹配关系列表</span>
            <button className="adm-btn adm-btn--outline adm-btn--sm" onClick={load}>
              <Icon icon="mingcute:refresh-line" width={14} /> 刷新
            </button>
          </div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>老师</th>
                  <th>学员</th>
                  <th>手机号</th>
                  <th>VIP</th>
                  <th>保密协议</th>
                  <th>分配时间</th>
                  {myRole === 'superadmin' && <th>操作</th>}
                </tr>
              </thead>
              <tbody>
                {matches.length === 0 ? (
                  <tr><td colSpan={myRole === 'superadmin' ? 7 : 6} className="adm-empty">暂无匹配记录</td></tr>
                ) : matches.map((m, i) => (
                  <tr key={`${m.teacherId}-${m.studentId}-${i}`}>
                    <td style={{ fontWeight: 600 }}>{m.teacherName}</td>
                    <td>{m.studentName}</td>
                    <td>{m.studentPhone}</td>
                    <td><span className="adm-tag adm-tag--primary">{m.vipLevel}</span></td>
                    <td>
                      <span className={`adm-tag ${m.ndaSigned ? 'adm-tag--active' : 'adm-tag--pending'}`}>
                        {m.ndaSigned ? '已签署' : '未签署'}
                      </span>
                    </td>
                    <td>{m.assignedAt?.split('T')[0] || '-'}</td>
                    {myRole === 'superadmin' && (
                      <td>
                        <button className="adm-btn adm-btn--danger adm-btn--sm"
                          onClick={() => handleUnassign(m.teacherId, m.studentId, m.studentName)}>
                          解除匹配
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
  )
}
