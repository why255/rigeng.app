import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { transcriptData } from '@rigeng/shared/data/mock'
import { MAIN_SLOGAN } from '@rigeng/shared/data/modules'
import '../pages.css'
import './smart-record.css'

/** M4-P3 转写详情页（移动端） */
export function SmartRecordTranscript() {
  const navigate = useNavigate()
  const [playing, setPlaying] = useState(false)
  const [progress] = useState(0)
  const [loadingExtraction, setLoadingExtraction] = useState(false)

  const totalDuration = '12:30'

  const handlePlay = () => setPlaying(!playing)

  const handleGenerateExtraction = () => {
    setLoadingExtraction(true)
    setTimeout(() => {
      navigate('/m/smart-record/extract?id=demo')
    }, 3000)
  }

  const confidenceClass = (v: number) =>
    v >= 95 ? 'sr-segment__confidence--high' : 'sr-segment__confidence--mid'

  return (
    <PageContainer width="dashboard">
      <div data-module="smart-record">
        {/* 音频播放条（紧凑版） */}
        <div className="sr-audio-bar" style={{ padding: '8px 12px' }}>
          <div className="sr-audio-bar__inner">
            <button className="sr-play-btn" onClick={handlePlay} style={{ width: 36, height: 36, fontSize: 16 }}>
              {playing ? '⏸' : '▶'}
            </button>
            <div className="sr-audio-progress">
              <span className="sr-audio-time" style={{ fontSize: 11 }}>00:00</span>
              <div className="sr-audio-progress__track">
                <div className="sr-audio-progress__fill" style={{ width: `${progress}%` }} />
              </div>
              <span className="sr-audio-time" style={{ fontSize: 11 }}>{totalDuration}</span>
            </div>
          </div>
        </div>

        {/* 品牌标语（简写） */}
        <div style={{ marginBottom: 16, paddingTop: 12 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-neutral-900)' }}>{MAIN_SLOGAN}</p>
          <p style={{ fontSize: 13, color: '#666', marginTop: 2 }}>随时随地录，所言成资产</p>
        </div>

        {/* 转写文本分段 */}
        <div>
          {transcriptData.map((seg, i) => (
            <div key={i} className="sr-segment" style={{ padding: 12 }}>
              <div className="sr-segment__header">
                <span style={{ fontSize: 16 }}>👤</span>
                <span className="sr-segment__speaker" style={{ fontSize: 12 }}>{seg.speaker}</span>
                <span className="sr-segment__time" style={{ fontSize: 11 }}>[{seg.time}]</span>
              </div>
              {seg.isCandidate ? (
                <div className="sr-segment__bubble sr-segment__bubble--candidate">
                  <p className="sr-segment__text" style={{ fontSize: 13 }}>{seg.text}</p>
                </div>
              ) : (
                <p className="sr-segment__text" style={{ fontSize: 13 }}>{seg.text}</p>
              )}
              <span className={`sr-segment__confidence ${confidenceClass(seg.confidence)}`}>
                置信度 {seg.confidence}%
              </span>
            </div>
          ))}
        </div>

        {/* 生成萃取按钮 */}
        <div style={{ textAlign: 'center', paddingTop: 20, paddingBottom: 24 }}>
          {!loadingExtraction ? (
            <button className="sr-start-btn" onClick={handleGenerateExtraction} style={{ width: '100%', justifyContent: 'center' }}>
              ✨ 生成萃取
            </button>
          ) : (
            <div className="sr-loading">
              <span className="sr-loading__spinner">⏳</span>
              <span style={{ fontSize: 13, color: '#666' }}>小耕在整理思路...</span>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  )
}
