import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { getUsers, getUserDetail, changeRole, type AdminUserItem, type AdminUserDetail } from '@/api/admin'
import './admin.css'

const PAGE_SIZE = 20
const ROLES = [
  { key: '', label: '全部' },
  { key: 'student', label: '学员' },
  { key: 'teacher', label: '老师' },
  { key: 'superadmin', label: '管理员' },
]
const ROLE_TAG_CLASS: Record<string, string> = {
  student: 'adm-tag--student',
  teacher: 'adm-tag--teacher',
  superadmin: 'adm-tag--superadmin',
}

function getRole(): string {
  try { return JSON.parse(localStorage.getItem('rg_user') || '{}').role || '' } catch { return '' }
}

/** 用户列表 + 筛选 + 详情弹窗 */
export function AdminUsers() {
  const navigate = useNavigate()
  const [users, setUsers] = useState<AdminUserItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [role, setRole] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<AdminUserDetail | null>(null)

  const load = useCallback(() => {
    const params: Record<string, string> = { page: String(page), page_size: String(PAGE_SIZE) }
    if (role) params.role = role
    if (search.trim()) params.phone = search.trim()
    setLoading(true)
    getUsers(params)
      .then((d) => { setUsers(d.items); setTotal(d.total) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page, role, search])

  useEffect(() => {
    if (getRole() !== 'superadmin') { navigate('/', { replace: true }); return }
    load()
  }, [load, navigate])

  function viewDetail(userId: string) {
    getUserDetail(userId).then((d) => { if (d) setDetail(d) }).catch(() => {})
  }

  function handleChangeRole(userId: string, newRole: string) {
    if (!window.confirm('确定变更该用户角色为 ' + newRole + ' ？')) return
    changeRole(userId, newRole).then(() => { setDetail(null); load() }).catch((e) => alert(e.message))
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <PageContainer width="dashboard">
      <div className="adm-page">
        <h2>用户管理</h2>

        {/* 筛选栏 */}
        <div className="adm-toolbar">
          {ROLES.map((r) => (
            <button key={r.key} className={`adm-tab ${role === r.key ? 'adm-tab--active' : ''}`}
              onClick={() => { setRole(r.key); setPage(1) }}>{r.label}</button>
          ))}
          <input className="adm-search" placeholder="搜索手机号..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); load() } }} />
          <button className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => { setPage(1); load() }}>搜索</button>
        </div>

        {/* 表格 */}
        <div className="adm-table">
          <table>
            <thead>
              <tr>
                <th>手机号</th><th>昵称</th><th>角色</th><th>VIP</th><th>注册时间</th><th>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="adm-empty">加载中...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={6} className="adm-empty">暂无数据</td></tr>
              ) : users.map((u) => (
                <tr key={u.user_id}>
                  <td>{u.phone}</td>
                  <td>{u.nickname || '-'}</td>
                  <td><span className={`adm-tag ${ROLE_TAG_CLASS[u.role] || ''}`}>{u.role}</span></td>
                  <td><span className={`adm-tag ${u.vip_level === 'trial' ? 'adm-tag--trial' : ''}`}>{u.vip_level}</span></td>
                  <td>{u.created_at?.split('T')[0] || '-'}</td>
                  <td>
                    <div className="adm-actions">
                      <button className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => viewDetail(u.user_id)}>详情</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="adm-pager">
            <span>共 {total} 条，第 {page}/{totalPages} 页</span>
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>下一页</button>
          </div>
        )}

        {/* 详情弹窗 */}
        {detail && (
          <div className="adm-modal-overlay" onClick={() => setDetail(null)}>
            <div className="adm-modal" onClick={(e) => e.stopPropagation()}>
              <h3>用户详情</h3>
              <div>
                <DetailRow label="用户ID" value={detail.user_id} />
                <DetailRow label="手机号" value={detail.phone} />
                <DetailRow label="昵称" value={detail.nickname || '-'} />
                <DetailRow label="性别" value={detail.gender || '-'} />
                <DetailRow label="角色" value={detail.role} />
                <DetailRow label="状态" value={detail.status} />
                {detail.vip && <DetailRow label="VIP等级" value={detail.vip.level} />}
                {detail.vip?.expire_at && <DetailRow label="VIP到期" value={detail.vip.expire_at?.split('T')[0]} />}
                {detail.teacher_profile && <DetailRow label="老师状态" value={detail.teacher_profile.service_status} />}
                {detail.assigned_teacher && <DetailRow label="分配老师" value={detail.assigned_teacher.nickname || detail.assigned_teacher.phone} />}
                <DetailRow label="注册时间" value={detail.created_at?.split('T')[0] || '-'} />
              </div>
              <div className="adm-modal__btns">
                {detail.role !== 'teacher' && (
                  <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={() => handleChangeRole(detail.user_id, 'teacher')}>设为老师</button>
                )}
                {detail.role !== 'superadmin' && (
                  <button className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => handleChangeRole(detail.user_id, 'superadmin')}>设为管理员</button>
                )}
                {detail.role !== 'student' && detail.role !== 'superadmin' && (
                  <button className="adm-btn adm-btn--danger adm-btn--sm" onClick={() => handleChangeRole(detail.user_id, 'student')}>降为学员</button>
                )}
                <button className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => setDetail(null)}>关闭</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="adm-modal__row">
      <label>{label}</label><span>{value}</span>
    </div>
  )
}
