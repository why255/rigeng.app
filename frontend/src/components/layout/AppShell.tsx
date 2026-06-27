import { useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { TabBar } from './TabBar'
import { getModuleBySlug } from '@/data/modules'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import './layout.css'

/**
 * 全局外壳：
 * - PC（≥768px）：左侧 240px 导航常驻 + 顶部栏，无底部 Tab
 * - 移动端（<768px）：顶部栏 + 底部 80px Tab，无侧栏
 * 子页面通过 Outlet/children 注入。
 */
export function AppShell({ children }: { children: ReactNode }) {
  const isDesktop = useIsDesktop()
  const location = useLocation()
  const slug = location.pathname.match(/\/m\/([\w-]+)/)?.[1]
  const module = slug ? getModuleBySlug(slug) : undefined
  const [offline] = useState(false) // 预留：可接入 navigator.onLine

  return (
    <div className="rg-shell">
      {isDesktop && <Sidebar />}
      <div className="rg-main">
        <TopBar module={module} offline={offline} />
        <main className="rg-page">{children}</main>
        {!isDesktop && <TabBar />}
      </div>
    </div>
  )
}

/** 24c · 页面容器：对话类 680px / 仪表盘类 960px，居中聚拢 */
export function PageContainer({
  width = 'chat',
  children,
}: {
  width?: 'chat' | 'dashboard'
  children: ReactNode
}) {
  return <div className={`content-area ${width === 'dashboard' ? 'content-area--dashboard' : ''}`}>{children}</div>
}
