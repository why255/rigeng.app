import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import '../pages.css'
import './brand-building.css'

/** P4 数据 mock */
const METRICS = [
  { key: 'published', label: '发布篇数', value: 12, trend: '+20%', trendUp: true },
  { key: 'reads', label: '阅读总数', value: 3400, trend: '+15%', trendUp: true },
  { key: 'likes', label: '点赞总数', value: 286, trend: '+8%', trendUp: true },
  { key: 'shares', label: '分享总数', value: 45, trend: '+12%', trendUp: true },
]

const COURAGE_TREND = [
  { date: '6/17', value: 40 },
  { date: '6/18', value: 55 },
  { date: '6/19', value: 50 },
  { date: '6/20', value: 70 },
  { date: '6/21', value: 65 },
  { date: '6/22', value: 85 },
  { date: '6/23', value: 100 },
]

const QUALITY_SCORES = [
  { label: '内容深度', score: 88 },
  { label: '调性匹配', score: 92 },
  { label: '互动率', score: 75 },
  { label: '持续度', score: 85 },
  { label: '专业度', score: 90 },
]

const PERIODS = [
  { key: '7d', label: '最近7天' },
  { key: '30d', label: '最近30天' },
  { key: '90d', label: '最近90天' },
]

/** 质量条颜色 */
function qualityColor(score: number): string {
  if (score >= 90) return '#4CAF50'
  if (score >= 80) return 'var(--module-color-accent)'
  if (score >= 70) return '#FF9800'
  return '#F44336'
}

/** M8-P4 品牌数据 — 数据看板（即将上线） */
export function BrandBuildingData() {
  const navigate = useNavigate()
  const [activePeriod, setActivePeriod] = useState('7d')

  return (
    <PageContainer width="dashboard">
      <div data-module="brand-building">
        {/* 页面头部 */}
        <div className="bb-page-header">
          <p className="bb-slogan">日耕朝夕，耕愈工作，耕暖生活</p>
          <div className="bb-page-header__row">
            <h3 className="bb-brand-sub">踏实做自己，光芒自然来</h3>
            <span className="bb-page-badge">品牌数据</span>
          </div>
        </div>

        {/* 灰置区域 */}
        <div className="bb-disabled-outer">
          <div className="bb-disabled-block">
            {/* 时间段标签 */}
            <div className="bb-period-bar">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  className={`bb-period-tab ${activePeriod === p.key ? 'bb-period-tab--active' : ''}`}
                  onClick={() => setActivePeriod(p.key)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* 4 列指标卡片 */}
            <div className="bb-metric-grid">
              {METRICS.map((m) => (
                <div key={m.key} className="bb-metric-card">
                  <div className="bb-metric-card__label">{m.label}</div>
                  <div className="bb-metric-card__row">
                    <span className="bb-metric-card__value">{m.value.toLocaleString()}</span>
                    <span className={`bb-metric-card__trend ${m.trendUp ? 'bb-metric-card__trend--up' : 'bb-metric-card__trend--down'}`}>
                      {m.trend}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* 双栏：勇气值看板 + 内容质量分析 */}
            <div className="bb-p4-split">
              {/* 左：勇气值看板 */}
              <div className="bb-panel">
                <div className="bb-panel__title">✨ 勇气值看板</div>
                <div className="bb-courage-big">128 / 500</div>
                <div className="bb-courage-sub">当前等级：发光者</div>
                <div className="bb-courage-rank">🏆 全站 Top 20%</div>

                {/* 7日趋势柱状图 */}
                <div className="bb-trend-chart">
                  {COURAGE_TREND.map((d) => (
                    <div
                      key={d.date}
                      className="bb-trend-bar"
                      style={{ height: `${d.value}%` }}
                      title={`${d.date}: ${d.value}`}
                    />
                  ))}
                </div>
                <div className="bb-trend-labels">
                  {COURAGE_TREND.map((d) => (
                    <span key={d.date} className="bb-trend-label">{d.date}</span>
                  ))}
                </div>
              </div>

              {/* 右：内容质量分析 */}
              <div className="bb-panel">
                <div className="bb-panel__title">📈 内容质量分析</div>
                <div className="bb-quality-list">
                  {QUALITY_SCORES.map((q) => (
                    <div key={q.label} className="bb-quality-item">
                      <div className="bb-quality-item__header">
                        <span className="bb-quality-item__label">{q.label}</span>
                        <span className="bb-quality-item__score">{q.score}</span>
                      </div>
                      <div className="bb-quality-bar">
                        <div
                          className="bb-quality-bar__fill"
                          style={{ width: `${q.score}%`, background: qualityColor(q.score) }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="bb-quality-tip">
                  💡 互动率有提升空间，尝试在结尾加入提问或投票互动
                </div>
              </div>
            </div>
          </div>

          {/* 即将上线徽章 */}
          <div className="bb-disabled-badge">
            即将上线
            <div className="bb-disabled-sub">数据分析系统升级中</div>
          </div>
        </div>

        {/* 遮罩外按钮 */}
        <div className="bb-disabled-nav">
          <button className="bb-disabled-nav-btn" onClick={() => navigate('/m/data-analytics')}>
            查看详细内容复盘 →
          </button>
        </div>

        <div className="bb-back-link" onClick={() => navigate('/m/brand-building')}>
          ← 返回品牌打造中心
        </div>
      </div>
    </PageContainer>
  )
}
