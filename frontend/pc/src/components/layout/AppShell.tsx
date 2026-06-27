import { useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { getModuleBySlug } from '@rigeng/shared/data/modules'

/**
 * PC 端全局外壳：
 * - 左侧 240px 侧边栏常驻
 * - 顶部栏（面包屑 + 语音按钮）
 * - 无底部 TabBar
 */
export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation()
  const slug = location.pathname.match(/\/m\/([\w-]+)/)?.[1]
  const module = slug ? getModuleBySlug(slug) : undefined
  const [offline] = useState(false)

  return (
    <div className="rg-shell">
      <Sidebar />
      <div className="rg-main">
        <TopBar module={module} offline={offline} />
        <main className="rg-page">{children}</main>
      </div>
    </div>
  )
}

/** 页面容器：对话类 680px / 仪表盘类 960px，居中聚拢 */
export function PageContainer({
  width = 'chat',
  children,
}: {
  width?: 'chat' | 'dashboard'
  children: ReactNode
}) {
  return (
    <div className={`content-area ${width === 'dashboard' ? 'content-area--dashboard' : ''}`}>
      {children}
    </div>
  )
}
