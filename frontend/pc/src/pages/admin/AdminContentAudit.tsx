import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'
import './admin.css'

/* ── 模拟数据类型 ── */
interface AuditItem {
  id: string
  source: string
  title: string
  submitter: string
  submitted_at: string
  status: 'pending' | 'approved' | 'rejected'
  reject_reason?: string
}

const MOCK_DATA: AuditItem[] = Array.from({ length: 15 }, (_, i) => ({
  id: `audit-${i + 1}`,
  source: ['朝有规划', '暮有复盘', '智能记录', '智能问答', '智能办公', '公私智库'][i % 6],
  title: `内容审核样本 #${i + 1} - ${['周报模板', 'SOP流程', '会议纪要', '项目复盘', '知识沉淀', '案例分析'][i % 6]}`,
  submitter: `用户${1000 + i}`,
  submitted_at: new Date(2026, 5, 25 - i).toISOString().split('T')[0],
  status: (['pending', 'pending', 'pending', 'approved', 'rejected', 'pending'] as const)[i % 6],
  reject_reason: i % 6 === 4 ? '内容分类不匹配' : undefined,
}))

const STATUS_TAG: Record<string, string> = {
  pending: 'adm-tag--pending',
  approved: 'adm-tag--approved',
  rejected: 'adm-tag--rejected',
}

const STATUS_LABEL: Record<string, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已驳回',
}

function getMyRole(): string {
  try { return JSON.parse(localStorage.getItem('rg_user') || '{}').role || '' } catch { return '' }
}

export function AdminContentAudit() {
  const navigate = useNavigate()
  const [items, setItems] = useState<AuditItem[]>(MOCK_DATA)
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [rejectModal, setRejectModal] = useState<{ id: string; reason: string } | null>(null)

  useEffect(() => {
    if (!['superadmin', 'operator'].includes(getMyRole())) { navigate('/', { replace: true }); return }
  }, [navigate])

  const filtered = statusFilter ? items.filter((i) => i.status === statusFilter) : items

  const toggleSelect = (id: string) => {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const handleApprove = (id: string) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, status: 'approved' as const } : i))
  }

  const openReject = (id: string) => setRejectModal({ id, reason: '' })

  const confirmReject = () => {
    if (!rejectModal) return
    setItems((prev) => prev.map((i) => i.id === rejectModal.id
      ? { ...i, status: 'rejected' as const, reject_reason: rejectModal.reason }
      : i))
    setRejectModal(null)
  }

  const batchApprove = () => {
    setItems((prev) => prev.map((i) => selected.has(i.id) ? { ...i, status: 'approved' as const } : i))
    setSelected(new Set())
  }

  const batchReject = () => {
    const reason = window.prompt('请输入批量驳回原因：')
    if (!reason) return
    setItems((prev) => prev.map((i) => selected.has(i.id)
      ? { ...i, status: 'rejected' as const, reject_reason: reason }
      : i))
    setSelected(new Set())
  }

  const overdueCount = items.filter((i) => {
    const d = new Date(i.submitted_at)
    return i.status === 'pending' && (Date.now() - d.getTime()) > 30 * 86400000
  }).length

  return (
          <div className="adm-page">
        <h2>文档审核队列</h2>

        {/* 统计 */}
        <div className="adm-stats">
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">待审核</div>
            <div className="adm-stat-card__value">{items.filter((i) => i.status === 'pending').length}</div>
          </div>
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">今日通过</div>
            <div className="adm-stat-card__value" style={{ color: 'var(--color-success)' }}>{items.filter((i) => i.status === 'approved').length}</div>
          </div>
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">今日驳回</div>
            <div className="adm-stat-card__value" style={{ color: 'var(--color-error)' }}>{items.filter((i) => i.status === 'rejected').length}</div>
          </div>
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">
              超期未处理
              {overdueCount > 0 && <span style={{ color: 'var(--color-error)', marginLeft: 8, fontSize: 12 }}>⚠ {overdueCount}</span>}
            </div>
            <div className="adm-stat-card__value" style={{ color: overdueCount > 0 ? 'var(--color-error)' : undefined }}>{overdueCount}</div>
          </div>
        </div>

        {/* 筛选 */}
        <div className="adm-toolbar">
          {(['', 'pending', 'approved', 'rejected'] as const).map((s) => (
            <button key={s} className={`adm-tab ${statusFilter === s ? 'adm-tab--active' : ''}`}
              onClick={() => setStatusFilter(s)}>
              {s === '' ? '全部' : STATUS_LABEL[s]}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          {selected.size > 0 && (
            <>
              <span style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>已选 {selected.size}</span>
              <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={batchApprove}>批量通过</button>
              <button className="adm-btn adm-btn--danger adm-btn--sm" onClick={batchReject}>批量驳回</button>
            </>
          )}
        </div>

        {/* 表格 */}
        <div className="adm-panel" style={{ overflow: 'hidden' }}>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}><input type="checkbox" onChange={(e) => setSelected(e.target.checked ? new Set(filtered.map((i) => i.id)) : new Set())} /></th>
                  <th>来源</th>
                  <th>标题</th>
                  <th>提交人</th>
                  <th>提交时间</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td><input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} /></td>
                    <td><span className="adm-tag adm-tag--primary">{item.source}</span></td>
                    <td>{item.title}</td>
                    <td>{item.submitter}</td>
                    <td>{item.submitted_at}</td>
                    <td>
                      <span className={`adm-tag ${STATUS_TAG[item.status]}`}>
                        {STATUS_LABEL[item.status]}
                      </span>
                      {item.reject_reason && <span style={{ fontSize: 11, color: 'var(--color-error)', marginLeft: 4 }}>({item.reject_reason})</span>}
                    </td>
                    <td>
                      {item.status === 'pending' && (
                        <div className="adm-actions">
                          <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={() => handleApprove(item.id)}>
                            <Icon icon="mingcute:check-line" width={14} /> 通过
                          </button>
                          <button className="adm-btn adm-btn--danger adm-btn--sm" onClick={() => openReject(item.id)}>
                            <Icon icon="mingcute:close-line" width={14} /> 驳回
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 驳回原因弹窗 */}
        {rejectModal && (
          <div className="adm-modal-overlay" onClick={() => setRejectModal(null)}>
            <div className="adm-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
              <h3>驳回原因</h3>
              <div className="adm-form-group">
                <textarea
                  rows={3}
                  placeholder="请输入驳回原因..."
                  value={rejectModal.reason}
                  onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
                />
              </div>
              <div className="adm-modal__btns">
                <button className="adm-btn adm-btn--outline" onClick={() => setRejectModal(null)}>取消</button>
                <button className="adm-btn adm-btn--danger" onClick={confirmReject} disabled={!rejectModal.reason.trim()}>确认驳回</button>
              </div>
            </div>
          </div>
        )}
      </div>
  )
}
