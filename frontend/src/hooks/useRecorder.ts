import { useState, useRef, useCallback } from 'react'

export interface RecorderState {
  isRecording: boolean
  isPaused: boolean
  seconds: number
  scene: string
}

/**
 * 录音控制 Hook
 * 封装计时器、录音状态管理（MediaRecorder 接入预留）
 */
export function useRecorder(initialScene = '面试') {
  const [state, setState] = useState<RecorderState>({
    isRecording: false,
    isPaused: false,
    seconds: 0,
    scene: initialScene,
  })
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startTimer = useCallback(() => {
    intervalRef.current = setInterval(() => {
      setState((s) => ({ ...s, seconds: s.seconds + 1 }))
    }, 1000)
  }, [])

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const start = useCallback(async (scene?: string) => {
    if (scene) setState((s) => ({ ...s, scene }))

    // 请求麦克风权限并启动 MediaRecorder（如果可用）
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      })
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.start(1000) // 每秒收集一次数据
      mediaRecorderRef.current = recorder
    } catch (err) {
      // 权限被拒绝或浏览器不支持，仍可进入模拟录音模式
      console.warn('麦克风不可用，进入演示模式:', err)
    }

    startTimer()
    setState((s) => ({ ...s, isRecording: true, isPaused: false, seconds: 0 }))
  }, [startTimer])

  const pause = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause()
    }
    stopTimer()
    setState((s) => ({ ...s, isPaused: true }))
  }, [stopTimer])

  const resume = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume()
    }
    startTimer()
    setState((s) => ({ ...s, isPaused: false }))
  }, [startTimer])

  const stop = useCallback((): Blob | null => {
    if (mediaRecorderRef.current?.state === 'recording' || mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.stop()
      // 停止所有音轨
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop())
    }
    stopTimer()
    setState((s) => ({ ...s, isRecording: false, isPaused: false }))

    // 返回录音数据
    if (chunksRef.current.length > 0) {
      return new Blob(chunksRef.current, { type: 'audio/webm' })
    }
    return null
  }, [stopTimer])

  const formatTime = useCallback((s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }, [])

  return {
    ...state,
    start,
    pause,
    resume,
    stop,
    formatTime,
  }
}
