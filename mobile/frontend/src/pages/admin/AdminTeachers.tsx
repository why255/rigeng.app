import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { getTeachers, getTeacherStudents, revokeTeacher, type AdminTeacherItem, type AdminTeacherStudent } from '@/api/admin'
import './admin.css'

const PAGE_SIZE = 20

function getRole(): string {
  try { return JSON.parse(localStorage.getItem('rg_user') || '{}').role || '' } catch { return '' }
}

/** 老师列表 + 学员弹窗 */
export function AdminTeachers() {
  const navigate = useNavigate()
  const [teachers, setTeachers] = useState<AdminTeacherItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<AdminTeacherStudent[]>([])
  const [selectedTeacher, setSelectedTeacher] = useState<AdminTeacherItem | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    getTeachers({ page: String(page), page_size: String(PAGE_SIZE) })
      .then((d) => { setTeachers(d.items); setTotal(d.total) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page])

  useEffect(() => {
    if (getRole() !== 'superadmin') { navigate('/', { replace: true }); return }
    load()
  }, [load, navigate])

  function viewStudents(t: AdminTeacherItem) {
    setSelectedTeacher(t)
    getTeacherStudents(t.user_id)
      .then((d) => setStudents(d.items || []))
      .catch(() => {})
  }

  function handleRevoke(userId: string) {
    if (!window.confirm('确定撤销该用户的老师角色？其名下学员将被解绑。')) return
    revokeTeacher(userId).then(() => load()).catch((e) => alert(e.message))
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <PageContainer width="dashboard">
      <div className="adm-page">
        <h2>老师管理</h2>

        <div className="adm-table">
          <table>
            <thead>
              <tr>
                <th>手机号</th><th>昵称</th><th>服务状态</th><th>评分</th><th>学员数</th><th>注册时间</th><th>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="adm-empty">加载中...</td></tr>
              ) : teachers.length === 0 ? (
                <tr><td colSpan={7} className="adm-empty">暂无老师</td></tr>
              ) : teachers.map((t) => (
                <tr key={t.user_id}>
                  <td>{t.phone}</td>
                  <td>{t.nickname || '-'}</td>
                  <td><span className={`adm-tag ${t.service_status === '可接单' ? 'adm-tag--active' : ''}`}>{t.service_status}</span></td>
                  <td>{t.rating != null ? t.rating.toFixed(1) : '-'}</td>
                  <td><a style={{ color: 'var(--color-brand-primary)', cursor: 'pointer', fontWeight: 600 }} onClick={() => viewStudents(t)}>{t.student_count} 人</a></td>
                  <td>{t.created_at?.split('T')[0] || '-'}</td>
                  <td>
                    <div className="adm-actions">
                      <button className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => viewStudents(t)}>学员</button>
                      <button className="adm-btn adm-btn--danger adm-btn--sm" onClick={() => handleRevoke(t.user_id)}>撤销</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="adm-pager">
            <span>共 {total} 条，第 {page}/{totalPages} 页</span>
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>下一页</button>
          </div>
        )}

        {/* 学员弹窗 */}
        {selectedTeacher && (
          <div className="adm-modal-overlay" onClick={() => { setSelectedTeacher(null); setStudents([]) }}>
            <div className="adm-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
              <h3>学员列表 — {selectedTeacher.nickname || selectedTeacher.phone}</h3>
              {students.length === 0 ? (
                <div className="adm-empty">暂无学员</div>
              ) : (
                <div className="adm-table">
                  <table>
                    <thead>
                      <tr><th>手机号</th><th>昵称</th><th>VIP</th><th>NDA</th><th>分配时间</th></tr>
                    </thead>
                    <tbody>
                      {students.map((s) => (
                        <tr key={s.user_id}>
                          <td>{s.phone}</td>
                          <td>{s.nickname || '-'}</td>
                          <td>{s.vip_level}</td>
                          <td>{s.nda_signed ? '✅' : '❌'}</td>
                          <td>{s.assigned_at?.split('T')[0] || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="adm-modal__btns">
                <button className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => { setSelectedTeacher(null); setStudents([]) }}>关闭</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  )
}
