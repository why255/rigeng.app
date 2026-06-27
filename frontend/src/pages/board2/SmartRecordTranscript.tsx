import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { getTranscript } from '@/api/recordings'
import { transcriptData } from '@/data/mock'
import { MAIN_SLOGAN } from '@/data/modules'
import type { TranscriptSegment } from '@/data/mock'
import '../pages.css'
import './smart-record.css'

/** M4-P3 转写详情页 — 音频播放 + 说话人分段 + 生成萃取 */
export function SmartRecordTranscript() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const recordingId = searchParams.get('id') || 'demo'

  const [playing, setPlaying] = useState(false)
  const [progress] = useState(0)
  const [loadingExtraction, setLoadingExtraction] = useState(false)
  const [segments, setSegments] = useState<TranscriptSegment[]>(transcriptData)
  const [title] = useState('录音转写')
  const [totalDuration, setTotalDuration] = useState('12:30')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (recordingId === 'demo') {
      setIsLoading(false)
      return
    }

    getTranscript(recordingId)
      .then((result) => {
        if (result) {
          setSegments(result.segments || transcriptData)
          // 从分段时间计算总时长
          const segs = result.segments || transcriptData
          if (segs.length > 0) {
            const lastSeg = segs[segs.length - 1]
            const totalSec = lastSeg ? Math.ceil((parseInt(lastSeg.time || '0') || 0) / 1000) : 0
            const m = Math.floor(totalSec / 60)
            const s = totalSec % 60
            setTotalDuration(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
          }
        }
      })
      .catch(() => {
        // 降级使用mock数据
      })
      .finally(() => setIsLoading(false))
  }, [recordingId])

  const handlePlay = () => {
    setPlaying(!playing)
  }

  const handleGenerateExtraction = () => {
    setLoadingExtraction(true)
    setTimeout(() => {
      navigate(`/m/smart-record/extract?id=${recordingId}`)
    }, 3000)
  }

  const confidenceClass = (v: number) =>
    v >= 95 ? 'sr-segment__confidence--high' : 'sr-segment__confidence--mid'

  if (isLoading) {
    return (
      <PageContainer width="dashboard">
        <div className="sr-loading">
          <span className="sr-loading__spinner">⏳</span>
          <span style={{ fontSize: 14, color: '#666' }}>加载转写结果...</span>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer width="dashboard">
      <div data-module="smart-record">
        {/* 音频播放条 */}
        <div className="sr-audio-bar">
          <div className="sr-audio-bar__inner">
            <button className="sr-play-btn" onClick={handlePlay}>
              {playing ? '⏸' : '▶'}
            </button>
            <div className="sr-audio-progress">
              <span className="sr-audio-time">00:00</span>
              <div className="sr-audio-progress__track">
                <div className="sr-audio-progress__fill" style={{ width: `${progress}%` }} />
              </div>
              <span className="sr-audio-time">{totalDuration}</span>
            </div>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--color-neutral-500)' }}>
              📊 波形
            </span>
          </div>
        </div>

        {/* 品牌标语 */}
        <div style={{ marginBottom: 24, paddingTop: 16 }}>
          <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-neutral-900)' }}>{MAIN_SLOGAN}</p>
          <p style={{ fontSize: 14, color: '#666', marginTop: 4 }}>随时随地录，所言成资产</p>
          <p style={{ fontSize: 13, color: 'var(--color-neutral-500)', marginTop: 4 }}>{title}</p>
        </div>

        {/* 转写文本分段 */}
        <div>
          {segments.map((seg, i) => (
            <div key={i} className="sr-segment">
              <div className="sr-segment__header">
                <span>👤</span>
                <span className="sr-segment__speaker">{seg.speaker}</span>
                <span className="sr-segment__time">[{seg.time}]</span>
              </div>
              {seg.isCandidate ? (
                <div className="sr-segment__bubble sr-segment__bubble--candidate">
                  <p className="sr-segment__text">{seg.text}</p>
                </div>
              ) : (
                <p className="sr-segment__text">{seg.text}</p>
              )}
              <span className={`sr-segment__confidence ${confidenceClass(seg.confidence)}`}>
                置信度 {seg.confidence}%
              </span>
            </div>
          ))}
        </div>

        {/* 生成萃取按钮 */}
        <div style={{ textAlign: 'center', paddingTop: 24, paddingBottom: 32 }}>
          {!loadingExtraction ? (
            <button className="sr-start-btn" onClick={handleGenerateExtraction}>
              ✨ 生成萃取
            </button>
          ) : (
            <div className="sr-loading">
              <span className="sr-loading__spinner">⏳</span>
              <span style={{ fontSize: 14, color: '#666' }}>小耕在整理思路...</span>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  )
}
