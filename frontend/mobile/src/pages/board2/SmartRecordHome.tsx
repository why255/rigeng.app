import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { Button } from '@rigeng/shared/components/primitives'
import { todayStats, recentRecordings } from '@rigeng/shared/data/mock'
import { MAIN_SLOGAN } from '@rigeng/shared/data/modules'
import '../pages.css'
import './smart-record.css'

const SCENES = [
  { key: '面试', icon: '👤', color: '#6B8FBF' },
  { key: '会议', icon: '📊', color: '#D4A574' },
  { key: '日常', icon: '💬', color: '#BCAAA4' },
  { key: '自定义', icon: '⚙️', color: '#E8A94D' },
]

/** M4-P1 智能记录首页（移动端） */
export function SmartRecordHome() {
  const navigate = useNavigate()
  const [showSceneModal, setShowSceneModal] = useState(false)
  const [selectedScene, setSelectedScene] = useState('')

  const handleStartRecording = () => {
    const scene = selectedScene || '面试'
    setShowSceneModal(false)
    navigate(`/m/smart-record/recording?scene=${encodeURIComponent(scene)}`)
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
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-500)', marginBottom: 6 }}>今日录音数</h3>
            <p className="sr-stat-card__value" style={{ fontSize: 26 }}>
              {todayStats.count} <span className="sr-stat-card__unit">段</span>
            </p>
          </div>
          <div className="sr-stat-card">
            <div className="sr-stat-card__icon" style={{ color: '#D4A574' }}>⏱️</div>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-500)', marginBottom: 6 }}>总时长</h3>
            <p className="sr-stat-card__value" style={{ fontSize: 26 }}>
              {todayStats.totalMinutes} <span className="sr-stat-card__unit">分钟</span>
            </p>
          </div>
        </div>

        {/* 开始录音按钮 */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <button className="sr-start-btn" onClick={() => setShowSceneModal(true)} style={{ width: '100%', justifyContent: 'center' }}>
            🎙️ 开始录音
          </button>
        </div>

        {/* 最近录音列表 */}
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-neutral-900)', marginBottom: 10 }}>最近录音</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentRecordings.map((rec) => (
              <div
                key={rec.id}
                className="sr-history-card"
                onClick={() => {
                  if (rec.status === 'completed') navigate(`/m/smart-record/transcript?id=${rec.id}`)
                }}
                style={{ padding: 12 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 999,
                      fontSize: 10,
                      fontWeight: 500,
                      color: 'white',
                      backgroundColor: rec.sceneColor,
                      flexShrink: 0,
                    }}
                  >
                    {rec.scene}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-neutral-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {rec.title}
                    </p>
                    <p style={{ fontSize: 12, color: '#999' }}>{rec.date}</p>
                  </div>
                  <span style={{ fontSize: 12, color: '#999' }}>{rec.duration}</span>
                  <span style={{ fontSize: 16, color: rec.status === 'completed' ? '#4CAF50' : '#F39C12' }}>
                    {rec.status === 'completed' ? '✅' : '🔄'}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <a
              style={{ fontSize: 12, color: '#999', cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => navigate('/m/smart-record/history')}
            >
              查看全部录音记录
            </a>
          </div>
        </div>

        {/* 场景选择弹窗 */}
        {showSceneModal && (
          <div className="sr-modal-mask" onClick={(e) => { if (e.target === e.currentTarget) setShowSceneModal(false) }}>
            <div className="sr-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 320 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-neutral-900)', marginBottom: 12 }}>选择录音场景</h3>
              <div className="sr-scene-grid">
                {SCENES.map((s) => (
                  <div
                    key={s.key}
                    className={`sr-scene-card ${selectedScene === s.key ? 'sr-scene-card--active' : ''}`}
                    onClick={() => setSelectedScene(s.key)}
                    style={{ padding: 12 }}
                  >
                    <span className="sr-scene-card__icon" style={{ fontSize: 20 }}>{s.icon}</span>
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
