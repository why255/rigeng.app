/**
 * 通用语音输入 Hook — 替代所有模块中的 SpeechRecognition。
 *
 * 链路：getUserMedia → MediaRecorder → webm Blob → 转 WAV → Base64 → POST /voice/asr → 腾讯云 ASR → 文本
 *
 * 支持模式：
 *   - hold（按住说话）：press & hold 开始录音，松手结束并发送
 *   - click（点击说话）：点击开始录音，再点结束并发送
 *
 * 使用示例：
 *   const voice = useVoiceInput({
 *     onResult: (text) => processUserInput(text, true),
 *     onError: (err) => alert(err),
 *   });
 *
 *   // 在 JSX 中：
 *   <button onClick={() => voice.setVoiceUIActive(true)}>麦克风</button>
 *   <div onPointerDown={voice.handlePointerDown} onPointerUp={voice.handlePointerUp}>语音按钮</div>
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { speechToText } from '@/shared/api/voice'

export type VoiceMode = 'hold' | 'click'

export interface UseVoiceInputOptions {
  /** 转写完成后回调，传入识别出的文本 */
  onResult: (text: string) => void
  /** 错误回调（如麦克风权限拒绝、ASR失败等） */
  onError?: (error: string) => void
  /** 语音模式 */
  mode?: VoiceMode
}

export interface UseVoiceInputReturn {
  // ── 状态 ──
  isRecording: boolean
  cancelZone: boolean
  recordingTime: number
  voiceUIActive: boolean
  setVoiceUIActive: (v: boolean) => void

  // ── 操作 ──
  startRecording: () => Promise<void>
  stopRecording: (cancelled?: boolean) => void
  cancelRecording: () => void

  // ── 大语音按钮事件（Pointer Events） ──
  handlePointerDown: (e: React.PointerEvent) => void
  handlePointerUp: (e: React.PointerEvent) => void
  handlePointerMove: (e: React.PointerEvent) => void
  handleClick: () => void

  // ── 工具 ──
  formatTime: (s: number) => string
}

/* ── Hook ── */

export function useVoiceInput(options: UseVoiceInputOptions): UseVoiceInputReturn {
  const { onResult, onError, mode = 'hold' } = options

  // 状态
  const [voiceUIActive, setVoiceUIActive] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [cancelZone, setCancelZone] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)

  // Refs — callbacks via ref to avoid stale closures in async MediaRecorder.onstop
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pressStartYRef = useRef(0)
  const stoppingRef = useRef(false)      // 防止重复 stop

  // 清理
  const cleanup = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    mediaRecorderRef.current = null
    chunksRef.current = []
  }, [])

  useEffect(() => () => cleanup(), [cleanup])

  // 计时器
  const startTimer = useCallback(() => {
    setRecordingTime(0)
    timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000)
  }, [])
  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  // ── 开始录音 ──
  const startRecording = useCallback(async () => {
    if (isRecording || stoppingRef.current) return

    chunksRef.current = []
    setCancelZone(false)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data?.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        // 清理流
        stream.getTracks().forEach(t => t.stop())
        streamRef.current = null

        if (cancelZone || stoppingRef.current) {
          // 已取消，丢弃录音
          return
        }

        // 合并 chunks → 转 WAV → 发送 ASR
        const audioBlob = new Blob(chunksRef.current, { type: mimeType })
        chunksRef.current = []

        if (audioBlob.size < 500) {
          // 太短的录音（< 0.1 秒有效数据），忽略
          return
        }

        try {
          const result = await speechToText(audioBlob)
          if (result.text?.trim()) {
            onResultRef.current(result.text.trim())
          }
        } catch (err: any) {
          // ASR 失败 → 通知调用方
          const msg = err?.message || '语音识别失败，请稍后重试'
          onErrorRef.current?.(msg)
        }
      }

      recorder.onerror = () => {
        cleanup()
        setIsRecording(false)
        onErrorRef.current?.('录音设备异常，请重试')
      }

      recorder.start(100) // 每100ms产出一个chunk
      setIsRecording(true)
      startTimer()
    } catch (err: any) {
      const msg = err?.name === 'NotAllowedError'
        ? '麦克风权限被拒绝，请在设置中允许麦克风访问后重试'
        : err?.name === 'NotFoundError'
          ? '未检测到麦克风设备，请连接麦克风后重试'
          : '录音启动失败，请检查设备权限后重试'
      onErrorRef.current?.(msg)
    }
  }, [isRecording, cancelZone, startTimer, cleanup])

  // ── 停止录音 ──
  const stopRecording = useCallback((cancelled?: boolean) => {
    if (!isRecording || stoppingRef.current) return

    if (cancelled || cancelZone) {
      // 取消：强制停止，不触发 ASR
      stoppingRef.current = true
      setIsRecording(false)
      stopTimer()
      setCancelZone(false)
      setVoiceUIActive(false)
      cleanup()
      // 重置 stopping 标记（延迟，等 onstop 执行完）
      setTimeout(() => { stoppingRef.current = false }, 300)
      return
    }

    setIsRecording(false)
    stopTimer()
    setVoiceUIActive(false)

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }

    // 重置 stopping 标记（延迟，等 onstop 执行完）
    setTimeout(() => { stoppingRef.current = false }, 300)
  }, [isRecording, cancelZone, stopTimer, cleanup])

  // ── 取消 ──
  const cancelRecording = useCallback(() => {
    if (isRecording) stopRecording(true)
  }, [isRecording, stopRecording])

  // ── Pointer 事件处理 ──
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    if (isRecording) return
    pressStartYRef.current = e.clientY
    startRecording()
  }, [isRecording, startRecording])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    if (!isRecording) return
    if (mode === 'hold') stopRecording(cancelZone)
  }, [isRecording, mode, cancelZone, stopRecording])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isRecording || mode !== 'hold') return
    setCancelZone(pressStartYRef.current - e.clientY > 80)
  }, [isRecording, mode])

  const handleClick = useCallback(() => {
    if (mode === 'click') {
      if (isRecording) stopRecording(false)
      else startRecording()
    }
  }, [mode, isRecording, startRecording, stopRecording])

  return {
    isRecording,
    cancelZone,
    recordingTime,
    voiceUIActive,
    setVoiceUIActive,
    startRecording,
    stopRecording,
    cancelRecording,
    handlePointerDown,
    handlePointerUp,
    handlePointerMove,
    handleClick,
    formatTime,
  }
}
