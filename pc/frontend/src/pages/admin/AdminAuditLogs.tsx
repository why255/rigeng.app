import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'
import { getAuditLogs, type AdminAuditLogItem } from '@/api/admin'
import './admin.css'

const PAGE_SIZE = 20
const TABS = [
  { key: 'all', label: '全部操作' },
  { key: 'login', label: '登录' },
  { key: 'user', label: '用户操作' },
  { key: 'permission', label: '权限变更' },
  { key: 'content', label: '内容审核' },
  { key: 'config', label: '配置修改' },
  { key: 'export', label: '数据导出' },
  { key: 'private_access', label: '私有库访问' },
]

function getMyRole(): string {
  try { return JSON.parse(localStorage.getItem('rg_user') || '{}').role || '' } catch { return '' }
}

export function AdminAuditLogs() {
  const navigate = useNavigate()
  const [logs, setLogs] = useState<AdminAuditLogItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<AdminAuditLogItem | null>(null)

  const load = useCallback(() => {
    const params: Record<string, string> = { page: String(page), page_size: String(PAGE_SIZE) }
    if (activeTab !== 'all') params.action = activeTab
    if (search.trim()) params.search = search.trim()
    setLoading(true)
    getAuditLogs(params)
      .then((d) => { setLogs(d.items); setTotal(d.total) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page, activeTab, search])

  useEffect(() => {
    if (getMyRole() !== 'superadmin') { navigate('/', { replace: true }); return }
    load()
  }, [load, navigate])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
          <div className="adm-page">
        <h2>审计日志</h2>

        {/* 分类 Tab */}
        <div className="adm-toolbar">
          {TABS.map((t) => (
            <button key={t.key} className={`adm-tab ${activeTab === t.key ? 'adm-tab--active' : ''}`}
              onClick={() => { setActiveTab(t.key); setPage(1) }}>{t.label}</button>
          ))}
          <div style={{ flex: 1 }} />
          <input className="adm-search" placeholder="搜索操作人/内容..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); load() } }} />
        </div>

        {/* 日志表格 */}
        <div className="adm-panel" style={{ overflow: 'hidden' }}>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>操作人</th>
                  <th>操作类型</th>
                  <th>操作对象</th>
                  <th>时间</th>
                  <th>IP</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="adm-empty">加载中...</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={6} className="adm-empty">暂无日志</td></tr>
                ) : logs.map((l) => (
                  <tr key={l.id}>
                    <td style={{ fontWeight: 500 }}>{l.operator_id}</td>
                    <td><span className="adm-tag adm-tag--primary">{l.action}</span></td>
                    <td>{l.target_user_id || '-'}</td>
                    <td>{new Date(l.created_at).toLocaleString('zh-CN')}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{(l.detail as any)?.ip || '-'}</td>
                    <td>
                      <button className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => setDetail(l)}>
                        <Icon icon="mingcute:eye-line" width={14} /> 详情
                      </button>
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

        {/* 详情弹窗 */}
        {detail && (
          <div className="adm-modal-overlay" onClick={() => setDetail(null)}>
            <div className="adm-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
              <h3>操作详情</h3>
              <div className="adm-modal__row"><label>操作人</label><span>{detail.operator_id}</span></div>
              <div className="adm-modal__row"><label>操作类型</label><span>{detail.action}</span></div>
              <div className="adm-modal__row"><label>操作对象</label><span>{detail.target_user_id || '-'}</span></div>
              <div className="adm-modal__row"><label>操作时间</label><span>{new Date(detail.created_at).toLocaleString('zh-CN')}</span></div>
              <div className="adm-modal__row"><label>IP 地址</label><span>{(detail.detail as any)?.ip || '-'}</span></div>
              {detail.detail && (
                <div style={{ marginTop: 12 }}>
                  <label style={{ fontSize: 13, color: 'var(--color-neutral-500)', fontWeight: 600 }}>变更详情</label>
                  <pre style={{ marginTop: 4, padding: 8, background: 'var(--color-neutral-25)', borderRadius: 8, fontSize: 12, overflow: 'auto', maxHeight: 200 }}>
                    {JSON.stringify(detail.detail, null, 2)}
                  </pre>
                </div>
              )}
              <div className="adm-modal__btns">
                <button className="adm-btn adm-btn--outline" onClick={() => setDetail(null)}>关闭</button>
              </div>
            </div>
          </div>
        )}
      </div>
  )
}
