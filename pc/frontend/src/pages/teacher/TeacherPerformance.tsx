import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import './admin.css'

function getMyRole(): string {
  try { return JSON.parse(localStorage.getItem('rg_user') || '{}').role || '' } catch { return '' }
}

export function TeacherPerformance() {
  const navigate = useNavigate()

  useEffect(() => {
    if (getMyRole() !== 'teacher') { navigate('/', { replace: true }); return }
  }, [navigate])

  const trendOption = {
    tooltip: { trigger: 'axis' as const },
    grid: { left: 8, right: 8, top: 8, bottom: 24 },
    xAxis: { type: 'category' as const, data: ['1月', '2月', '3月', '4月', '5月', '6月'] },
    yAxis: { type: 'value' as const, max: 5 },
    series: [{
      type: 'line', data: [4.5, 4.6, 4.7, 4.8, 4.7, 4.8],
      smooth: true,
      itemStyle: { color: '#8B4513' },
      areaStyle: { color: 'rgba(139,69,19,0.08)' },
    }],
  }

  const hoursOption = {
    tooltip: { trigger: 'axis' as const },
    grid: { left: 8, right: 8, top: 8, bottom: 24 },
    xAxis: { type: 'category' as const, data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] },
    yAxis: { type: 'value' as const },
    series: [{
      type: 'bar', data: [3.5, 4.2, 2.8, 5.1, 3.9, 1.2, 0],
      itemStyle: { color: '#D4A574' },
    }],
  }

  return (
          <div className="adm-page">
        <h2>个人绩效概览</h2>

        <div className="adm-stats">
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">服务学员数</div>
            <div className="adm-stat-card__value">12</div>
          </div>
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">本月辅导时长</div>
            <div className="adm-stat-card__value">38.5h</div>
          </div>
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">综合评分</div>
            <div className="adm-stat-card__value">4.8 ⭐</div>
          </div>
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">成功率</div>
            <div className="adm-stat-card__value" style={{ color: 'var(--color-success)' }}>85%</div>
          </div>
        </div>

        <div className="adm-chart-grid">
          <div className="adm-chart-card">
            <h3>评分趋势</h3>
            <ReactECharts option={trendOption} style={{ height: 280 }} />
          </div>
          <div className="adm-chart-card">
            <h3>本周辅导时长 (h)</h3>
            <ReactECharts option={hoursOption} style={{ height: 280 }} />
          </div>
        </div>
      </div>
  )
}
