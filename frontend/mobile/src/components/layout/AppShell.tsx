import { useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { TopBar } from './TopBar'
import { TabBar } from './TabBar'
import { getModuleBySlug } from '@rigeng/shared/data/modules'

/**
 * 移动端 H5 全局外壳：
 * - 紧凑顶部栏（品牌名 + slogan）
 * - 底部 80px TabBar 常驻
 * - 无 Sidebar
 */
export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation()
  const slug = location.pathname.match(/\/m\/([\w-]+)/)?.[1]
  const module = slug ? getModuleBySlug(slug) : undefined
  const [offline] = useState(false)

  return (
    <div className="rg-shell-mobile">
      <div className="rg-main">
        <TopBar module={module} offline={offline} />
        <main className="rg-page">{children}</main>
        <TabBar />
      </div>
    </div>
  )
}

/** 页面容器：移动端全宽布局 */
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
