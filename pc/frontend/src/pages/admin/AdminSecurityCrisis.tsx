import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import './admin.css'

function getMyRole(): string {
  try { return JSON.parse(localStorage.getItem('rg_user') || '{}').role || '' } catch { return '' }
}

const MOCK_EVENTS = Array.from({ length: 10 }, (_, i) => ({
  id: `crisis-${i + 1}`,
  triggered_at: new Date(2026, 5, 28 - i, 14 + i, 0).toISOString(),
  response_time_s: Math.round(0.5 + Math.random() * 4),
  handled_by: '系统自动',
  severity: (['高', '中', '低'] as const)[i % 3],
}))

export function AdminSecurityCrisis() {
  const navigate = useNavigate()

  useEffect(() => {
    if (getMyRole() !== 'superadmin') { navigate('/', { replace: true }); return }
  }, [navigate])

  const trendOption = {
    tooltip: { trigger: 'axis' as const },
    grid: { left: 8, right: 8, top: 8, bottom: 24 },
    xAxis: { type: 'category' as const, data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] },
    yAxis: { type: 'value' as const },
    series: [{
      type: 'line', data: [2, 1, 3, 2, 1, 0, 1],
      itemStyle: { color: '#F44336' },
      areaStyle: { color: 'rgba(244,67,54,0.1)' },
    }],
  }

  return (
          <div className="adm-page">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <h2 style={{ margin: 0 }}>危机事件日志</h2>
          <span style={{ background: '#FFEBEE', color: '#C62828', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>⚠ 仅脱敏查看</span>
        </div>

        <div className="adm-stats">
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">本周危机事件</div>
            <div className="adm-stat-card__value" style={{ color: 'var(--color-error)' }}>10</div>
          </div>
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">平均响应时间</div>
            <div className="adm-stat-card__value">1.8s</div>
          </div>
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">≤3秒达标率</div>
            <div className="adm-stat-card__value" style={{ color: 'var(--color-success)' }}>95%</div>
          </div>
        </div>

        <div className="adm-chart-card" style={{ marginBottom: 24 }}>
          <h3>危机事件趋势（本周）</h3>
          <ReactECharts option={trendOption} style={{ height: 240 }} />
        </div>

        <div className="adm-panel" style={{ overflow: 'hidden' }}>
          <div className="adm-panel__header">
            <span className="adm-panel__title">事件记录（脱敏）</span>
          </div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>触发时间</th>
                  <th>响应时间(s)</th>
                  <th>严重级别</th>
                  <th>处理方式</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_EVENTS.map((e, i) => (
                  <tr key={e.id}>
                    <td>{i + 1}</td>
                    <td>{new Date(e.triggered_at).toLocaleString('zh-CN')}</td>
                    <td>{e.response_time_s}s</td>
                    <td>
                      <span className={`adm-tag ${e.severity === '高' ? 'adm-tag--inactive' : e.severity === '中' ? 'adm-tag--pending' : 'adm-tag--active'}`}>
                        {e.severity}
                      </span>
                    </td>
                    <td>{e.handled_by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
  )
}
