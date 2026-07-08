import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTeachers } from '@/api/admin'
import ReactECharts from 'echarts-for-react'
import './admin.css'

function getMyRole(): string {
  try { return JSON.parse(localStorage.getItem('rg_user') || '{}').role || '' } catch { return '' }
}

interface WorkloadRow {
  name: string
  students: number
  projects: number
  sessions: number
  hours: number
  intel_reports: number
}

export function AdminTeacherWorkload() {
  const navigate = useNavigate()
  const [data, setData] = useState<WorkloadRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    getTeachers({ page_size: '100' })
      .then((d) => {
        const rows: WorkloadRow[] = (d.items || []).map((t: any) => ({
          name: t.nickname || t.phone,
          students: t.student_count || 0,
          projects: t.project_count || 0,
          sessions: t.session_count || 0,
          hours: t.total_hours || 0,
          intel_reports: t.intel_report_count || 0,
        }))
        setData(rows)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!['superadmin', 'operator'].includes(getMyRole())) { navigate('/', { replace: true }); return }
    load()
  }, [load, navigate])

  const barOption = {
    tooltip: { trigger: 'axis' as const },
    legend: { data: ['学员数', '项目数', '辅导次数', '辅导时长(h)', '情报报告'], bottom: 0 },
    grid: { left: 8, right: 8, top: 8, bottom: 32 },
    xAxis: { type: 'category' as const, data: data.map((d) => d.name), axisLabel: { rotate: 30, fontSize: 11 } },
    yAxis: { type: 'value' as const },
    series: [
      { name: '学员数', type: 'bar', data: data.map((d) => d.students), itemStyle: { color: '#8B4513' } },
      { name: '项目数', type: 'bar', data: data.map((d) => d.projects), itemStyle: { color: '#D2691E' } },
      { name: '辅导次数', type: 'bar', data: data.map((d) => d.sessions), itemStyle: { color: '#D4A574' } },
      { name: '辅导时长(h)', type: 'bar', data: data.map((d) => d.hours), itemStyle: { color: '#607D8B' } },
      { name: '情报报告', type: 'bar', data: data.map((d) => d.intel_reports), itemStyle: { color: '#4CAF50' } },
    ],
  }

  if (loading) return <div className="adm-page"><div className="adm-page"><h2>教师工作量看板</h2><p className="adm-empty">加载中...</p></div></div>

  return (
          <div className="adm-page">
        <h2>教师工作量看板</h2>

        {/* 指标卡片 */}
        <div className="adm-stats">
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">教师总数</div>
            <div className="adm-stat-card__value">{data.length}</div>
          </div>
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">总学员数</div>
            <div className="adm-stat-card__value">{data.reduce((a, b) => a + b.students, 0)}</div>
          </div>
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">总辅导次数</div>
            <div className="adm-stat-card__value">{data.reduce((a, b) => a + b.sessions, 0)}</div>
          </div>
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">总辅导时长</div>
            <div className="adm-stat-card__value">{data.reduce((a, b) => a + b.hours, 0)}h</div>
          </div>
        </div>

        {/* 柱状图 */}
        <div className="adm-chart-card" style={{ marginBottom: 24 }}>
          <h3>工作量对比</h3>
          <ReactECharts option={barOption} style={{ height: 360 }} />
        </div>

        {/* 明细表 */}
        <div className="adm-panel" style={{ overflow: 'hidden' }}>
          <div className="adm-panel__header">
            <span className="adm-panel__title">工作量明细</span>
            <button className="adm-btn adm-btn--outline adm-btn--sm" onClick={load}>刷新</button>
          </div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>教师</th>
                  <th>学员数</th>
                  <th>项目数</th>
                  <th>辅导次数</th>
                  <th>辅导时长(h)</th>
                  <th>情报报告</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.name}>
                    <td style={{ fontWeight: 600 }}>{row.name}</td>
                    <td>{row.students}</td>
                    <td>{row.projects}</td>
                    <td>{row.sessions}</td>
                    <td>{row.hours}</td>
                    <td>{row.intel_reports}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
  )
}
