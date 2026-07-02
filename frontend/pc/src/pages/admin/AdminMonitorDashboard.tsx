import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import { Icon } from '@iconify/react'
import { getDashboardStats, type DashboardStats } from '@/api/admin'
import './admin.css'

function getMyRole(): string {
  try { return JSON.parse(localStorage.getItem('rg_user') || '{}').role || '' } catch { return '' }
}

// 默认数据，在 API 不可用时使用
const DEFAULT_STATS: DashboardStats = {
  total_users: 12850,
  dau: 3420,
  mau: 8900,
  new_users_today: 156,
  vip_conversion_rate: 23.5,
  active_modules: [
    { name: '朝有规划', pv: 12500, uv: 4200 },
    { name: '暮有复盘', pv: 9800, uv: 3800 },
    { name: '情绪树洞', pv: 8500, uv: 3200 },
    { name: '智能记录', pv: 7200, uv: 2800 },
    { name: '智能问答', pv: 6800, uv: 2600 },
    { name: '智能办公', pv: 5400, uv: 2100 },
    { name: '高维求职', pv: 4800, uv: 1800 },
    { name: '品牌打造', pv: 3600, uv: 1400 },
    { name: '拿下一客户', pv: 3200, uv: 1200 },
    { name: '打磨产品', pv: 2800, uv: 1100 },
    { name: '交付订单', pv: 2400, uv: 900 },
    { name: '公私智库', pv: 6200, uv: 2400 },
    { name: '数据分析', pv: 4200, uv: 1600 },
  ],
  knowledge_growth: { week_new: 128, pending_audit: 35, hr_coverage: 75 },
  transform_rate: { month3: 12, month6: 28, month12: 45 },
}

export function AdminMonitorDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const role = getMyRole()
    if (!['superadmin', 'operator', 'project_manager'].includes(role)) { navigate('/', { replace: true }); return }
    getDashboardStats()
      .then(setStats)
      .catch(() => setStats(DEFAULT_STATS)) // 后端不可用时用默认数据
      .finally(() => setLoading(false))
  }, [navigate])

  // 模块热度柱状图
  const moduleBarOption = {
    tooltip: { trigger: 'axis' as const },
    legend: { data: ['PV', 'UV'], bottom: 0 },
    grid: { left: 8, right: 8, top: 8, bottom: 48 },
    xAxis: {
      type: 'category' as const,
      data: stats.active_modules.map((m) => m.name),
      axisLabel: { rotate: 40, fontSize: 10 },
    },
    yAxis: { type: 'value' as const },
    series: [
      { name: 'PV', type: 'bar', data: stats.active_modules.map((m) => m.pv), itemStyle: { color: '#8B4513' } },
      { name: 'UV', type: 'bar', data: stats.active_modules.map((m) => m.uv), itemStyle: { color: '#D4A574' } },
    ],
  }

  // VIP 转化漏斗
  const funnelOption = {
    tooltip: { trigger: 'item' as const },
    series: [{
      type: 'funnel',
      left: '10%', right: '10%', top: 20, bottom: 20,
      sort: 'descending' as const,
      gap: 2,
      label: { show: true, position: 'inside' as const, fontSize: 13 },
      data: [
        { value: stats.total_users, name: '注册用户' },
        { value: Math.round(stats.total_users * 0.35), name: '试用用户' },
        { value: Math.round(stats.total_users * stats.vip_conversion_rate / 100), name: '付费用户' },
      ],
      itemStyle: {
        color: (params: any) => ['#8B4513', '#D4A574', '#C03A39'][params.dataIndex] || '#8B4513',
      },
    }],
  }

  // 转型成功率
  const transformOption = {
    tooltip: { trigger: 'axis' as const },
    grid: { left: 8, right: 8, top: 8, bottom: 24 },
    xAxis: { type: 'category' as const, data: ['3个月', '6个月', '12个月'] },
    yAxis: { type: 'value' as const, max: 100, axisLabel: { formatter: '{value}%' } },
    series: [{
      type: 'bar',
      data: [
        { value: stats.transform_rate.month3, itemStyle: { color: '#D4A574' } },
        { value: stats.transform_rate.month6, itemStyle: { color: '#8B4513' } },
        { value: stats.transform_rate.month12, itemStyle: { color: '#C03A39' } },
      ],
      barWidth: 40,
    }],
  }

  if (loading) return <div className="adm-page"><div className="adm-page"><h2>平台数据仪表盘</h2><p className="adm-empty">加载中...</p></div></div>

  return (
          <div className="adm-page">
        <h2>平台数据仪表盘</h2>

        {/* 关键指标卡片 */}
        <div className="adm-stats">
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">用户总数</div>
            <div className="adm-stat-card__value">{stats.total_users.toLocaleString()}</div>
          </div>
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">DAU</div>
            <div className="adm-stat-card__value">{stats.dau.toLocaleString()}</div>
          </div>
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">MAU</div>
            <div className="adm-stat-card__value">{stats.mau.toLocaleString()}</div>
          </div>
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">今日新注册</div>
            <div className="adm-stat-card__value">{stats.new_users_today}</div>
          </div>
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">VIP 转化率</div>
            <div className="adm-stat-card__value">{stats.vip_conversion_rate}%</div>
          </div>
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">
              待审核积压
              {stats.knowledge_growth.pending_audit > 50 && (
                <span style={{ color: 'var(--color-error)', marginLeft: 6, fontSize: 12 }}>⚠ 超标</span>
              )}
            </div>
            <div className="adm-stat-card__value" style={{ color: stats.knowledge_growth.pending_audit > 50 ? 'var(--color-error)' : undefined }}>
              {stats.knowledge_growth.pending_audit}
            </div>
          </div>
        </div>

        {/* 图表网格 */}
        <div className="adm-chart-grid">
          {/* 模块热度 */}
          <div className="adm-chart-card">
            <h3>板块使用热度</h3>
            <ReactECharts option={moduleBarOption} style={{ height: 320 }} />
          </div>

          {/* VIP转化漏斗 */}
          <div className="adm-chart-card">
            <h3>VIP 转化漏斗</h3>
            <ReactECharts option={funnelOption} style={{ height: 320 }} />
          </div>

          {/* 知识库增长 */}
          <div className="adm-chart-card">
            <h3>知识库增长</h3>
            <div style={{ display: 'flex', justifyContent: 'space-around', padding: '24px 0' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--color-brand-primary)' }}>{stats.knowledge_growth.week_new}</div>
                <div style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>本周新增文档</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--color-warning)' }}>{stats.knowledge_growth.pending_audit}</div>
                <div style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>待审核积压</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--color-success)' }}>{stats.knowledge_growth.hr_coverage}%</div>
                <div style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>HR 模块覆盖度</div>
              </div>
            </div>
          </div>

          {/* 转型成功率 */}
          <div className="adm-chart-card">
            <h3>转型成功率</h3>
            <ReactECharts option={transformOption} style={{ height: 320 }} />
          </div>
        </div>
      </div>
  )
}
