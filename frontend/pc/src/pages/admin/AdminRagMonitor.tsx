import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import './admin.css'

function getMyRole(): string {
  try { return JSON.parse(localStorage.getItem('rg_user') || '{}').role || '' } catch { return '' }
}

const MODULES = ['朝有规划', '暮有复盘', '情绪树洞', '智能记录', '智能问答', '智能办公', '高维求职', '品牌打造', '拿下一客户', '打磨产品', '交付订单', '公私智库', '数据分析']

export function AdminRagMonitor() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!['superadmin', 'operator'].includes(getMyRole())) { navigate('/', { replace: true }); return }
  }, [navigate])

  // 模拟命中率数据
  const hitRateData = MODULES.map((name) => ({
    name,
    top5: Math.round(60 + Math.random() * 30),
    top10: Math.round(70 + Math.random() * 20),
  }))

  const hitBarOption = {
    tooltip: { trigger: 'axis' as const },
    legend: { data: ['Top5命中率', 'Top10命中率'], bottom: 0 },
    grid: { left: 8, right: 8, top: 8, bottom: 32 },
    xAxis: { type: 'category' as const, data: MODULES, axisLabel: { rotate: 40, fontSize: 10 } },
    yAxis: { type: 'value' as const, max: 100, axisLabel: { formatter: '{value}%' } },
    series: [
      { name: 'Top5命中率', type: 'bar', data: hitRateData.map((d) => d.top5), itemStyle: { color: '#8B4513' } },
      { name: 'Top10命中率', type: 'bar', data: hitRateData.map((d) => d.top10), itemStyle: { color: '#D4A574' } },
    ],
  }

  const secondSearchRate = Math.round(10 + Math.random() * 12)

  return (
          <div className="adm-page">
        <h2>RAG 检索质量监控</h2>

        <div className="adm-stats">
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">平均 Top5 命中率</div>
            <div className="adm-stat-card__value">{Math.round(hitRateData.reduce((a, b) => a + b.top5, 0) / MODULES.length)}%</div>
          </div>
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">用户二次搜索率</div>
            <div className="adm-stat-card__value" style={{ color: secondSearchRate <= 20 ? 'var(--color-success)' : 'var(--color-warning)' }}>
              {secondSearchRate}%
            </div>
          </div>
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">目标</div>
            <div className="adm-stat-card__value" style={{ fontSize: 18 }}>
              MVP ≥70% / V2 ≥85%
            </div>
          </div>
        </div>

        {/* 命中率柱状图 */}
        <div className="adm-chart-card" style={{ marginBottom: 24 }}>
          <h3>各模块检索命中率</h3>
          <ReactECharts option={hitBarOption} style={{ height: 360 }} />
        </div>

        {/* TopN 召回分析 */}
        <div className="adm-panel" style={{ overflow: 'hidden' }}>
          <div className="adm-panel__header">
            <span className="adm-panel__title">各模块命中率明细</span>
          </div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>模块</th>
                  <th>Top5 命中率</th>
                  <th>Top10 命中率</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {hitRateData.map((d) => (
                  <tr key={d.name}>
                    <td style={{ fontWeight: 500 }}>{d.name}</td>
                    <td>{d.top5}%</td>
                    <td>{d.top10}%</td>
                    <td>
                      <span className={`adm-tag ${d.top5 >= 85 ? 'adm-tag--active' : d.top5 >= 70 ? 'adm-tag--pending' : 'adm-tag--inactive'}`}>
                        {d.top5 >= 85 ? '达标(V2)' : d.top5 >= 70 ? '达标(MVP)' : '未达标'}
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
