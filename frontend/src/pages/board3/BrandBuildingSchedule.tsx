import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { useToast } from '@/components/primitives/toast'
import { pauseGeneration, resumeGeneration } from '@/api/brand'
import '../pages.css'
import './brand-building.css'

/** P3 日历 mock 数据 */
const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

interface ScheduleItem {
  title: string
  status: 'scheduled' | 'draft' | 'published'
  time?: string
}

const SCHEDULE_ITEMS: ScheduleItem[] = [
  { title: '从HR到HRBP，我的三年转型之路', status: 'scheduled', time: '08:00' },
  { title: '薪酬体系设计的三大底层逻辑', status: 'draft' },
  { title: '2024年HR趋势：数字化转型加速', status: 'published', time: '08:00' },
]

const STATUS_MAP: Record<ScheduleItem['status'], { label: string; cls: string }> = {
  scheduled: { label: '已排期', cls: 'bb-schedule-card__status--scheduled' },
  draft: { label: '草稿', cls: 'bb-schedule-card__status--draft' },
  published: { label: '已发布', cls: 'bb-schedule-card__status--published' },
}

/** 生成日历天数网格 */
function renderCalendarDays() {
  const daysInJune = 30
  const startDay = 1 // 2026-06-01 is Monday → offset 0
  const activeDay = 17
  const today = 23
  const contentDays = new Set([12, 17, 18, 19, 23])

  const cells: React.ReactNode[] = []
  // Empty cells for offset
  for (let i = 0; i < startDay; i++) {
    cells.push(<div key={`empty-${i}`} className="bb-cal-day" />)
  }
  for (let d = 1; d <= daysInJune; d++) {
    const isActive = d === activeDay
    const isToday = d === today
    const hasContent = contentDays.has(d)
    const cls = [
      'bb-cal-day',
      isActive && 'bb-cal-day--active',
      isToday && !isActive && 'bb-cal-day--today',
      hasContent && 'bb-cal-day--has-content',
    ]
      .filter(Boolean)
      .join(' ')
    cells.push(
      <div key={d} className={cls}>
        {d}
      </div>,
    )
  }
  return cells
}

/** M8-P3 公众号工作台 — 排期管理（即将上线） */
export function BrandBuildingSchedule() {
  const navigate = useNavigate()
  const toast = useToast()
  const [paused, setPaused] = useState(false)

  const handlePause = () => {
    pauseGeneration()
      .then(() => {
        setPaused(true)
        toast('已暂停内容生成', 'success')
      })
      .catch(() => toast('操作失败', 'error'))
  }

  const handleResume = () => {
    resumeGeneration()
      .then(() => {
        setPaused(false)
        toast('已恢复内容生成', 'success')
      })
      .catch(() => toast('操作失败', 'error'))
  }

  return (
    <PageContainer width="dashboard">
      <div data-module="brand-building">
        {/* 页面头部 */}
        <div className="bb-page-header">
          <p className="bb-slogan">日耕朝夕，耕愈工作，耕暖生活</p>
          <div className="bb-page-header__row">
            <h3 className="bb-brand-sub">踏实做自己，光芒自然来</h3>
            <span className="bb-page-badge">公众号工作台</span>
          </div>
        </div>

        {/* 灰置区域 */}
        <div className="bb-disabled-outer">
          <div className="bb-disabled-block">
            {/* 日历 */}
            <div className="bb-calendar-card">
              <div className="bb-calendar-header">
                <span className="bb-calendar-month">2026年6月</span>
                <div className="bb-calendar-nav">
                  <button className="bb-calendar-nav-btn">‹</button>
                  <button className="bb-calendar-nav-btn" style={{ fontSize: 'var(--font-size-l7)', width: 'auto', padding: '0 12px' }}>今日</button>
                  <button className="bb-calendar-nav-btn">›</button>
                </div>
              </div>
              <div className="bb-calendar-weekdays">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="bb-calendar-weekday">{w}</div>
                ))}
              </div>
              <div className="bb-calendar-grid">{renderCalendarDays()}</div>
            </div>

            {/* 排期内容列表 */}
            <div className="bb-calendar-card" style={{ marginBottom: 0 }}>
              <div style={{ fontSize: 'var(--font-size-l5)', fontWeight: 'var(--font-weight-bold)', color: '#333', marginBottom: 16 }}>
                📋 6月17日 · 排期内容
              </div>
              <div className="bb-schedule-list">
                {SCHEDULE_ITEMS.map((item) => {
                  const st = STATUS_MAP[item.status]
                  return (
                    <div key={item.title} className="bb-schedule-card">
                      <span className={`bb-schedule-card__status ${st.cls}`}>{st.label}</span>
                      <div className="bb-schedule-card__info">
                        <div className="bb-schedule-card__title">{item.title}</div>
                        {item.time && (
                          <div className="bb-schedule-card__time">⏰ {item.time} 发布</div>
                        )}
                      </div>
                      <div className="bb-schedule-card__actions">
                        <button className="bb-schedule-card__action">👁️</button>
                        <button className="bb-schedule-card__action">✏️</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* 即将上线徽章 */}
          <div className="bb-disabled-badge">
            即将上线
            <div className="bb-disabled-sub">敬请期待，正在全力开发中</div>
          </div>
        </div>

        {/* 遮罩外按钮 */}
        <div className="bb-disabled-nav">
          <button className="bb-disabled-nav-btn" onClick={() => navigate('/m/brand-building/generate')}>
            去生成新内容 →
          </button>
          <button
            className="bb-disabled-nav-btn"
            style={{ marginLeft: 12 }}
            onClick={paused ? handleResume : handlePause}
          >
            {paused ? '▶️ 恢复生成' : '⏸️ 暂停生成'}
          </button>
        </div>

        <div className="bb-back-link" onClick={() => navigate('/m/brand-building')}>
          ← 返回品牌打造中心
        </div>
      </div>
    </PageContainer>
  )
}
