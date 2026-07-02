import { type ReactNode } from 'react'
import { TabBar } from './TabBar'

/**
 * 移动端 H5 全局外壳：
 * - 无顶部栏（页面直接从子模块标题开始）
 * - 底部 80px TabBar 常驻
 * - 无 Sidebar
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="rg-shell-mobile">
      <div className="rg-main">
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
