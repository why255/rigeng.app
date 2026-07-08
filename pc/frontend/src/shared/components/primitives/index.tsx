import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from 'react'
import './primitives.css'

/* ---------- 字体层级文本 (01) ---------- */
type TextLevel = 'l0' | 'l1' | 'l2' | 'l3' | 'l4' | 'l5' | 'l6' | 'l7'
interface TextProps extends HTMLAttributes<HTMLElement> {
  level?: TextLevel
  as?: keyof JSX.IntrinsicElements
  color?: string
  children: ReactNode
}
export function Text({ level = 'l4', as = 'span', color, className = '', style, children, ...rest }: TextProps) {
  const Tag = as as any
  return (
    <Tag className={`t-${level} ${className}`} style={{ color, ...style }} {...rest}>
      {children}
    </Tag>
  )
}

/* ---------- 02 卡片 ---------- */
interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean
  clickable?: boolean
  /** 四象限左侧色条颜色 */
  barColor?: string
  children: ReactNode
}
export function Card({ hover, clickable, barColor, className = '', style, children, ...rest }: CardProps) {
  const cls = [
    'rg-card',
    hover && 'rg-card--hover',
    clickable && 'rg-card--clickable',
    barColor && 'rg-card--bar',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <div className={cls} style={{ ...(barColor ? { ['--bar-color' as string]: barColor } : {}), ...style }} {...rest}>
      {children}
    </div>
  )
}

/* ---------- 08 按钮 ---------- */
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'text'
  size?: 'md' | 'sm'
  children: ReactNode
}
export function Button({ variant = 'primary', size = 'md', className = '', children, ...rest }: ButtonProps) {
  const cls = ['rg-btn', `rg-btn--${variant}`, size === 'sm' && 'rg-btn--sm', className].filter(Boolean).join(' ')
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  )
}

/* ---------- 03 输入框 ---------- */
export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`rg-input ${className}`} {...rest} />
}
export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`rg-textarea ${className}`} {...rest} />
}

/* ---------- 07 进度条 ---------- */
export function ProgressBar({ value, courage = false }: { value: number; courage?: boolean }) {
  return (
    <div className="rg-progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={`rg-progress__fill ${courage ? 'rg-progress__fill--courage' : ''}`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}

/* ---------- 标签 ---------- */
interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'brand' | 'muted' | 'success' | 'warning' | 'error'
  children: ReactNode
}
export function Tag({ tone = 'brand', className = '', children, ...rest }: TagProps) {
  const map = { brand: '', muted: 'rg-tag--muted', success: 'rg-tag--success', warning: 'rg-tag--warning', error: 'rg-tag--error' }
  return (
    <span className={`rg-tag ${map[tone]} ${className}`} {...rest}>
      {children}
    </span>
  )
}

/* ---------- 25b 小耕 IP 头像 ---------- */
export function Avatar({ size = 'sm', emoji = '耕' }: { size?: 'sm' | 'lg'; emoji?: string }) {
  return <div className={`rg-avatar ${size === 'lg' ? 'rg-avatar--lg' : ''}`} aria-label="小耕">{emoji}</div>
}

/* ---------- 10 锁图标（未开放功能） ---------- */
export function Lock({ onClick }: { onClick?: () => void }) {
  return (
    <span className="rg-lock" role="button" aria-label="未开放功能" onClick={onClick}>
      🔒
    </span>
  )
}
