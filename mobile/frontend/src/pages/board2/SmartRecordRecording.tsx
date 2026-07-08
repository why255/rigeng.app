/**
 * 智能记录录音中页面 — 计时器 + 波形图 + 停止按钮 + 实时转写预览。
 * Route: /m/smart-record/recording?scene=xxx
 * 严格对齐 m4p2-mobile.html 原型设计。
 *
 * 使用 sr-* BEM 类名（来自 smart-record.css）+ 内联 style。无 Tailwind CSS。
 * 图标使用 @iconify/react <Icon> 组件。返回按钮使用 navigate(-1)。
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '@iconify/react'
import { startRecording, stopRecording, uploadAudioChunk } from '@/shared/api/recordings'
import './smart-record.css'

const SCENE_COLORS: Record<string, string> = {
  '面试': '#6B8FBF',
  '会议': '#D4A574',
  '日常': '#BCAAA4',
  '自定义': '#E8A94D',
}

export function SmartRecordRecording() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const scene = searchParams.get('scene') || '面试'
  const sceneColor = SCENE_COLORS[scene] || '#6B8FBF'

  const [seconds, setSeconds] = useState(0)
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [transcriptLines, setTranscriptLines] = useState<string[]>([])
  const [initError, setInitError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const stoppingRef = useRef(false)

  // 开始录音 — 对齐原型 m4p2 L136-236
  const beginRecording = useCallback(async () => {
    setInitError(null)
    setIsStarting(true)
    let cancelled = false

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }

      const { recordingId: recId } = await startRecording(scene as '面试' | '会议' | '日常' | '自定义')
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      setRecordingId(recId)
      setIsStarting(false)

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
      })
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = async (e) => {
        if (e.data.size > 0 && recId) {
          try {
            await uploadAudioChunk(recId, e.data)
          } catch {
            // 上传失败不影响录音继续
          }
        }
      }

      mediaRecorder.start(5000)
    } catch (err: any) {
      if (!cancelled) {
        setIsStarting(false)
        // 不再跳回首页！直接在当前页展示错误并允许重试
        const msg = err?.name === 'NotAllowedError'
          ? '麦克风权限被拒绝，请在浏览器设置中允许麦克风访问后重试'
          : err?.name === 'NotFoundError'
            ? '未检测到麦克风设备，请连接麦克风后重试'
            : '录音启动失败，请检查设备权限后重试'
        setInitError(msg)
      }
    }

    return () => { cancelled = true }
  }, [scene])

  useEffect(() => {
    const cleanup = beginRecording()
    return () => {
      cleanup.then((fn) => fn?.())
    }
  }, [beginRecording])

  // 计时器 — 对齐原型 m4p2 L230-236
  useEffect(() => {
    if (initError || isStarting) return // 有错误或还在初始化时不启动计时器
    intervalRef.current = setInterval(() => {
      setSeconds((s) => s + 1)
    }, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [initError, isStarting])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  // 停止录音 → 跳转转写详情 — 对齐原型 m4p2 L241-244
  const handleStop = useCallback(async () => {
    if (stoppingRef.current) return
    stoppingRef.current = true

    if (intervalRef.current) clearInterval(intervalRef.current)

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop())
    }

    if (recordingId) {
      try {
        await stopRecording(recordingId)
      } catch {
        // 即使API失败也跳转
      }
    }

    navigate(`/m/smart-record/transcript?id=${recordingId || 'demo'}`)
  }, [recordingId, navigate])

  return (
    <div data-module="smart-record" className="sr-page">

      {/* ═══ 页面头部 — 对齐原型 m4p2 L91-95 ═══ */}
      <header className="sr-page-header">
        <button className="sr-page-header__back" onClick={() => navigate(-1)}>
          <Icon icon="mingcute:left-line" />
        </button>
        <h1 className="sr-page-header__title">智能记录</h1>
        <div className="sr-page-header__spacer" />
      </header>

      {/* ═══ 内容区 — 对齐原型 m4p2 L98-156 ═══ */}
      <div className="sr-page-body sr-scrollbar-hide" style={{ display: 'flex', flexDirection: 'column' }}>

        {/* 品牌语 — 对齐原型 m4p2 L101-104 */}
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#333', margin: '0 0 4px 0' }}>日耕朝夕，耕愈工作，耕暖生活</p>
          <p style={{ fontSize: 14, color: '#666', margin: 0 }}>随时随地录，所言成资产</p>
        </div>

        {/* 初始化失败：展示错误 + 重试按钮 */}
        {initError ? (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            textAlign: 'center',
          }}>
            <div className="sr-empty">
              <div className="sr-empty-icon" style={{ display: 'inline-block', marginBottom: 12 }}>
                <Icon icon="mingcute:warning-line" style={{ fontSize: 40, color: '#F44336' }} />
              </div>
              <p className="sr-empty__text" style={{ color: '#F44336', marginBottom: 8 }}>录音启动失败</p>
              <p className="sr-empty__hint" style={{ marginBottom: 20 }}>{initError}</p>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button
                className="sr-btn-secondary"
                style={{ flex: 'none', width: 120 }}
                onClick={() => navigate(-1)}
              >
                返回
              </button>
              <button
                className="sr-btn-primary"
                style={{ flex: 'none', width: 120 }}
                onClick={() => beginRecording()}
              >
                <Icon icon="mingcute:refresh-line" />
                重试
              </button>
            </div>
          </div>
        ) : isStarting ? (
          /* 初始化加载中 */
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="sr-loading">
              <Icon icon="mingcute:loader-3-fill" className="sr-loading__spinner" />
              <span className="sr-loading__text">正在启动录音...</span>
            </div>
          </div>
        ) : (
          /* 录音正常进行中 */
          <>
            {/* 场景标签 — 对齐原型 m4p2 L107-109 */}
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <span className="sr-scene-tag" style={{ backgroundColor: sceneColor }}>
                {scene}录音中
              </span>
            </div>

            {/* 计时器 — 对齐原型 m4p2 L112-114 */}
            <div className="sr-timer">{formatTime(seconds)}</div>

            {/* 波形图 — 对齐原型 m4p2 L117-123 */}
            <div className="sr-waveform">
              <div className="sr-wave-bar" />
              <div className="sr-wave-bar" />
              <div className="sr-wave-bar" />
              <div className="sr-wave-bar" />
              <div className="sr-wave-bar" />
            </div>

            {/* 停止按钮 — 对齐原型 m4p2 L126-135 */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <div className="sr-record-btn-wrap">
                <div className="sr-pulse-ring" style={{ borderRadius: '50%' }}>
                  <button className="sr-record-circle" onClick={handleStop}>
                    <Icon icon="mingcute:microphone-fill" style={{ color: '#FFFFFF', fontSize: 32 }} />
                  </button>
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <p style={{ fontSize: 12, color: '#999', margin: 0 }}>点击停止录音</p>
            </div>

            {/* 实时转写预览 — 对齐原型 m4p2 L138-147 */}
            <div className="sr-transcript-preview">
              <h4 className="sr-transcript-preview__title">实时转写</h4>
              {transcriptLines.length === 0 ? (
                <div className="sr-transcript-preview__wait">
                  <p className="sr-transcript-preview__wait-text">等待语音输入...</p>
                </div>
              ) : (
                <div>
                  {transcriptLines.map((line, i) => (
                    <p key={i} className="sr-transcript-preview__line">{line}</p>
                  ))}
                </div>
              )}
              <div className="sr-transcript-indicator">
                <span className="sr-dot-pulse" />
                转写中
              </div>
            </div>

            {/* 通知栏标识 — 对齐原型 m4p2 L150-155 */}
            <div className="sr-notification-bar">
              <span className="sr-notification-bar__badge">
                <span className="sr-dot-pulse" />
                智能记录 · 录音中
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
