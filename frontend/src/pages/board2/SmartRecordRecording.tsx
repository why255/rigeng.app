import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { MAIN_SLOGAN } from '@/data/modules'
import { startRecording, stopRecording, getTeleprompter } from '@/api/recordings'
import '../pages.css'
import './smart-record.css'

const SCENE_COLORS: Record<string, string> = {
  '面试': '#6B8FBF',
  '会议': '#D4A574',
  '日常': '#BCAAA4',
  '自定义': '#E8A94D',
}

interface TeleprompterQuestion {
  question: string
  purpose: string
  expected_answer_hint: string
}

/** M4-P2 录音中页面 — 计时器 + 波形动画 + 实时转写预览 + 面试提词器 */
export function SmartRecordRecording() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const scene = searchParams.get('scene') || '面试'
  const position = searchParams.get('position') || ''
  const sceneColor = SCENE_COLORS[scene] || '#6B8FBF'

  const [seconds, setSeconds] = useState(0)
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [transcriptLines, setTranscriptLines] = useState<string[]>([])
  const [teleprompterQuestions, setTeleprompterQuestions] = useState<TeleprompterQuestion[]>([])
  const [teleprompterTips, setTeleprompterTips] = useState('')
  const [isStopping, setIsStopping] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startedRef = useRef(false)

  // 开始录音
  const beginRecording = useCallback(async () => {
    if (startedRef.current) return
    startedRef.current = true
    try {
      const result = await startRecording({ scene })
      setRecordingId(result.recording_id)
    } catch {
      // 离线或接口不可用时仍可用计时器
    }
  }, [scene])

  // 加载提词器（仅面试场景）
  const loadTeleprompter = useCallback(async () => {
    if (scene !== '面试') return
    try {
      const result = await getTeleprompter(position || undefined)
      setTeleprompterQuestions(result.questions || [])
      setTeleprompterTips(result.tips || '')
    } catch {
      // 提词器不可用时静默降级
    }
  }, [scene, position])

  useEffect(() => {
    beginRecording()
    loadTeleprompter()

    intervalRef.current = setInterval(() => {
      setSeconds((s) => s + 1)
    }, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [beginRecording, loadTeleprompter])

  // 模拟实时转写（生产环境通过WebSocket推送）
  useEffect(() => {
    if (seconds === 5) {
      setTranscriptLines(['[00:05] 您好，我是来参加面试的...'])
    } else if (seconds === 10) {
      setTranscriptLines((prev) => [...prev, '[00:10] 请简单介绍一下你自己吧'])
    } else if (seconds === 18) {
      setTranscriptLines((prev) => [...prev, '[00:18] 好的，我毕业于...'])
    } else if (seconds === 28) {
      setTranscriptLines((prev) => [...prev, '[00:28] 你在之前的项目中遇到过什么技术挑战吗？'])
    } else if (seconds === 38) {
      setTranscriptLines((prev) => [...prev, '[00:38] 之前做项目时遇到性能瓶颈，通过优化...'])
    }
  }, [seconds])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  const handleStop = async () => {
    if (isStopping) return
    setIsStopping(true)
    if (intervalRef.current) clearInterval(intervalRef.current)

    if (recordingId) {
      try {
        await stopRecording(recordingId)
        navigate(`/m/smart-record/transcript?id=${recordingId}`)
      } catch {
        // 接口失败也跳转（使用模拟转写数据）
        navigate('/m/smart-record/transcript?id=demo')
      }
    } else {
      navigate('/m/smart-record/transcript?id=demo')
    }
  }

  return (
    <PageContainer width="dashboard">
      <div data-module="smart-record">
        {/* 品牌标语 */}
        <div className="sr-brand">
          <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-neutral-900)' }}>{MAIN_SLOGAN}</p>
          <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-neutral-900)' }}>随时随地录，所言成资产</p>
        </div>

        {/* 场景标签 */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <span className="sr-recording-scene" style={{ backgroundColor: sceneColor }}>
            {scene}录音中
          </span>
        </div>

        {/* 计时器 */}
        <div className="sr-timer">{formatTime(seconds)}</div>

        {/* 波形图 */}
        <div className="sr-waveform">
          <div className="sr-wave-bar" />
          <div className="sr-wave-bar" />
          <div className="sr-wave-bar" />
          <div className="sr-wave-bar" />
          <div className="sr-wave-bar" />
        </div>

        {/* 停止按钮 */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <div className="sr-record-btn-wrap">
            <div className="sr-pulse-ring" style={{ borderRadius: '50%' }}>
              <button
                className="sr-record-circle sr-record-btn"
                onClick={handleStop}
                disabled={isStopping}
              >
                {isStopping ? '⏳' : '🎤'}
              </button>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <p style={{ fontSize: 14, color: 'var(--color-neutral-500)' }}>
            {isStopping ? '正在处理录音...' : '点击停止录音'}
          </p>
        </div>

        {/* 实时转写预览 */}
        {transcriptLines.length > 0 && (
          <div className="sr-transcript-preview">
            <h4 className="sr-transcript-preview__title">实时转写</h4>
            <div>
              {transcriptLines.map((line, i) => (
                <p key={i} className="sr-transcript-preview__line">{line}</p>
              ))}
            </div>
            <div className="sr-transcript-preview__indicator">
              <span className="sr-dot-pulse" />
              转写中
            </div>
          </div>
        )}

        {/* 面试提词器 */}
        {scene === '面试' && (
          <div className="sr-teleprompter" style={{ opacity: teleprompterQuestions.length > 0 ? 1 : 0.4 }}>
            {teleprompterQuestions.length === 0 && (
              <div className="sr-teleprompter__overlay">
                <span style={{ fontSize: 14, color: '#BCAAA4', fontWeight: 500 }}>加载中...</span>
              </div>
            )}
            <h4 className="sr-teleprompter__title">面试提词器</h4>
            {teleprompterQuestions.length > 0 ? (
              <div>
                {teleprompterQuestions.map((q, i) => (
                  <div key={i} className="sr-teleprompter__item" style={{ marginBottom: 8 }}>
                    <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                      {i + 1}. {q.question}
                    </p>
                    <p style={{ fontSize: 11, color: '#888' }}>目的：{q.purpose}</p>
                  </div>
                ))}
                {teleprompterTips && (
                  <p style={{ fontSize: 11, color: '#C03A39', marginTop: 12, fontStyle: 'italic' }}>
                    💡 {teleprompterTips}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <p className="sr-teleprompter__item">1. 请候选人简要自我介绍（1-2分钟）</p>
                <p className="sr-teleprompter__item">2. 追问上一段离职原因及职业规划</p>
                <p className="sr-teleprompter__item">3. 核心技能匹配度评估</p>
                <p className="sr-teleprompter__item">4. 期望薪资与到岗时间确认</p>
              </div>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  )
}
