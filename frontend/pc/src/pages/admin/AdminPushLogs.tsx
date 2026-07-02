import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './admin.css'

function getMyRole(): string {
  try { return JSON.parse(localStorage.getItem('rg_user') || '{}').role || '' } catch { return '' }
}

interface LogItem {
  id: string
  user_id: string
  title: string
  channel: string
  status: string
  open_rate: number | null
  created_at: string
  blocked_reason?: string
}

const MOCK: LogItem[] = Array.from({ length: 20 }, (_, i) => ({
  id: `log-${i + 1}`,
  user_id: `user${1000 + i}`,
  title: ['计划完成率≥80%激励', '情绪关怀推送', '早安问候', '节点提醒'][i % 4],
  channel: ['app_push', 'app_push', 'app_push', 'app_push'][i % 4],
  status: (['sent', 'sent', 'blocked', 'sent'] as const)[i % 4],
  open_rate: i % 4 !== 2 ? Math.round(30 + Math.random() * 50) : null,
  created_at: new Date(2026, 5, 30 - i).toISOString().split('T')[0],
  blocked_reason: i % 4 === 2 ? (i % 8 === 2 ? '夜间拦截' : '频控限制') : undefined,
}))

export function AdminPushLogs() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'all' | 'sent' | 'blocked'>('all')

  useEffect(() => {
    if (!['superadmin', 'operator'].includes(getMyRole())) { navigate('/', { replace: true }); return }
  }, [navigate])

  const filtered = tab === 'all' ? MOCK : tab === 'sent'
    ? MOCK.filter((l) => l.status === 'sent')
    : MOCK.filter((l) => l.status === 'blocked')

  return (
          <div className="adm-page">
        <h2>推送日志</h2>

        <div className="adm-toolbar">
          {(['all', 'sent', 'blocked'] as const).map((t) => (
            <button key={t} className={`adm-tab ${tab === t ? 'adm-tab--active' : ''}`} onClick={() => setTab(t)}>
              {{ all: '全部', sent: '已推送', blocked: '已拦截' }[t]}
            </button>
          ))}
        </div>

        <div className="adm-panel" style={{ overflow: 'hidden' }}>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>用户</th>
                  <th>内容</th>
                  <th>渠道</th>
                  <th>状态</th>
                  <th>打开率</th>
                  <th>拦截原因</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id}>
                    <td>{l.created_at}</td>
                    <td>{l.user_id}</td>
                    <td>{l.title}</td>
                    <td><span className="adm-tag adm-tag--primary">APP推送</span></td>
                    <td>
                      <span className={`adm-tag ${l.status === 'sent' ? 'adm-tag--active' : 'adm-tag--inactive'}`}>
                        {l.status === 'sent' ? '已推送' : '已拦截'}
                      </span>
                    </td>
                    <td>{l.open_rate != null ? `${l.open_rate}%` : '-'}</td>
                    <td>{l.blocked_reason || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
  )
}
