import { useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import '../pages.css'
import './brand-building.css'

/** M8 品牌打造中心数据常量（后续迁移到 mock.ts） */
const STATS = {
  courageValue: 128,
  courageMax: 500,
  nextTier: '持续发光者',
  articlesNeeded: 2,
  weeklyPublished: 3,
  weeklyTarget: 5,
}

const SOP = {
  title: '分享一个职场成长小故事',
  source: '携君库模板 / 系统推荐',
  tags: ['职场成长', '个人品牌'],
}

const QUICK_ENTRIES = [
  { icon: '✍️', label: '内容生成', desc: 'AI 帮你写公众号', path: '/m/brand-building/generate', disabled: false },
  { icon: '📅', label: '排期管理', desc: '公众号工作台', path: '/m/brand-building/schedule', disabled: false },
  { icon: '📊', label: '数据看板', desc: '品牌数据洞察', path: '/m/brand-building/data', disabled: false },
  { icon: '🔍', label: '内容复盘', desc: '效果分析与优化', disabled: true },
]

/** M8-P1 品牌打造中心入口 — 概览仪表盘 + 快捷入口 */
export function BrandBuildingEntry() {
  const navigate = useNavigate()
  const weeklyPercent = Math.round((STATS.weeklyPublished / STATS.weeklyTarget) * 100)
  const couragePercent = Math.round((STATS.courageValue / STATS.courageMax) * 100)

  return (
    <PageContainer width="dashboard">
      <div data-module="brand-building">
        {/* 品牌标语 */}
        <p className="bb-slogan">日耕朝夕，耕愈工作，耕暖生活</p>
        <h1 className="bb-brand-title">踏实做自己，光芒自然来</h1>

        {/* SOP 推荐卡片 */}
        <div className="bb-sop-card" onClick={() => navigate('/m/brand-building/generate')}>
          <div className="bb-sop-card__left">
            <div className="bb-sop-card__icon">💡</div>
            <div className="bb-sop-card__info">
              <div className="bb-sop-card__title">今日推荐：{SOP.title}</div>
              <div className="bb-sop-card__meta">
                <span className="bb-sop-card__source">{SOP.source}</span>
                {SOP.tags.map((t) => (
                  <span key={t} className="bb-sop-tag">{t}</span>
                ))}
              </div>
            </div>
          </div>
          <button className="bb-sop-card__btn">去生成 →</button>
        </div>

        {/* 双列统计卡片 */}
        <div className="pg-grid-2" style={{ marginBottom: 4 }}>
          <div className="bb-stat-card">
            <div className="bb-stat-card__label">✨ 勇气值</div>
            <div className="bb-stat-card__row">
              <span className="bb-stat-card__number">{STATS.courageValue}</span>
              <span className="bb-stat-card__unit">/ {STATS.courageMax}</span>
            </div>
            <div className="bb-stat-card__bar">
              <div className="bb-stat-card__bar-fill" style={{ width: `${couragePercent}%` }} />
            </div>
            <div className="bb-stat-card__hint">
              🚩 再发布 {STATS.articlesNeeded} 篇解锁「{STATS.nextTier}」
            </div>
          </div>

          <div className="bb-stat-card">
            <div className="bb-stat-card__label">📝 本周发布进度</div>
            <div className="bb-stat-card__row">
              <span className="bb-stat-card__number">{STATS.weeklyPublished}</span>
              <span className="bb-stat-card__unit">/ {STATS.weeklyTarget} 篇</span>
            </div>
            <div className="bb-stat-card__bar">
              <div className="bb-stat-card__bar-fill" style={{ width: `${weeklyPercent}%` }} />
            </div>
            <div className="bb-stat-card__hint">
              {weeklyPercent >= 100 ? '🎉 本周目标已完成！' : `完成度 ${weeklyPercent}%，继续加油`}
            </div>
          </div>
        </div>

        {/* 快捷入口网格 */}
        <div className="bb-quick-grid">
          {QUICK_ENTRIES.map((entry) => (
            <div
              key={entry.label}
              className={`bb-quick-item ${entry.disabled ? 'bb-quick-item--disabled' : ''}`}
              onClick={() => { if (!entry.disabled && entry.path) navigate(entry.path) }}
            >
              <span className="bb-quick-item__icon">{entry.icon}</span>
              <span className="bb-quick-item__label">{entry.label}</span>
              <span className="bb-quick-item__desc">
                {entry.disabled ? '即将上线' : entry.desc}
              </span>
            </div>
          ))}
        </div>
      </div>
    </PageContainer>
  )
}
