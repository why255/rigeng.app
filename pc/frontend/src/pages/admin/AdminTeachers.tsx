import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'
import {
  getTeachers, grantTeacher, revokeTeacher, getTeacherStudents,
  type AdminTeacherItem, type AdminTeacherStudent,
} from '@/api/admin'
import './admin.css'

const PAGE_SIZE = 20
const STATUS_LABELS: Record<string, string> = {
  available: '可接单',
  resting: '休息中',
  coaching: '辅导中',
}

function getMyRole(): string {
  try { return JSON.parse(localStorage.getItem('rg_user') || '{}').role || '' } catch { return '' }
}

export function AdminTeachers() {
  const navigate = useNavigate()
  const myRole = getMyRole()

  const [teachers, setTeachers] = useState<AdminTeacherItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)

  // 学员弹窗
  const [students, setStudents] = useState<AdminTeacherStudent[]>([])
  const [studentsFor, setStudentsFor] = useState<AdminTeacherItem | null>(null)
  const [studentsLoading, setStudentsLoading] = useState(false)

  const load = useCallback(() => {
    const params: Record<string, string> = { page: String(page), page_size: String(PAGE_SIZE) }
    if (statusFilter) params.service_status = statusFilter
    setLoading(true)
    getTeachers(params)
      .then((d) => { setTeachers(d.items); setTotal(d.total) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page, statusFilter])

  useEffect(() => {
    if (!['superadmin', 'operator'].includes(myRole)) { navigate('/', { replace: true }); return }
    load()
  }, [load, navigate, myRole])

  const handleGrant = async (userId: string) => {
    if (!window.confirm('确定授予该用户教师角色？')) return
    await grantTeacher(userId).catch((e) => alert(e.message))
    load()
  }

  const handleRevoke = async (userId: string, name: string) => {
    if (!window.confirm(`确定撤销「${name}」的教师角色？`)) return
    await revokeTeacher(userId).catch((e) => alert(e.message))
    load()
  }

  const viewStudents = (teacher: AdminTeacherItem) => {
    setStudentsFor(teacher)
    setStudentsLoading(true)
    getTeacherStudents(teacher.user_id)
      .then((d) => setStudents(d.items))
      .catch(() => {})
      .finally(() => setStudentsLoading(false))
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
          <div className="adm-page">
        <h2>教师管理</h2>

        {/* 筛选 */}
        <div className="adm-toolbar">
          <select className="adm-search" style={{ width: 130 }} value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}>
            <option value="">全部状态</option>
            <option value="available">可接单</option>
            <option value="resting">休息中</option>
            <option value="coaching">辅导中</option>
          </select>
          <button className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => { setPage(1); load() }}>
            <Icon icon="mingcute:refresh-line" width={14} /> 刷新
          </button>
        </div>

        {/* 表格 */}
        <div className="adm-panel" style={{ overflow: 'hidden' }}>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>姓名</th>
                  <th>手机号</th>
                  <th>擅长领域</th>
                  <th>服务状态</th>
                  <th>学员数</th>
                  <th>评分</th>
                  <th>入驻时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="adm-empty">加载中...</td></tr>
                ) : teachers.length === 0 ? (
                  <tr><td colSpan={8} className="adm-empty">暂无教师数据</td></tr>
                ) : teachers.map((t) => (
                  <tr key={t.user_id}>
                    <td style={{ fontWeight: 600 }}>{t.nickname || '-'}</td>
                    <td>{t.phone}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(t.expertise_tags || []).slice(0, 3).map((tag) => (
                          <span key={tag} className="adm-tag adm-tag--primary">{tag}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className={`adm-tag ${t.service_status === 'available' ? 'adm-tag--active' : t.service_status === 'coaching' ? 'adm-tag--advance' : 'adm-tag--pending'}`}>
                        {STATUS_LABELS[t.service_status] || t.service_status}
                      </span>
                    </td>
                    <td>{t.student_count}</td>
                    <td>{t.rating != null ? `${t.rating.toFixed(1)} ⭐` : '-'}</td>
                    <td>{t.created_at?.split('T')[0] || '-'}</td>
                    <td>
                      <div className="adm-actions">
                        <button className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => viewStudents(t)}>
                          <Icon icon="mingcute:user-heart-line" width={14} /> 学员
                        </button>
                        {myRole === 'superadmin' && (
                          <button className="adm-btn adm-btn--danger adm-btn--sm" onClick={() => handleRevoke(t.user_id, t.nickname || t.phone)}>
                            撤销
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="adm-pager">
            <span>共 {total} 条</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
              <span style={{ lineHeight: '30px' }}>{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>下一页</button>
            </div>
          </div>
        )}

        {/* 学员弹窗 */}
        {studentsFor && (
          <div className="adm-modal-overlay" onClick={() => setStudentsFor(null)}>
            <div className="adm-modal" onClick={(e) => e.stopPropagation()}>
              <h3>{studentsFor.nickname || studentsFor.phone} 的学员</h3>
              {studentsLoading ? (
                <p className="adm-empty">加载中...</p>
              ) : students.length === 0 ? (
                <p className="adm-empty">暂无学员</p>
              ) : (
                <table className="adm-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>手机号</th>
                      <th>昵称</th>
                      <th>VIP</th>
                      <th>分配时间</th>
                      <th>保密协议</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s) => (
                      <tr key={s.user_id}>
                        <td>{s.phone}</td>
                        <td>{s.nickname || '-'}</td>
                        <td><span className="adm-tag adm-tag--primary">{s.vip_level}</span></td>
                        <td>{s.assigned_at?.split('T')[0] || '-'}</td>
                        <td>
                          <span className={`adm-tag ${s.nda_signed ? 'adm-tag--active' : 'adm-tag--pending'}`}>
                            {s.nda_signed ? '已签署' : '未签署'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="adm-modal__btns">
                <button className="adm-btn adm-btn--outline" onClick={() => setStudentsFor(null)}>关闭</button>
              </div>
            </div>
          </div>
        )}
      </div>
  )
}
