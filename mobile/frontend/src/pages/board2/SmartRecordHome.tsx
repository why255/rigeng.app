/**
 * 智能记录首页 — 概览卡片 + 开始录音 + 最近录音列表 + 场景选择弹窗。
 * Route: /m/smart-record
 * 严格对齐 m4p1-mobile.html 原型设计。
 *
 * 使用 sr-* BEM 类名（来自 smart-record.css）+ 内联 style。无 Tailwind CSS。
 * 图标使用 @iconify/react <Icon> 组件。返回按钮使用 navigate(-1)。
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'
import { fetchTodayStats, fetchRecentRecordings, type TodayStats, type Recording } from '@/shared/api/recordings'
import './smart-record.css'

const SCENES = [
  { key: '面试', icon: 'mingcute:user-3-line', color: '#6B8FBF' },
  { key: '会议', icon: 'mingcute:presentation-1-line', color: '#D4A574' },
  { key: '日常', icon: 'mingcute:chat-1-line', color: '#BCAAA4' },
  { key: '自定义', icon: 'mingcute:settings-2-line', color: '#E8A94D' },
]

const SCENE_COLORS: Record<string, string> = {
  '面试': '#6B8FBF',
  '会议': '#D4A574',
  '日常': '#BCAAA4',
  '自定义': '#E8A94D',
}

export function SmartRecordHome() {
  const navigate = useNavigate()
  const [showSceneModal, setShowSceneModal] = useState(false)
  const [selectedScene, setSelectedScene] = useState('')
  const [stats, setStats] = useState<TodayStats>({ count: 0, totalMinutes: 0 })
  const [recentRecordings, setRecentRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [s, r] = await Promise.all([
        fetchTodayStats(),
        fetchRecentRecordings(),
      ])
      setStats(s)
      setRecentRecordings(Array.isArray(r) ? r : [])
    } catch {
      // 加载失败显示空状态
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleStartRecording = (scene?: string) => {
    const s = scene || selectedScene || '面试'
    setShowSceneModal(false)
    navigate(`/m/smart-record/recording?scene=${encodeURIComponent(s)}`)
  }

  const handleSkipScene = () => {
    setShowSceneModal(false)
    navigate('/m/smart-record/recording?scene=面试')
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return 'mingcute:check-circle-fill'
      case 'extracted': return 'mingcute:star-fill'
      case 'transcribing': return 'mingcute:loader-3-line'
      case 'extracting': return 'mingcute:loader-3-line'
      default: return 'mingcute:close-circle-line'
    }
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#4CAF50'
      case 'extracted': return '#E8A94D'
      case 'transcribing': return '#D4A574'
      case 'extracting': return '#D4A574'
      case 'failed': return '#F44336'
      default: return '#999'
    }
  }

  return (
    <div data-module="smart-record" className="sr-page">

      {/* ═══ 页面头部 ═══ */}
      <header className="sr-page-header">
        <button className="sr-page-header__back" onClick={() => navigate(-1)}>
          <Icon icon="mingcute:left-line" />
        </button>
        <h1 className="sr-page-header__title">智能记录</h1>
        <div className="sr-page-header__spacer" />
      </header>

      {/* ═══ 内容区 ═══ */}
      <div className="sr-page-body sr-scrollbar-hide">

        {/* 品牌标语 — 对齐原型 m4p1 L71-74 */}
        <div className="sr-brand">
          <p className="sr-brand__main">日耕朝夕，耕愈工作，耕暖生活</p>
        </div>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h1 className="sr-brand__sub">随时随地录，所言成资产</h1>
        </div>

        {/* 概览卡片 — 对齐原型 m4p1 L77-92 */}
        <div className="sr-stats">
          <div className="sr-stat-card">
            <div className="sr-stat-card__header">
              <Icon icon="mingcute:mic-line" style={{ fontSize: 18, color: '#C03A39' }} />
              <span className="sr-stat-card__label">今日录音数</span>
            </div>
            <p className="sr-stat-card__value">
              {stats.count} <span className="sr-stat-card__unit">段</span>
            </p>
          </div>
          <div className="sr-stat-card">
            <div className="sr-stat-card__header">
              <Icon icon="mingcute:time-line" style={{ fontSize: 18, color: '#D4A574' }} />
              <span className="sr-stat-card__label">总时长</span>
            </div>
            <p className="sr-stat-card__value">
              {stats.totalMinutes} <span className="sr-stat-card__unit">分钟</span>
            </p>
          </div>
        </div>

        {/* 开始录音按钮 — 对齐原型 m4p1 L95-99 */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <button
            className="sr-start-btn"
            onClick={() => setShowSceneModal(true)}
          >
            <Icon icon="mingcute:mic-line" />
            开始录音
          </button>
        </div>

        {/* 最近录音列表 — 对齐原型 m4p1 L133-143 */}
        <div className="sr-recent">
          <div className="sr-recent__header">
            <h3 className="sr-recent__title">最近录音</h3>
          </div>
          {!loading && recentRecordings.length === 0 ? (
            <div className="sr-empty">
              <div className="sr-empty-icon" style={{ display: 'inline-block', marginBottom: 12 }}>
                <Icon icon="mingcute:mic-off-line" style={{ fontSize: 36, color: '#D4C5B0' }} />
              </div>
              <p className="sr-empty__text">暂无录音记录</p>
              <p className="sr-empty__hint">点击上方「开始录音」创建第一条记录</p>
            </div>
          ) : (
            <div>
              {recentRecordings.map((rec) => (
                <div
                  key={rec.id}
                  className="sr-recording-item"
                  onClick={() => {
                    if (rec.status === 'completed' || rec.status === 'extracted') {
                      navigate(`/m/smart-record/transcript?id=${rec.id}`)
                    }
                  }}
                >
                  <span
                    className="sr-recording-item__tag"
                    style={{ backgroundColor: SCENE_COLORS[rec.scene] || '#6B8FBF' }}
                  >
                    {rec.scene}
                  </span>
                  <div className="sr-recording-item__info">
                    <p className="sr-recording-item__title">{rec.title}</p>
                    <p className="sr-recording-item__date">{rec.date}</p>
                  </div>
                  <span className="sr-recording-item__duration">{rec.duration}</span>
                  {rec.status === 'recording' ? (
                    <span className="sr-recording-item__recording-dot" />
                  ) : (
                    <Icon icon={statusIcon(rec.status)} style={{ fontSize: 16, color: statusColor(rec.status) }} />
                  )}
                </div>
              ))}
            </div>
          )}
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button
              className="sr-recent__link"
              onClick={() => navigate('/m/smart-record/history')}
            >
              查看全部录音记录
            </button>
          </div>
        </div>

      </div>

      {/* ═══ 场景选择弹窗 — 对齐原型 m4p1 L102-130 ═══ */}
      {/* 放在 sr-page-body 外面，避免 overflow/stacking 影响 fixed 定位 */}
      {showSceneModal && (
        <div
          className="sr-modal-mask"
          onClick={(e) => { if (e.target === e.currentTarget) setShowSceneModal(false) }}
        >
          <div className="sr-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="sr-modal__title">选择录音场景</h3>
            <div className="sr-scene-grid">
              {SCENES.map((s) => (
                <div
                  key={s.key}
                  className={`sr-scene-card ${selectedScene === s.key ? 'sr-scene-card--active' : ''}`}
                  onClick={() => {
                    setSelectedScene(s.key)
                    setTimeout(() => handleStartRecording(s.key), 300)
                  }}
                >
                  <Icon icon={s.icon} style={{ fontSize: 20, color: s.color }} />
                  <span className="sr-scene-card__label">{s.key}</span>
                </div>
              ))}
            </div>
            <button className="sr-modal__skip" onClick={handleSkipScene}>
              直接开始（跳过选择）
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
