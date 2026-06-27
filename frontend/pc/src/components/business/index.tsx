import { useState, type ReactNode } from 'react'
import { ProgressBar } from '../primitives'
import './business.css'

export { BrandSlogan } from './BrandSlogan'

/* ---------- 14 双库切换面板 ---------- */
export function DualLibTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string }[]
  active: string
  onChange: (key: string) => void
}) {
  const idx = Math.max(0, tabs.findIndex((t) => t.key === active))
  const widthPct = 100 / tabs.length
  return (
    <div className="rg-duallib" role="tablist">
      <span
        className="rg-duallib__slider"
        style={{ width: `calc(${widthPct}% - 4px)`, transform: `translateX(calc(${idx * 100}% + ${idx * 4}px))` }}
      />
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={t.key === active}
          className={`rg-duallib__tab ${t.key === active ? 'rg-duallib__tab--active' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

/* ---------- 23 五步法步骤条 ---------- */
export interface Step {
  key: string
  name: string
  status: 'done' | 'current' | 'todo'
}
export function StepFlow({ steps, onSelect }: { steps: Step[]; onSelect?: (key: string) => void }) {
  const badge = (s: Step) => (s.status === 'done' ? '✅' : s.status === 'current' ? '🔵' : '⬜')
  return (
    <div className="rg-stepflow">
      {steps.map((s) => (
        <div
          key={s.key}
          className={`rg-stepflow__step ${s.status === 'done' ? 'rg-stepflow__step--done' : ''} ${
            s.status === 'current' ? 'rg-stepflow__step--current' : ''
          }`}
          onClick={() => onSelect?.(s.key)}
        >
          <span className="rg-stepflow__badge">{badge(s)}</span>
          <span className="rg-stepflow__name">{s.name}</span>
        </div>
      ))}
    </div>
  )
}

/* ---------- 25g 情绪评分面板 (-10 ~ +10) ---------- */
export function MoodScore({ ai, user }: { ai: number; user: number }) {
  // 将 -10~+10 映射为相对中点 50% 的偏移
  const offset = (v: number) => (v / 10) * 50
  const row = (label: string, v: number) => {
    const o = offset(v)
    return (
      <div className="rg-moodscore__row">
        <span className="rg-moodscore__label">{label}</span>
        <div className="rg-moodscore__track">
          <span
            className="rg-moodscore__fill"
            style={o >= 0 ? { left: '50%', width: `${o}%` } : { left: `${50 + o}%`, width: `${-o}%` }}
          />
        </div>
        <span className="rg-moodscore__value">{v > 0 ? `+${v}` : v}</span>
      </div>
    )
  }
  return (
    <div className="rg-moodscore">
      {row('智能分析', ai)}
      {row('您的评分', user)}
    </div>
  )
}

/* ---------- 25h 勇气值进度条 ---------- */
export function CourageBar({ value }: { value: number }) {
  return (
    <div className="rg-courage">
      <span className="rg-courage__label">🔥 勇气值 {value}%</span>
      <div className="rg-courage__bar">
        <ProgressBar value={value} courage />
      </div>
    </div>
  )
}

/* ---------- 18 角色模拟面板 ---------- */
export function RolePanel({ roles, children }: { roles: string[]; children: (active: string) => ReactNode }) {
  const [active, setActive] = useState(roles[0])
  return (
    <div>
      <div className="rg-rolepanel__tabs" role="tablist">
        {roles.map((r) => (
          <button
            key={r}
            role="tab"
            aria-selected={r === active}
            className={`rg-rolepanel__tab ${r === active ? 'rg-rolepanel__tab--active' : ''}`}
            onClick={() => setActive(r)}
          >
            {r}
          </button>
        ))}
      </div>
      {children(active)}
    </div>
  )
}

/* ---------- 15 富文本编辑器占位 ---------- */
export function RichTextStub({ placeholder = '在这里编辑文档…' }: { placeholder?: string }) {
  return (
    <div className="rg-richtext">
      <div className="rg-richtext__toolbar">
        {['B', 'I', 'H1', 'H2', '• 列表', '🔗', '🖼️'].map((t) => (
          <button key={t} className="rg-richtext__tool">
            {t}
          </button>
        ))}
      </div>
      <div className="rg-richtext__area" contentEditable suppressContentEditableWarning data-placeholder={placeholder}>
        {placeholder}
      </div>
    </div>
  )
}
