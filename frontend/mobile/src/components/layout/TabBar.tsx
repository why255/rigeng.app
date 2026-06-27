import { useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'

/** 底部 Tab 配置：5 个固定标签 */
interface TabConfig {
  key: string
  label: string
  link: string
  iconLine: string   // 未选中图标（line 后缀）
  iconFill: string   // 选中图标（fill 后缀）
  /** 匹配当前路由的 slug 列表 */
  slugs: string[]
}

const TABS: TabConfig[] = [
  {
    key: 'rigeng',
    label: '日耕',
    link: '/b/board1',
    iconLine: 'mingcute:home-5-line',
    iconFill: 'mingcute:home-5-fill',
    slugs: ['morning-plan', 'evening-review', 'mood-haven'],
  },
  {
    key: 'salary',
    label: '涨薪',
    link: '/b/board2',
    iconLine: 'mingcute:trending-up-line',
    iconFill: 'mingcute:trending-up-fill',
    slugs: ['smart-record', 'smart-qa', 'smart-office', 'career-mentor'],
  },
  {
    key: 'upgrade',
    label: '升级',
    link: '/b/board3',
    iconLine: 'mingcute:star-line',
    iconFill: 'mingcute:star-fill',
    slugs: ['brand-building', 'acquire-client', 'product-design', 'deliver-order'],
  },
  {
    key: 'thinktank',
    label: '智库',
    link: '/b/board4',
    iconLine: 'mingcute:book-6-line',
    iconFill: 'mingcute:book-6-fill',
    slugs: ['knowledge-base', 'data-analytics'],
  },
  {
    key: 'me',
    label: '我的',
    link: '/b/board5',
    iconLine: 'mingcute:user-3-line',
    iconFill: 'mingcute:user-3-fill',
    slugs: ['membership', 'journey'],
  },
]

/**
 * 移动端底部 Tab 栏（80px）
 * 5 个固定标签：日耕 / 涨薪 / 升级 / 智库 / 我的
 * 根据当前路由自动高亮对应 Tab
 */
export function TabBar() {
  const navigate = useNavigate()
  const location = useLocation()

  // 从当前路径提取模块 slug，匹配应高亮的 Tab
  const activeKey = (() => {
    const m = location.pathname.match(/\/m\/([\w-]+)/)
    if (m) {
      const slug = m[1]
      return TABS.find((t) => t.slugs.includes(slug))?.key ?? null
    }
    // 匹配 /settings 或 /b/:board 等路径
    if (location.pathname === '/settings' || location.pathname.startsWith('/settings')) {
      return 'me'
    }
    // /b/:board 路由：根据 board ID 推断
    const b = location.pathname.match(/\/b\/(board\d)/)
    if (b) {
      const boardMap: Record<string, string> = {
        board1: 'rigeng',
        board2: 'salary',
        board3: 'upgrade',
        board4: 'thinktank',
        board5: 'me',
      }
      return boardMap[b[1]] ?? null
    }
    // 首页默认高亮日耕
    if (location.pathname === '/') return 'rigeng'
    return null
  })()

  return (
    <nav className="rg-tabbar">
      {TABS.map((tab) => {
        const isActive = activeKey === tab.key
        return (
          <button
            key={tab.key}
            className={`rg-tab${isActive ? ' rg-tab--active' : ''}`}
            onClick={() => navigate(tab.link)}
            aria-label={tab.label}
          >
            <Icon
              icon={isActive ? tab.iconFill : tab.iconLine}
              className="rg-tab__icon"
            />
            <span className="rg-tab__label">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
