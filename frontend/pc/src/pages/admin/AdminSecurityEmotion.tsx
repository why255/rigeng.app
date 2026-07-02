import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import './admin.css'

function getMyRole(): string {
  try { return JSON.parse(localStorage.getItem('rg_user') || '{}').role || '' } catch { return '' }
}

const MOCK_USERS = Array.from({ length: 12 }, (_, i) => ({
  id: `eu-${i + 1}`,
  score_drop: 3 + Math.round(Math.random() * 5),
  consecutive_days: 3 + Math.round(Math.random() * 11),
  alerted_at: new Date(2026, 5, 30 - i).toISOString().split('T')[0],
  operator_action: i < 5 ? '已私信关怀' : '待处理',
}))

export function AdminSecurityEmotion() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!['superadmin', 'operator'].includes(getMyRole())) { navigate('/', { replace: true }); return }
  }, [navigate])

  const barOption = {
    tooltip: { trigger: 'axis' as const },
    grid: { left: 8, right: 8, top: 8, bottom: 24 },
    xAxis: { type: 'category' as const, data: MOCK_USERS.map((u) => `用户#${u.id.split('-')[1]}`) },
    yAxis: { type: 'value' as const },
    series: [{
      type: 'bar', data: MOCK_USERS.map((u) => u.score_drop),
      itemStyle: { color: (p: any) => p.value > 5 ? '#F44336' : '#FF9800' },
    }],
  }

  return (
          <div className="adm-page">
        <h2>情绪异常用户预警</h2>

        <div className="adm-stats">
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">异常用户数</div>
            <div className="adm-stat-card__value" style={{ color: 'var(--color-warning)' }}>{MOCK_USERS.length}</div>
          </div>
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">已处理</div>
            <div className="adm-stat-card__value">{MOCK_USERS.filter((u) => u.operator_action !== '待处理').length}</div>
          </div>
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">待处理</div>
            <div className="adm-stat-card__value" style={{ color: 'var(--color-error)' }}>{MOCK_USERS.filter((u) => u.operator_action === '待处理').length}</div>
          </div>
        </div>

        <div className="adm-chart-card" style={{ marginBottom: 24 }}>
          <h3>情绪指数下降幅度（脱敏聚合）</h3>
          <ReactECharts option={barOption} style={{ height: 280 }} />
        </div>

        <div className="adm-panel" style={{ overflow: 'hidden' }}>
          <div className="adm-panel__header">
            <span className="adm-panel__title">异常用户列表（脱敏）</span>
          </div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>用户（脱敏）</th>
                  <th>指数下降</th>
                  <th>持续天数</th>
                  <th>预警时间</th>
                  <th>运营处理</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_USERS.map((u) => (
                  <tr key={u.id}>
                    <td>用户#{u.id.split('-')[1]}</td>
                    <td>
                      <span style={{ color: u.score_drop > 5 ? 'var(--color-error)' : 'var(--color-warning)', fontWeight: 600 }}>
                        -{u.score_drop} 分
                      </span>
                    </td>
                    <td>{u.consecutive_days} 天</td>
                    <td>{u.alerted_at}</td>
                    <td>
                      <span className={`adm-tag ${u.operator_action === '已私信关怀' ? 'adm-tag--active' : 'adm-tag--pending'}`}>
                        {u.operator_action}
                      </span>
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
