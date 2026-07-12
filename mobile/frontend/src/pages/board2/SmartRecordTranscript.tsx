/**
 * 智能记录转写详情页 — 音频播放条 + 转写文本分段 + 生成萃取按钮。
 * Route: /m/smart-record/transcript?id=xxx
 * 严格对齐 m4p3-mobile.html 原型设计。
 *
 * 使用 sr-* BEM 类名（来自 smart-record.css）+ 内联 style。无 Tailwind CSS。
 * 图标使用 @iconify/react <Icon> 组件。返回按钮使用 navigate(-1)。
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '@iconify/react'
import { fetchTranscript, getAudioUrl, type TranscriptSegment } from '@/shared/api/recordings'
import './smart-record.css'

export function SmartRecordTranscript() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const recordingId = searchParams.get('id') || ''

  const [segments, setSegments] = useState<TranscriptSegment[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingExtraction, setLoadingExtraction] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [totalDuration, setTotalDuration] = useState(0)
  const [totalDurationStr, setTotalDurationStr] = useState('00:00')
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // 加载转写数据
  useEffect(() => {
    if (!recordingId) { setLoading(false); return }
    let cancelled = false
    async function load() {
      try {
        const data = await fetchTranscript(recordingId)
        if (!cancelled) {
          setSegments(data.segments || [])
          // 兼容后端 snake_case: duration_seconds → 前端 totalDuration
          const dur = (data as any).duration_seconds ?? (data as any).totalDuration
          if (dur) {
            const sec = typeof dur === 'number' ? dur : parseInt(String(dur), 10)
            if (!isNaN(sec)) {
              const m = Math.floor(sec / 60)
              const s = sec % 60
              setTotalDurationStr(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
            }
          }
        }
      } catch (err) {
        console.error('[SmartRecord] 获取转写失败, recordingId:', recordingId, err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [recordingId])

  // 音频时间更新 — 对齐原型 m4p3 L260-272
  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
      setTotalDuration(audioRef.current.duration || 0)
    }
  }, [])

  const handlePlay = () => {
    if (!audioRef.current) {
      const audio = new Audio(getAudioUrl(recordingId))
      audioRef.current = audio
      audio.addEventListener('timeupdate', handleTimeUpdate)
      audio.addEventListener('ended', () => setPlaying(false))
      audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    } else {
      if (playing) {
        audioRef.current.pause()
        setPlaying(false)
      } else {
        audioRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
      }
    }
  }

  const formatTime = (s: number) => {
    if (!isFinite(s)) return '00:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  // 生成萃取 — 对齐原型 m4p3 L282-286（3秒思考动画后跳转）
  const handleGenerateExtraction = () => {
    setLoadingExtraction(true)
    setTimeout(() => {
      navigate(`/m/smart-record/extract?id=${recordingId}`)
    }, 3000)
  }

  // 置信度颜色 — 对齐原型 m4p3 L217-223
  const confidenceStyle = (v: number): { color: string; bg: string } => {
    if (v >= 95) return { color: '#4CAF50', bg: '#E8F5E9' }
    if (v >= 70) return { color: '#FF9800', bg: '#FFF3E0' }
    return { color: '#F44336', bg: '#FFEBEE' }
  }

  return (
    <div data-module="smart-record" className="sr-page">

      {/* ═══ 页面头部 — 对齐原型 m4p3 L41-45 ═══ */}
      <header className="sr-page-header">
        <button className="sr-page-header__back" onClick={() => navigate(-1)}>
          <Icon icon="mingcute:left-line" />
        </button>
        <h1 className="sr-page-header__title">转写详情</h1>
        <div className="sr-page-header__spacer" />
      </header>

      {/* ═══ 音频播放条 — 对齐原型 m4p3 L48-63 ═══ */}
      <div className="sr-audio-bar">
        <div className="sr-audio-bar__inner">
          <button className="sr-play-btn" onClick={handlePlay}>
            <Icon
              icon={playing ? 'mingcute:pause-fill' : 'mingcute:play-fill'}
              style={{ color: '#FFFFFF', fontSize: 14 }}
            />
          </button>
          <div className="sr-audio-progress">
            <span className="sr-audio-time">{formatTime(currentTime)}</span>
            <div className="sr-audio-progress__track">
              <div
                className="sr-audio-progress__fill"
                style={{ width: `${totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0}%` }}
              />
            </div>
            <span className="sr-audio-time">{totalDuration > 0 ? formatTime(totalDuration) : totalDurationStr}</span>
          </div>
        </div>
      </div>

      {/* ═══ 内容区 — 对齐原型 m4p3 L66-94 ═══ */}
      <div className="sr-page-body sr-scrollbar-hide">

        {/* 品牌语 — 对齐原型 m4p3 L69-72 */}
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#333', margin: '0 0 2px 0' }}>日耕朝夕，耕愈工作，耕暖生活</p>
          <p style={{ fontSize: 12, color: '#666', margin: 0 }}>随时随地录，所言成资产</p>
        </div>

        {/* 转写文本列表 — 对齐原型 m4p3 L75-77, L188-255 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Icon icon="mingcute:loader-3-line" style={{ fontSize: 24, color: '#C03A39' }} className="sr-loading__spinner" />
          </div>
        ) : segments.length === 0 ? (
          <div className="sr-empty">
            <Icon icon="mingcute:file-text-line" style={{ fontSize: 28, color: '#D4C5B0', marginBottom: 8 }} />
            <p className="sr-empty__text">暂无转写内容</p>
            <p className="sr-empty__hint">录音结束后，转写结果将在此显示</p>
          </div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            {segments.map((seg, i) => {
              const cs = confidenceStyle(seg.confidence)
              const isCandidate = seg.is_candidate || seg.isCandidate || (seg as any).highlight
              const highlightColor = (seg as any).highlightColor || (isCandidate ? 'warm' : '')
              return (
                <div key={i} className="sr-segment">
                  <div className="sr-segment__header">
                    <Icon icon="mingcute:user-3-line" style={{ fontSize: 12, color: '#999' }} />
                    <span className="sr-segment__speaker">{seg.speaker}</span>
                    <span className="sr-segment__time">{seg.time}</span>
                  </div>
                  {isCandidate ? (
                    <div className={highlightColor === 'gray' ? 'sr-segment__bubble-gray' : 'sr-segment__bubble-warm'}>
                      <p className="sr-segment__text">{seg.text}</p>
                    </div>
                  ) : (
                    <p className="sr-segment__text">{seg.text}</p>
                  )}
                  {seg.confidence > 0 && (
                    <span
                      className="sr-segment__confidence"
                      style={{ color: cs.color, backgroundColor: cs.bg }}
                    >
                      {seg.confidence}%
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* 生成萃取按钮 — 对齐原型 m4p3 L80-93 */}
        <div style={{ textAlign: 'center', paddingBottom: 24 }}>
          {!loadingExtraction ? (
            <button className="sr-generate-btn" onClick={handleGenerateExtraction}>
              <Icon icon="mingcute:magic-line" />
              生成萃取
            </button>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div className="sr-loading">
                <Icon icon="mingcute:loader-3-fill" className="sr-loading__spinner" />
                <span className="sr-loading__text">小耕在整理思路...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
