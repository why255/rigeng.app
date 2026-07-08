import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'
import {
  getUsers, getUserDetail, changeRole,
  getUserTags, setUserTags,
  batchFreeze, batchUnfreeze,
  type AdminUserItem, type AdminUserDetail, type UserTag,
} from '@/api/admin'
import './admin.css'

const PAGE_SIZE = 20

const ROLE_FILTERS = [
  { key: '', label: '全部角色' },
  { key: 'student', label: '学员' },
  { key: 'teacher', label: '老师' },
  { key: 'operator', label: '运营' },
  { key: 'superadmin', label: '超管' },
]

const VIP_FILTERS = [
  { key: '', label: '全部VIP' },
  { key: 'trial', label: '试用期' },
  { key: 'primary', label: '初级VIP' },
  { key: 'medium', label: '中级VIP' },
  { key: 'advanced', label: '高级VIP' },
]

const ROLE_TAG_CLASS: Record<string, string> = {
  student: 'adm-tag--student',
  teacher: 'adm-tag--teacher',
  operator: 'adm-tag--operator',
  superadmin: 'adm-tag--superadmin',
}

const ROLE_LABEL: Record<string, string> = {
  student: '学员',
  teacher: '老师',
  operator: '运营',
  superadmin: '超管',
}

const VIP_LABEL: Record<string, string> = {
  trial: '试用期',
  primary: '初级',
  medium: '中级',
  advanced: '高级',
  '': '免费',
}

function getMyRole(): string {
  try { return JSON.parse(localStorage.getItem('rg_user') || '{}').role || '' } catch { return '' }
}

