import { useState, type ReactNode } from 'react'
import { AdminSidebar } from './AdminSidebar'
import { AdminTopBar } from './AdminTopBar'

/**
 * 管理后台专属布局：
 * - 左侧可折叠侧边栏（220px / 64px）
 * - 顶部栏（50px：折叠按钮 + 面包屑 + 用户菜单 + 主题切换）
 * - 内容区（keep-alive 缓存）
 */
export function AdminLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={`admin-layout${collapsed ? ' admin-layout--collapsed' : ''}`}>
      <AdminSidebar collapsed={collapsed} />
      <div className="admin-main">
        <AdminTopBar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        <main className="admin-page">{children}</main>
      </div>
    </div>
  )
}
