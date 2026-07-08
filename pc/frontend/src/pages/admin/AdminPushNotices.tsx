import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'
import './admin.css'

interface Notice {
  id: string
  title: string
  content: string
  status: 'draft' | 'published' | 'expired'
  target: 'all' | 'vip' | 'custom'
  created_at: string
}

const MOCK: Notice[] = Array.from({ length: 8 }, (_, i) => ({
  id: `notice-${i + 1}`,
  title: `系统公告 #${i + 1}: ${['版本更新通知', '服务维护公告', '新功能上线', '运营活动'][i % 4]}`,
  content: '公告正文内容...',
  status: (['published', 'published', 'draft', 'expired'] as const)[i % 4],
  target: (['all', 'vip', 'custom'] as const)[i % 3],
  created_at: new Date(2026, 5, 20 - i * 3).toISOString().split('T')[0],
}))

function getMyRole(): string {
  try { return JSON.parse(localStorage.getItem('rg_user') || '{}').role || '' } catch { return '' }
}

export function AdminPushNotices() {
  const navigate = useNavigate()
  const [notices] = useState<Notice[]>(MOCK)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', target: 'all' as const })

  useEffect(() => {
    if (!['superadmin', 'operator'].includes(getMyRole())) { navigate('/', { replace: true }); return }
  }, [navigate])

  return (
          <div className="adm-page">
        <h2>系统公告</h2>

        <div className="adm-toolbar">
          <button className="adm-btn adm-btn--primary" onClick={() => setShowForm(true)}>
            <Icon icon="mingcute:add-line" width={14} /> 创建公告
          </button>
        </div>

        {/* 创建表单 */}
        {showForm && (
          <div className="adm-panel" style={{ marginBottom: 16 }}>
            <div className="adm-panel__header">
              <span className="adm-panel__title">创建新公告</span>
              <button className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => setShowForm(false)}>取消</button>
            </div>
            <div className="adm-panel__body">
              <div className="adm-form-group">
                <label>标题</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="adm-form-group">
                <label>内容</label>
                <textarea rows={4} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
              </div>
              <div className="adm-form-group">
                <label>推送范围</label>
                <select value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value as any })}>
                  <option value="all">全部用户</option>
                  <option value="vip">VIP用户</option>
                  <option value="custom">自定义</option>
                </select>
              </div>
              <button className="adm-btn adm-btn--primary">发布公告</button>
            </div>
          </div>
        )}

        {/* 公告列表 */}
        <div className="adm-panel" style={{ overflow: 'hidden' }}>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>标题</th>
                  <th>推送范围</th>
                  <th>状态</th>
                  <th>发布时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {notices.map((n) => (
                  <tr key={n.id}>
                    <td style={{ fontWeight: 500 }}>{n.title}</td>
                    <td><span className="adm-tag adm-tag--primary">{{ all: '全部', vip: 'VIP', custom: '自定义' }[n.target]}</span></td>
                    <td>
                      <span className={`adm-tag ${n.status === 'published' ? 'adm-tag--active' : n.status === 'draft' ? 'adm-tag--pending' : 'adm-tag--inactive'}`}>
                        {{ published: '已发布', draft: '草稿', expired: '已过期' }[n.status]}
                      </span>
                    </td>
                    <td>{n.created_at}</td>
                    <td>
                      <div className="adm-actions">
                        <button className="adm-btn adm-btn--outline adm-btn--sm">查看</button>
                      </div>
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