export function AdminUsers() {
  const navigate = useNavigate()
  const myRole = getMyRole()

  // 列表状态
  const [users, setUsers] = useState<AdminUserItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [roleFilter, setRoleFilter] = useState('')
  const [vipFilter, setVipFilter] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [loading, setLoading] = useState(true)

  // 选中状态
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // 详情弹窗
  const [detail, setDetail] = useState<AdminUserDetail | null>(null)
  const [detailTab, setDetailTab] = useState<'info' | 'modules' | 'tags'>('info')

  // 标签
  const [allTags, setAllTags] = useState<UserTag[]>([])
  const [editingTags, setEditingTags] = useState(false)

  // 加载用户列表
  const load = useCallback(() => {
    const params: Record<string, string> = { page: String(page), page_size: String(PAGE_SIZE) }
    if (roleFilter) params.role = roleFilter
    if (vipFilter) params.vip_level = vipFilter
    if (search.trim()) params.search = search.trim()
    setLoading(true)
    getUsers(params)
      .then((d) => { setUsers(d.items); setTotal(d.total) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page, roleFilter, vipFilter, search])

  useEffect(() => {
    if (myRole !== 'superadmin' && myRole !== 'operator') { navigate('/', { replace: true }); return }
    load()
    getUserTags().then(setAllTags).catch(() => {})
  }, [load, navigate, myRole])

  // 搜索
  const doSearch = () => {
    setSearch(searchInput)
    setPage(1)
  }

  // 全选
  const toggleSelectAll = () => {
    if (selected.size === users.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(users.map((u) => u.user_id)))
    }
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // 批量操作
  const handleBatchFreeze = async () => {
    if (!window.confirm(`确定冻结选中的 ${selected.size} 个用户？`)) return
    await batchFreeze([...selected]).catch((e) => alert(e.message))
    setSelected(new Set())
    load()
  }

  const handleBatchUnfreeze = async () => {
    if (!window.confirm(`确定解冻选中的 ${selected.size} 个用户？`)) return
    await batchUnfreeze([...selected]).catch((e) => alert(e.message))
    setSelected(new Set())
    load()
  }

  // 查看详情
  const viewDetail = (userId: string) => {
    getUserDetail(userId).then((d) => { if (d) { setDetail(d); setDetailTab('info') } }).catch(() => {})
  }

  // 角色变更
  const handleChangeRole = (userId: string, newRole: string) => {
    const label = ROLE_LABEL[newRole] || newRole
    if (!window.confirm(`确定变更该用户角色为「${label}」？`)) return
    changeRole(userId, newRole).then(() => { setDetail(null); load() }).catch((e) => alert(e.message))
  }

  // 标签操作
  const handleToggleTag = async (userId: string, tagId: string, currentlyHas: boolean) => {
    const currentTags = detail?.user_tags?.map((t: any) => t.id) || []
    const newTags = currentlyHas
      ? currentTags.filter((id) => id !== tagId)
      : [...currentTags, tagId]
    await setUserTags(userId, newTags).catch((e) => alert(e.message))
    // 刷新详情
    getUserDetail(userId).then((d) => { if (d) setDetail(d) }).catch(() => {})
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
          <div className="adm-page">
        <h2>用户管理</h2>

        {/* ── 筛选栏 ── */}
        <div className="adm-toolbar">
          {/* 角色筛选 */}
          <select className="adm-search" style={{ width: 130 }}
            value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }}>
            {ROLE_FILTERS.map((r) => (
              <option key={r.key} value={r.key}>{r.label}</option>
            ))}
          </select>

          {/* VIP筛选 */}
          <select className="adm-search" style={{ width: 130 }}
            value={vipFilter} onChange={(e) => { setVipFilter(e.target.value); setPage(1) }}>
            {VIP_FILTERS.map((v) => (
              <option key={v.key} value={v.key}>{v.label}</option>
            ))}
          </select>

          {/* 搜索 */}
          <input className="adm-search" placeholder="搜索手机号/昵称..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') doSearch() }} />
          <button className="adm-btn adm-btn--outline adm-btn--sm" onClick={doSearch}>
            <Icon icon="mingcute:search-line" width={14} /> 搜索
          </button>

          <div style={{ flex: 1 }} />

          {/* 批量操作 */}
          {selected.size > 0 && (
            <>
              <span style={{ fontSize: 'var(--font-size-l6)', color: 'var(--color-neutral-500)' }}>
                已选 {selected.size} 项
              </span>
              {myRole === 'superadmin' && (
                <>
                  <button className="adm-btn adm-btn--danger adm-btn--sm" onClick={handleBatchFreeze}>批量冻结</button>
                  <button className="adm-btn adm-btn--outline adm-btn--sm" onClick={handleBatchUnfreeze}>批量解冻</button>
                </>
              )}
            </>
          )}
        </div>

        {/* ── 表格 ── */}
        <div className="adm-panel" style={{ overflow: 'hidden' }}>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input type="checkbox" checked={selected.size === users.length && users.length > 0}
                      onChange={toggleSelectAll} />
                  </th>
                  <th>手机号</th>
                  <th>昵称</th>
                  <th>角色</th>
                  <th>VIP</th>
                  <th>标签</th>
                  <th>注册时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="adm-empty">加载中...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={8} className="adm-empty">暂无数据</td></tr>
                ) : users.map((u) => (
                  <tr key={u.user_id}>
                    <td>
                      <input type="checkbox" checked={selected.has(u.user_id)}
                        onChange={() => toggleSelect(u.user_id)} />
                    </td>
                    <td>{u.phone}</td>
                    <td>{u.nickname || '-'}</td>
                    <td><span className={`adm-tag ${ROLE_TAG_CLASS[u.role] || ''}`}>{ROLE_LABEL[u.role] || u.role}</span></td>
                    <td><span className={`adm-tag ${u.vip_level === 'trial' ? 'adm-tag--trial' : u.vip_level === 'primary' ? 'adm-tag--primary' : u.vip_level === 'medium' ? 'adm-tag--advance' : u.vip_level === 'advanced' ? 'adm-tag--pro' : ''}`}>{VIP_LABEL[u.vip_level] || '-'}</span></td>
                    <td>
                      {(u.tags || []).slice(0, 3).map((t: any) => (
                        <span key={t.id} className="adm-tag adm-tag--primary" style={{ marginRight: 4 }}>{t.name}</span>
                      ))}
                      {(u.tags || []).length > 3 && <span style={{ fontSize: 12, color: '#999' }}>+{(u.tags || []).length - 3}</span>}
                    </td>
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
        </div>

        {/* ── 分页 ── */}
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

        {/* ── 详情弹窗 ── */}
        {detail && (
          <div className="adm-modal-overlay" onClick={() => { setDetail(null); setEditingTags(false) }}>
            <div className="adm-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div className="adm-topbar__user-avatar" style={{ width: 48, height: 48, fontSize: 18 }}>
                  <span>{(detail.nickname || detail.phone).charAt(0)}</span>
                </div>
                <div>
                  <h3 style={{ margin: 0, padding: 0, border: 'none' }}>{detail.nickname || detail.phone}</h3>
                  <span style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>{detail.phone}</span>
                </div>
              </div>

              {/* Tab 切换 */}
              <div className="adm-toolbar" style={{ borderBottom: '1px solid var(--color-neutral-100)', paddingBottom: 8 }}>
                {(['info', 'modules', 'tags'] as const).map((tab) => (
                  <button key={tab}
                    className={`adm-tab ${detailTab === tab ? 'adm-tab--active' : ''}`}
                    onClick={() => setDetailTab(tab)}>
                    {{ info: '基本信息', modules: '模块使用', tags: '用户标签' }[tab]}
                  </button>
                ))}
              </div>

              {/* 基本信息 */}
              {detailTab === 'info' && (
                <div>
                  <DetailRow label="用户ID" value={detail.user_id} />
                  <DetailRow label="角色" value={ROLE_LABEL[detail.role] || detail.role} />
                  <DetailRow label="状态" value={detail.status} />
                  <DetailRow label="性别" value={detail.gender || '-'} />
                  {detail.vip && (
                    <>
                      <DetailRow label="VIP等级" value={VIP_LABEL[detail.vip.level] || detail.vip.level} />
                      <DetailRow label="VIP到期" value={detail.vip.expire_at?.split('T')[0] || '-'} />
                    </>
                  )}
                  {detail.teacher_profile && (
                    <DetailRow label="服务状态" value={detail.teacher_profile.service_status || '-'} />
                  )}
                  {detail.assigned_teacher && (
                    <DetailRow label="分配老师" value={detail.assigned_teacher.nickname || detail.assigned_teacher.phone} />
                  )}
                  <DetailRow label="注册时间" value={detail.created_at?.split('T')[0] || '-'} />
                  <DetailRow label="贡献值余额" value={String(detail.contribution_points || 0)} />
                  <DetailRow label="存储用量" value={`${detail.storage_used_mb || 0} MB`} />
                </div>
              )}

              {/* 模块使用 */}
              {detailTab === 'modules' && (
                <div>
                  {(detail.module_usage && detail.module_usage.length > 0) ? (
                    detail.module_usage.map((m: any) => (
                      <div key={m.slug} className="adm-modal__row" style={{ justifyContent: 'space-between' }}>
                        <span>{m.name}</span>
                        <span style={{ color: 'var(--color-neutral-500)' }}>使用 {m.count || 0} 次</span>
                      </div>
                    ))
                  ) : (
                    <p className="adm-empty" style={{ padding: 24 }}>暂无模块使用数据</p>
                  )}
                </div>
              )}

              {/* 用户标签 */}
              {detailTab === 'tags' && (
                <div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    {(detail.user_tags || []).map((t: any) => (
                      <span key={t.id} className="adm-tag adm-tag--primary" style={{ fontSize: 13, padding: '4px 10px' }}>
                        {t.name}
                        {editingTags && (
                          <button
                            onClick={() => handleToggleTag(detail.user_id, t.id, true)}
                            style={{ marginLeft: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6 }}
                          >
                            <Icon icon="mingcute:close-line" width={12} />
                          </button>
                        )}
                      </span>
                    ))}
                    {(!detail.user_tags || detail.user_tags.length === 0) && (
                      <span style={{ color: 'var(--color-neutral-300)', fontSize: 14 }}>暂无标签</span>
                    )}
                  </div>
                  {editingTags && (
                    <div>
                      <p style={{ fontSize: 13, color: 'var(--color-neutral-500)', marginBottom: 8 }}>点击添加标签：</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {allTags.filter((t) => !(detail.user_tags || []).find((ut: any) => ut.id === t.id)).map((t) => (
                          <button key={t.id}
                            className="adm-tag"
                            style={{ cursor: 'pointer', background: t.color || '#FFF8F0', border: '1px solid var(--color-neutral-100)', fontSize: 13, padding: '4px 10px' }}
                            onClick={() => handleToggleTag(detail.user_id, t.id, false)}>
                            + {t.name}
                          </button>
                        ))}
                        {allTags.filter((t) => !(detail.user_tags || []).find((ut: any) => ut.id === t.id)).length === 0 && (
                          <span style={{ fontSize: 13, color: 'var(--color-neutral-300)' }}>所有标签已添加</span>
                        )}
                      </div>
                    </div>
                  )}
                  <button className="adm-btn adm-btn--outline adm-btn--sm" style={{ marginTop: 12 }}
                    onClick={() => setEditingTags(!editingTags)}>
                    <Icon icon="mingcute:edit-line" width={14} /> {editingTags ? '完成' : '编辑标签'}
                  </button>
                </div>
              )}

              {/* 角色操作 */}
              {myRole === 'superadmin' && (
                <div className="adm-modal__btns">
                  {detail.role !== 'teacher' && (
                    <button className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => handleChangeRole(detail.user_id, 'teacher')}>设为老师</button>
                  )}
                  {detail.role !== 'operator' && (
                    <button className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => handleChangeRole(detail.user_id, 'operator')}>设为运营</button>
                  )}
                  {detail.role !== 'superadmin' && (
                    <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={() => handleChangeRole(detail.user_id, 'superadmin')}>设为超管</button>
                  )}
                  {detail.role !== 'student' && detail.role !== 'superadmin' && (
                    <button className="adm-btn adm-btn--danger adm-btn--sm" onClick={() => handleChangeRole(detail.user_id, 'student')}>降为学员</button>
                  )}
                  <button className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => setDetail(null)}>关闭</button>
                </div>
              )}
              {myRole !== 'superadmin' && (
                <div className="adm-modal__btns">
                  <button className="adm-btn adm-btn--outline" onClick={() => setDetail(null)}>关闭</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="adm-modal__row">
      <label>{label}</label>
      <span>{value}</span>
    </div>
  )
}
