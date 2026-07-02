import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'
import './admin.css'

const MODULE_LIST = [
  { slug: 'morning-plan', name: 'M1 朝有规划', enabled: true, version: 'v1.2' },
  { slug: 'evening-review', name: 'M2 暮有复盘', enabled: true, version: 'v1.1' },
  { slug: 'mood-haven', name: 'M3 情绪树洞', enabled: true, version: 'v1.3' },
  { slug: 'smart-record', name: 'M4 智能记录', enabled: true, version: 'v1.0' },
  { slug: 'smart-qa', name: 'M5 智能问答', enabled: true, version: 'v1.2' },
  { slug: 'smart-office', name: 'M6 智能办公', enabled: true, version: 'v1.1' },
  { slug: 'career-mentor', name: 'M7 高维求职', enabled: true, version: 'v1.0' },
  { slug: 'brand-building', name: 'M8 品牌打造中心', enabled: true, version: 'v1.0' },
  { slug: 'acquire-client', name: 'M9 拿下一个客户', enabled: true, version: 'v1.0' },
  { slug: 'product-design', name: 'M10 打磨一套产品', enabled: true, version: 'v1.0' },
  { slug: 'deliver-order', name: 'M11 交付一笔订单', enabled: false, version: 'v0.9-beta' },
  { slug: 'knowledge-base', name: 'M12 公私智库', enabled: true, version: 'v1.2' },
  { slug: 'data-analytics', name: 'M13 数据分析', enabled: true, version: 'v1.1' },
]

function getMyRole(): string {
  try { return JSON.parse(localStorage.getItem('rg_user') || '{}').role || '' } catch { return '' }
}

export function AdminSettingsFlags() {
  const navigate = useNavigate()
  const [modules, setModules] = useState(MODULE_LIST)

  useEffect(() => {
    if (getMyRole() !== 'superadmin') { navigate('/', { replace: true }); return }
  }, [navigate])

  const toggle = (slug: string) => {
    setModules((prev) => prev.map((m) => m.slug === slug ? { ...m, enabled: !m.enabled } : m))
  }

  return (
          <div className="adm-page">
        <h2>功能开关</h2>

        <div className="adm-panel" style={{ maxWidth: 640, overflow: 'hidden' }}>
          <div className="adm-panel__header">
            <span className="adm-panel__title">13 子模块独立启停</span>
          </div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>模块</th>
                  <th>版本</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {modules.map((m) => (
                  <tr key={m.slug}>
                    <td style={{ fontWeight: 500 }}>{m.name}</td>
                    <td><span className="adm-tag adm-tag--primary">{m.version}</span></td>
                    <td>
                      <span className={`adm-tag ${m.enabled ? 'adm-tag--active' : 'adm-tag--inactive'}`}>
                        {m.enabled ? '运行中' : '已下线'}
                      </span>
                    </td>
                    <td>
                      <button className={`adm-btn adm-btn--sm ${m.enabled ? 'adm-btn--danger' : 'adm-btn--primary'}`}
                        onClick={() => toggle(m.slug)}>
                        {m.enabled ? '下线' : '启用'}
                      </button>
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
