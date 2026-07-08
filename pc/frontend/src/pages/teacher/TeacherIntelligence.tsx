import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'
import './admin.css'

function getMyRole(): string {
  try { return JSON.parse(localStorage.getItem('rg_user') || '{}').role || '' } catch { return '' }
}

const MOCK_REPORTS = Array.from({ length: 6 }, (_, i) => ({
  id: `intel-${i + 1}`,
  company: ['某互联网科技公司', '某新能源企业', '某金融服务集团', '某医疗健康企业'][i % 4],
  status: (['draft', 'reviewing', 'delivered', 'delivered'] as const)[i % 4],
  student: `学员${i + 1}`,
  created_at: new Date(2026, 5, 25 - i * 3).toISOString().split('T')[0],
}))

export function TeacherIntelligence() {
  const navigate = useNavigate()

  useEffect(() => {
    if (getMyRole() !== 'teacher') { navigate('/', { replace: true }); return }
  }, [navigate])

  return (
          <div className="adm-page">
        <h2>企业情报采集</h2>

        <div className="adm-toolbar">
          <button className="adm-btn adm-btn--primary">
            <Icon icon="mingcute:add-line" width={14} /> 创建采集任务
          </button>
        </div>

        <div className="adm-stats">
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">总报告数</div>
            <div className="adm-stat-card__value">{MOCK_REPORTS.length}</div>
          </div>
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">已交付</div>
            <div className="adm-stat-card__value" style={{ color: 'var(--color-success)' }}>
              {MOCK_REPORTS.filter((r) => r.status === 'delivered').length}
            </div>
          </div>
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">审核中</div>
            <div className="adm-stat-card__value" style={{ color: 'var(--color-warning)' }}>
              {MOCK_REPORTS.filter((r) => r.status === 'reviewing').length}
            </div>
          </div>
        </div>

        <div className="adm-panel" style={{ overflow: 'hidden' }}>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>目标企业</th>
                  <th>学员</th>
                  <th>状态</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_REPORTS.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.company}</td>
                    <td>{r.student}</td>
                    <td>
                      <span className={`adm-tag ${r.status === 'draft' ? 'adm-tag--pending' : r.status === 'reviewing' ? 'adm-tag--advance' : 'adm-tag--active'}`}>
                        {{ draft: '草稿', reviewing: 'AI审核中', delivered: '已交付' }[r.status]}
                      </span>
                    </td>
                    <td>{r.created_at}</td>
                    <td>
                      <div className="adm-actions">
                        {r.status === 'draft' && <button className="adm-btn adm-btn--primary adm-btn--sm">完善</button>}
                        {r.status === 'delivered' && <button className="adm-btn adm-btn--outline adm-btn--sm">查看</button>}
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
