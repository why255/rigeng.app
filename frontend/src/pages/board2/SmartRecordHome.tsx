import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { Button } from '@/components/primitives'
import { getTodayStats, getRecentRecordings } from '@/api/recordings'
import { todayStats, recentRecordings } from '@/data/mock'
import { MAIN_SLOGAN } from '@/data/modules'
import type { Recording } from '@/data/mock'
import '../pages.css'
import './smart-record.css'

/** M4-P1 智能记录首页 — 概览 + 开始录音 + 最近录音列表 */
export function SmartRecordHome() {
  const navigate = useNavigate()
  const [showSceneModal, setShowSceneModal] = useState(false)
  const [selectedScene, setSelectedScene] = useState('')
  const [stats, setStats] = useState(todayStats)
  const [recordings, setRecordings] = useState<Recording[]>(recentRecordings)

  useEffect(() => {
    // 尝试从API加载，失败则保持mock数据
    getTodayStats()
      .then((data) => {
        if (data) setStats(data)
      })
      .catch(() => {})
    getRecentRecordings()
      .then((data) => {
        if (data && data.length > 0) setRecordings(data)
      })
      .catch(() => {})
  }, [])

  const scenes = [
    { key: '面试', icon: '👤', color: '#6B8FBF' },
    { key: '会议', icon: '📊', color: '#D4A574' },
    { key: '日常', icon: '💬', color: '#BCAAA4' },
    { key: '自定义', icon: '⚙️', color: '#E8A94D' },
  ]

  const handleStartRecording = () => {
    const scene = selectedScene || '面试'
    setShowSceneModal(false)
    navigate(`/m/smart-record/recording?scene=${encodeURIComponent(scene)}`)
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✅'
      case 'extracting': return '🔄'
      case 'transcribing': return '🔄'
      default: return '⏳'
    }
  }

  const statusLabel = (status: string) => {
    switch (status) {
      case 'completed': return '录音完成'
      case 'extracting': return '萃取中'
      case 'transcribing': return '转写中'
      case 'failed': return '失败'
      default: return '等待中'
    }
  }

  return (
    <PageContainer width="dashboard">
      <div data-module="smart-record">
        {/* 品牌标语 */}
        <div className="sr-brand">
          <p className="sr-brand__main">{MAIN_SLOGAN}</p>
          <div className="sr-brand__divider" />
          <h1 className="sr-brand__title">随时随地录，所言成资产</h1>
        </div>

        {/* 概览卡片 */}
        <div className="sr-stats">
          <div className="sr-stat-card">
            <div className="sr-stat-card__icon" style={{ color: '#C03A39' }}>🎙️</div>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-neutral-500)', marginBottom: 8 }}>今日录音数</h3>
            <p className="sr-stat-card__value">
              {stats.count} <span className="sr-stat-card__unit">段</span>
            </p>
          </div>
          <div className="sr-stat-card">
            <div className="sr-stat-card__icon" style={{ color: '#D4A574' }}>⏱️</div>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-neutral-500)', marginBottom: 8 }}>总时长</h3>
            <p className="sr-stat-card__value">
              {stats.totalMinutes} <span className="sr-stat-card__unit">分钟</span>
            </p>
          </div>
        </div>

        {/* 开始录音按钮 */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <button className="sr-start-btn" onClick={() => setShowSceneModal(true)}>
            🎙️ 开始录音
          </button>
        </div>

        {/* 最近录音列表 */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-neutral-900)' }}>最近录音</h3>
            <a
              style={{ fontSize: 12, color: 'var(--module-color-primary)', cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => navigate('/m/smart-record/history')}
            >
              查看全部
            </a>
          </div>
          <div>
            {recordings.map((rec) => (
              <div
                key={rec.id}
                className="sr-history-card"
                onClick={() => {
                  if (rec.status === 'completed') navigate(`/m/smart-record/transcript?id=${rec.id}`)
                  else if (rec.status === 'extracting') navigate(`/m/smart-record/extract?id=${rec.id}`)
                }}
              >
                <div className="sr-history-card__header">
                  <div className="sr-history-card__left">
                    <span
                      className="sr-history-card__scene"
                      style={{ backgroundColor: rec.sceneColor }}
                    >
                      {rec.scene}
                    </span>
                    <span className="sr-history-card__title">{rec.title}</span>
                  </div>
                  <span className="sr-history-card__date">{rec.date}</span>
                </div>
                <div className="sr-history-card__footer">
                  <span className="sr-history-card__duration">{rec.duration}</span>
                  <span className={`sr-history-card__status ${rec.status === 'completed' ? 'sr-history-card__status--done' : 'sr-history-card__status--transcribing'}`}>
                    {statusIcon(rec.status)}
                    {statusLabel(rec.status)}
                  </span>
                </div>
                {rec.progress !== undefined && rec.status !== 'completed' && (
                  <div className="sr-history-card__progress">
                    <div
                      className="sr-history-card__progress-fill"
                      style={{ width: `${rec.progress}%`, backgroundColor: '#D4A574' }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 场景选择弹窗 */}
        {showSceneModal && (
          <div className="sr-modal-mask" onClick={(e) => { if (e.target === e.currentTarget) setShowSceneModal(false) }}>
            <div className="sr-modal" onClick={(e) => e.stopPropagation()}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-neutral-900)', marginBottom: 16 }}>选择录音场景</h3>
              <div className="sr-scene-grid">
                {scenes.map((s) => (
                  <div
                    key={s.key}
                    className={`sr-scene-card ${selectedScene === s.key ? 'sr-scene-card--active' : ''}`}
                    onClick={() => setSelectedScene(s.key)}
                  >
                    <span className="sr-scene-card__icon">{s.icon}</span>
                    <span className="sr-scene-card__label">{s.key}</span>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: 'center' }}>
                <Button onClick={handleStartRecording}>开始录音</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  )
}
