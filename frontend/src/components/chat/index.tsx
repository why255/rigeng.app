import type { ReactNode } from 'react'
import { Avatar } from '../primitives'
import './chat.css'

/* ---------- 05 对话气泡 ---------- */
interface BubbleProps {
  role: 'assistant' | 'user'
  children: ReactNode
  /** 小耕气泡是否展示头像 */
  avatar?: boolean
}
export function ChatBubble({ role, children, avatar = true }: BubbleProps) {
  return (
    <div className={`rg-bubble-row rg-bubble-row--${role}`}>
      {role === 'assistant' && avatar && <Avatar emoji="耕" />}
      <div className={`rg-bubble rg-bubble--${role}`}>{children}</div>
    </div>
  )
}

/* ---------- 25c 思考等待动画 ---------- */
export function ThinkingDots({ text = '小耕在拼命思考中…' }: { text?: string }) {
  return (
    <div className="rg-thinking">
      <svg className="rg-thinking__spinner" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span>{text}</span>
    </div>
  )
}

/* ---------- 04 语音按钮 ---------- */
interface VoiceButtonProps {
  recording?: boolean
  size?: 'lg' | 'sm'
  onClick?: () => void
  'aria-label'?: string
}
export function VoiceButton({ recording, size = 'lg', onClick, ...rest }: VoiceButtonProps) {
  const cls = ['rg-voice', recording && 'rg-voice--recording', size === 'sm' && 'rg-voice--sm'].filter(Boolean).join(' ')
  return (
    <button className={cls} onClick={onClick} aria-label={rest['aria-label'] ?? '语音输入'}>
      {recording ? '⏺' : '🎤'}
    </button>
  )
}

/* ---------- 06 语音播放图标 ---------- */
export function VoicePlayIcon({ playing, onClick }: { playing?: boolean; onClick?: () => void }) {
  return (
    <span className={`rg-voiceplay ${playing ? 'rg-voiceplay--playing' : ''}`} onClick={onClick} role="button" aria-label="播放语音">
      <i className="rg-voiceplay__bar" />
      <i className="rg-voiceplay__bar" />
      <i className="rg-voiceplay__bar" />
    </span>
  )
}

/* ---------- 12 录音波形 ---------- */
export function Waveform({ bars = 24 }: { bars?: number }) {
  return (
    <div className="rg-waveform" aria-label="录音中">
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="rg-waveform__bar"
          style={{ animationDelay: `${(i % 6) * 0.08}s`, height: `${30 + ((i * 37) % 70)}%` }}
        />
      ))}
    </div>
  )
}
