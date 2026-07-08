import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import './primitives.css'

type ToastTone = 'success' | 'warning' | 'error' | 'neutral'
interface ToastItem {
  id: number
  tone: ToastTone
  text: string
}

const ICON: Record<ToastTone, string> = { success: '✅', warning: '⚠️', error: '❌', neutral: '' }

const ToastContext = createContext<(text: string, tone?: ToastTone) => void>(() => {})

export function useToast() {
  return useContext(ToastContext)
}

let seq = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const push = useCallback((text: string, tone: ToastTone = 'neutral') => {
    const id = ++seq
    setItems((prev) => [...prev, { id, tone, text }])
    // 锁定书 7.10：2 秒自动消失
    window.setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 2000)
  }, [])

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="rg-toast-layer">
        {items.map((t) => (
          <div key={t.id} className={`rg-toast rg-toast--${t.tone}`}>
            {ICON[t.tone] && <span>{ICON[t.tone]}</span>}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
