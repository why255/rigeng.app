import { useLocation, useNavigate } from 'react-router-dom'
import { BOARDS, getModuleBySlug, getModulesByBoard, type BoardId } from '@/data/modules'

/** 24b · 移动端底部 Tab 栏（80px）。点击 Tab 跳转该板块卡片网格页。 */
export function TabBar() {
  const navigate = useNavigate()
  const location = useLocation()

  // 依据当前路由推断激活的板块
  const activeBoard: BoardId | null = (() => {
    // 首页默认高亮"日耕"板块
    if (location.pathname === '/') return 'board1'
    const m = location.pathname.match(/\/m\/([\w-]+)/)
    if (m) return getModuleBySlug(m[1])?.board ?? null
    const b = location.pathname.match(/\/b\/(board\d)/)
    return (b?.[1] as BoardId) ?? null
  })()

  const go = (board: BoardId) => {
    // 跳转板块卡片网格页
    navigate(`/b/${board}`)
  }

  return (
    <nav className="rg-tabbar">
      {BOARDS.map((b) => (
        <button
          key={b.id}
          className={`rg-tab ${activeBoard === b.id ? 'rg-tab--active' : ''}`}
          onClick={() => go(b.id)}
          aria-label={b.name}
        >
          <span className="rg-tab__icon">{b.icon}</span>
          <span>{b.name}</span>
        </button>
      ))}
    </nav>
  )
}

export { getModulesByBoard }
