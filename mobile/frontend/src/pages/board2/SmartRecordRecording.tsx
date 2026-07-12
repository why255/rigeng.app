/**
 * 智能记录录音中页面 — 计时器 + 波形图 + 停止按钮 + 腾讯云实时ASR转写预览。
 * Route: /m/smart-record/recording?scene=xxx
 * 严格对齐 m4p2-mobile.html 原型设计。
 *
 * V2.0: 接入腾讯云语音识别实现真实实时转写。
 *       - HTTP chunk模式：每5秒上传音频chunk→调用腾讯云ASR→显示转写结果
 *       - WebSocket流式模式：连接腾讯云实时ASR WebSocket→延迟<500ms
 *       - 降级：无网络/API不可用时静默降级，录音不受影响
 *
 * 使用 sr-* BEM 类名（来自 smart-record.css）+ 内联 style。无 Tailwind CSS。
 * 图标使用 @iconify/react <Icon> 组件。返回按钮使用 navigate(-1)。
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '@iconify/react'
import { startRecording, stopRecording, uploadAudioChunk, fetchAsrAuth, type AsrAuthResponse } from '@/shared/api/recordings'
import './smart-record.css'

const SCENE_COLORS: Record<string, string> = {
  '面试': '#6B8FBF',
  '会议': '#D4A574',
  '日常': '#BCAAA4',
  '自定义': '#E8A94D',
}

interface TranscriptLine {
  text: string
  time: string
  confidence: number
}

export function SmartRecordRecording() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const scene = searchParams.get('scene') || '面试'
  const sceneColor = SCENE_COLORS[scene] || '#6B8FBF'

  const [seconds, setSeconds] = useState(0)
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [transcriptLines, setTranscriptLines] = useState<TranscriptLine[]>([])
  const [initError, setInitError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(true)
  const [asrSource, setAsrSource] = useState<string>('')
  const asrSourceRef = useRef<string>('')  // ref 避免 sendChunkForAsr 闭包过期
  const wsHasProducedTextRef = useRef(false)  // WebSocket是否真正产出过转写文本
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunkIndexRef = useRef(0)
  const stoppingRef = useRef(false)
  const asrWsRef = useRef<WebSocket | null>(null)

  // 初始化录音 — 对齐原型 m4p2
  const beginRecording = useCallback(async () => {
    setInitError(null)
    setIsStarting(true)
    let cancelled = false

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }

      const startRes = await startRecording(scene as '面试' | '会议' | '日常' | '自定义')
      // 兼容后端 snake_case 返回 recording_id
      const recId: string = (startRes as any).recording_id || (startRes as any).recordingId || ''
      if (!recId) {
        console.error('[SmartRecord] startRecording 返回的recordingId为空，完整响应:', startRes)
        throw new Error('录音创建失败：未获取到录音ID')
      }
      if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
      setRecordingId(recId)
      setIsStarting(false)

      // ── 启动 WebSocket 实时 ASR（可选，失败不影响录音）──
      startRealtimeAsr(recId)

      // ── 启动 MediaRecorder（HTTP chunk 模式作为兜底）──
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm'
      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = async (e) => {
        if (e.data.size > 0 && recId && !cancelled) {
          const idx = chunkIndexRef.current++
          // 异步发送ASR请求，不阻塞录音
          sendChunkForAsr(recId, e.data, idx)
        }
      }

      mediaRecorder.start(5000) // 每5秒产出一个chunk
    } catch (err: any) {
      if (!cancelled) {
        setIsStarting(false)
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

  // ── WebSocket 实时 ASR ──
  const startRealtimeAsr = useCallback(async (recId: string) => {
    try {
      const auth = await fetchAsrAuth(recId)
      setAsrSource('ws')
      asrSourceRef.current = 'ws'

      const ws = new WebSocket(auth.ws_url)
      asrWsRef.current = ws
      ws.binaryType = 'arraybuffer'

      ws.onopen = () => {
        console.log('[SmartRecord] 腾讯云ASR WebSocket已连接')
        // 发送开始消息（Tencent ASR WebSocket协议）
        const startMsg = JSON.stringify({
          type: 'start',
          data: {
            voice_format: 1,      // 1=PCM
            engine_model_type: auth.engine_model_type,
            needvad: 1,           // 开启VAD自动断句
            filter_dirty: 1,      // 过滤脏词
            filter_modal: 0,      // 不过滤语气词
            convert_num_mode: 1,  // 数字转换
            word_info: 0,         // 不需要词级时间戳
            vad_silence_time: 800,// 静音800ms认为断句
          },
        })
        ws.send(startMsg)
      }

      ws.onmessage = (event) => {
        try {
          const result = JSON.parse(event.data)
          if (result.code === 0 && result.result) {
            const text = result.result.voice_text_str || result.result.text || ''
            if (text.trim()) {
              wsHasProducedTextRef.current = true  // 标记WS确实产出了转写文本
              const now = new Date()
              const timeStr = `${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
              setTranscriptLines(prev => {
                // 去重：如果最后一行相同则替换（ASR流式会不断更新同一条）
                const last = prev[prev.length - 1]
                if (last && last.text === text) return prev
                return [...prev, { text, time: timeStr, confidence: result.result.confidence || 0.95 }]
              })
            }
          } else if (result.code !== 0) {
            console.warn('[SmartRecord] 腾讯云ASR WebSocket错误:', result.code, result.message)
          }
        } catch {
          // 非JSON消息（可能是二进制确认），忽略
        }
      }

      ws.onerror = () => {
        console.warn('[SmartRecord] 腾讯云ASR WebSocket连接错误，降级到HTTP chunk模式')
        setAsrSource('chunk')
        asrSourceRef.current = 'chunk'
      }

      ws.onclose = () => {
        console.log('[SmartRecord] 腾讯云ASR WebSocket已关闭')
        // 如果WS连接了但从未产出文本，降级到chunk模式
        if (!wsHasProducedTextRef.current) {
          console.warn('[SmartRecord] WebSocket未产出转写文本，降级到HTTP chunk模式')
          setAsrSource('chunk')
          asrSourceRef.current = 'chunk'
        }
      }
    } catch (err) {
      console.warn('[SmartRecord] 无法获取ASR WebSocket授权，使用HTTP chunk模式:', err)
      setAsrSource('chunk')
      asrSourceRef.current = 'chunk'
    }
  }, [])

  // ── HTTP chunk ASR（兜底，同时作为WS无产出时的补充）──
  const sendChunkForAsr = useCallback(async (recId: string, chunk: Blob, idx: number) => {
    try {
      const result = await uploadAudioChunk(recId, chunk, idx)
      if (result.text?.trim()) {
        // 只有当WebSocket确实产出了转写文本时才跳过chunk结果（避免重复）
        // 如果WS连接了但没产出文本，chunk结果仍然要显示
        const currentAsrSource = asrSourceRef.current
        if (currentAsrSource !== 'ws' || !wsHasProducedTextRef.current) {
          const now = new Date()
          const timeStr = `${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
          setTranscriptLines(prev => [...prev, { text: result.text, time: timeStr, confidence: result.confidence }])
        }
      }
    } catch (err) {
      console.error('[SmartRecord] chunk上传/转写失败:', err)
    }
  }, [])  // 空依赖，通过ref读取最新值

  useEffect(() => {
    const cleanup = beginRecording()
    return () => {
      cleanup.then((fn) => fn?.())
    }
  }, [beginRecording])

  // 计时器
  useEffect(() => {
    if (initError || isStarting) return
    intervalRef.current = setInterval(() => { setSeconds((s) => s + 1) }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [initError, isStarting])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  // 停止录音 → 跳转转写详情
  const handleStop = useCallback(async () => {
    if (stoppingRef.current) return
    stoppingRef.current = true

    if (intervalRef.current) clearInterval(intervalRef.current)

    // 发送 WebSocket 结束消息
    if (asrWsRef.current && asrWsRef.current.readyState === WebSocket.OPEN) {
      asrWsRef.current.send(JSON.stringify({ type: 'end' }))
      setTimeout(() => { asrWsRef.current?.close() }, 500)
    }

    // 停止 MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop())
    }

    if (recordingId) {
      try {
        await stopRecording(recordingId)
      } catch (err) {
        console.error('[SmartRecord] 停止录音请求失败:', err)
      }
    } else {
      console.error('[SmartRecord] handleStop: recordingId为空，无法停止录音')
    }

    navigate(`/m/smart-record/transcript?id=${recordingId || 'demo'}`)
  }, [recordingId, navigate])

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
      <div className="sr-page-body sr-scrollbar-hide" style={{ display: 'flex', flexDirection: 'column' }}>

        {/* 品牌语 */}
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#333', margin: '0 0 4px 0' }}>日耕朝夕，耕愈工作，耕暖生活</p>
          <p style={{ fontSize: 14, color: '#666', margin: 0 }}>随时随地录，所言成资产</p>
        </div>

        {/* 初始化失败 */}
        {initError ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
            <div className="sr-empty">
              <div className="sr-empty-icon" style={{ display: 'inline-block', marginBottom: 12 }}>
                <Icon icon="mingcute:warning-line" style={{ fontSize: 40, color: '#F44336' }} />
              </div>
              <p className="sr-empty__text" style={{ color: '#F44336', marginBottom: 8 }}>录音启动失败</p>
              <p className="sr-empty__hint" style={{ marginBottom: 20 }}>{initError}</p>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button className="sr-btn-secondary" style={{ flex: 'none', width: 120 }} onClick={() => navigate(-1)}>返回</button>
              <button className="sr-btn-primary" style={{ flex: 'none', width: 120 }} onClick={() => beginRecording()}>
                <Icon icon="mingcute:refresh-line" /> 重试
              </button>
            </div>
          </div>
        ) : isStarting ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="sr-loading">
              <Icon icon="mingcute:loader-3-fill" className="sr-loading__spinner" />
              <span className="sr-loading__text">正在启动录音...</span>
            </div>
          </div>
        ) : (
          <>
            {/* 场景标签 */}
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <span className="sr-scene-tag" style={{ backgroundColor: sceneColor }}>{scene}录音中</span>
            </div>

            {/* 计时器 */}
            <div className="sr-timer">{formatTime(seconds)}</div>

            {/* 波形图 */}
            <div className="sr-waveform">
              <div className="sr-wave-bar" /><div className="sr-wave-bar" />
              <div className="sr-wave-bar" /><div className="sr-wave-bar" />
              <div className="sr-wave-bar" />
            </div>

            {/* 停止按钮 */}
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

            {/* 实时转写预览 — 接入腾讯云ASR */}
            <div className="sr-transcript-preview">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 className="sr-transcript-preview__title">实时转写</h4>
                {asrSource && (
                  <span style={{ fontSize: 10, color: '#4CAF50', background: '#E8F5E9', padding: '2px 8px', borderRadius: 8 }}>
                    {asrSource === 'ws' ? '⚡ 流式ASR' : '📡 在线ASR'}
                  </span>
                )}
              </div>
              {transcriptLines.length === 0 ? (
                <div className="sr-transcript-preview__wait">
                  <p className="sr-transcript-preview__wait-text">等待语音输入...</p>
                </div>
              ) : (
                <div>
                  {transcriptLines.map((line, i) => (
                    <p key={i} className="sr-transcript-preview__line">
                      <span style={{ color: '#999', fontSize: 10, marginRight: 6 }}>{line.time}</span>
                      {line.text}
                    </p>
                  ))}
                </div>
              )}
              <div className="sr-transcript-indicator">
                <span className="sr-dot-pulse" />
                转写中
              </div>
            </div>

            {/* 通知栏标识 */}
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
