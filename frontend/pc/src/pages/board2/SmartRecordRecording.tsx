import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { MAIN_SLOGAN } from '@rigeng/shared/data/modules'
import '../pages.css'
import './smart-record.css'

const SCENE_COLORS: Record<string, string> = {
  '面试': '#6B8FBF',
  '会议': '#D4A574',
  '日常': '#BCAAA4',
  '自定义': '#E8A94D',
}

const MOCK_TRANSCRIPT = [
  '[00:12] 您好，我是来面试前端工程师岗位的...',
  '[00:18] 请简单介绍一下你自己吧',
  '[00:25] 好的，我毕业于...',
]

/** M4-P2 录音中页面（PC） — 计时器 + 波形动画 + 实时转写预览 + 面试提词器 */
export function SmartRecordRecording() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const scene = searchParams.get('scene') || '面试'
  const sceneColor = SCENE_COLORS[scene] || '#6B8FBF'

  const [seconds, setSeconds] = useState(25)
  const [transcriptLines] = useState<string[]>(MOCK_TRANSCRIPT)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSeconds((s) => s + 1)
    }, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  const handleStop = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    navigate('/m/smart-record/transcript?id=demo')
  }

  return (
    <PageContainer width="dashboard">
      <div data-module="smart-record">
        {/* 品牌标语（简写） */}
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
              <button className="sr-record-circle sr-record-btn" onClick={handleStop}>
                🎤
              </button>
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <p style={{ fontSize: 14, color: 'var(--color-neutral-500)' }}>点击停止录音</p>
        </div>

        {/* 实时转写预览 */}
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

        {/* 面试提词器（灰置） */}
        <div className="sr-teleprompter">
          <div className="sr-teleprompter__overlay">
            <span style={{ fontSize: 14, color: '#BCAAA4', fontWeight: 500 }}>即将上线</span>
          </div>
          <h4 className="sr-teleprompter__title">面试提词器</h4>
          <div>
            <p className="sr-teleprompter__item">1. 请候选人简要自我介绍（1-2分钟）</p>
            <p className="sr-teleprompter__item">2. 追问上一段离职原因及职业规划</p>
            <p className="sr-teleprompter__item">3. 核心技能匹配度评估</p>
            <p className="sr-teleprompter__item">4. 期望薪资与到岗时间确认</p>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
