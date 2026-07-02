import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'
import './admin.css'

const DEFAULT_HR_MODULES = [
  { id: '1', name: '人力资源规划', sort_order: 1, is_active: true },
  { id: '2', name: '招聘与配置', sort_order: 2, is_active: true },
  { id: '3', name: '培训与开发', sort_order: 3, is_active: true },
  { id: '4', name: '绩效管理', sort_order: 4, is_active: true },
  { id: '5', name: '薪酬福利管理', sort_order: 5, is_active: true },
  { id: '6', name: '劳动关系管理', sort_order: 6, is_active: true },
  { id: '7', name: '组织发展', sort_order: 7, is_active: true },
  { id: '8', name: '员工关系', sort_order: 8, is_active: true },
]

function getMyRole(): string {
  try { return JSON.parse(localStorage.getItem('rg_user') || '{}').role || '' } catch { return '' }
}

export function AdminSettingsHrModules() {
  const navigate = useNavigate()
  const [modules, setModules] = useState(DEFAULT_HR_MODULES)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  useEffect(() => {
    if (getMyRole() !== 'superadmin') { navigate('/', { replace: true }); return }
  }, [navigate])

  const startEdit = (m: typeof modules[0]) => { setEditingId(m.id); setEditName(m.name) }
  const saveEdit = () => {
    setModules((prev) => prev.map((m) => m.id === editingId ? { ...m, name: editName } : m))
    setEditingId(null)
  }

  const toggleActive = (id: string) => {
    setModules((prev) => prev.map((m) => m.id === id ? { ...m, is_active: !m.is_active } : m))
  }

  return (
          <div className="adm-page">
        <h2>HR 模块分类管理</h2>

        <div className="adm-panel" style={{ maxWidth: 600, overflow: 'hidden' }}>
          <div className="adm-panel__header">
            <span className="adm-panel__title">八大模块</span>
            <button className="adm-btn adm-btn--primary adm-btn--sm">
              <Icon icon="mingcute:add-line" width={14} /> 新增
            </button>
          </div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>排序</th>
                  <th>模块名称</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {modules.map((m) => (
                  <tr key={m.id}>
                    <td>{m.sort_order}</td>
                    <td>
                      {editingId === m.id ? (
                        <input className="adm-search" style={{ width: 180, height: 30 }}
                          value={editName} onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveEdit() }} />
                      ) : (
                        <span style={{ fontWeight: 500 }}>{m.name}</span>
                      )}
                    </td>
                    <td>
                      <span className={`adm-tag ${m.is_active ? 'adm-tag--active' : 'adm-tag--inactive'}`}>
                        {m.is_active ? '启用' : '停用'}
                      </span>
                    </td>
                    <td>
                      <div className="adm-actions">
                        {editingId === m.id ? (
                          <>
                            <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={saveEdit}>保存</button>
                            <button className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => setEditingId(null)}>取消</button>
                          </>
                        ) : (
                          <>
                            <button className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => startEdit(m)}>编辑</button>
                            <button className="adm-btn adm-btn--danger adm-btn--sm" onClick={() => toggleActive(m.id)}>
                              {m.is_active ? '停用' : '启用'}
                            </button>
                          </>
                        )}
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
