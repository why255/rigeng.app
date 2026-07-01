import { NavLink } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { BOARDS, getModulesByBoard, MAIN_SLOGAN, BRAND_NAME } from '@rigeng/shared/data/modules';

/** 侧边栏短 slogan：取 MAIN_SLOGAN 后半段 "耕愈工作，耕暖生活" */
const SIDEBAR_SLOGAN = MAIN_SLOGAN.replace(/^日耕朝夕[，,]\s*/, '');

function isSuperAdmin(): boolean {
  try {
    const u = JSON.parse(localStorage.getItem('rg_user') || '{}');
    return u.role === 'superadmin';
  } catch { return false; }
}

/**
 * 模块 → iconify 图标映射（mingcute 图标集）
 * 与 navigation.md 标准侧边栏模板保持一致
 */
const MODULE_ICON_MAP: Record<string, string> = {
  'morning-plan': 'mingcute:calendar-2-line',
  'evening-review': 'mingcute:history-line',
  'mood-haven': 'mingcute:leaf-line',
  'smart-record': 'mingcute:mic-line',
  'smart-qa': 'mingcute:question-line',
  'smart-office': 'mingcute:computer-line',
  'career-mentor': 'mingcute:suitcase-line',
  'brand-building': 'mingcute:star-line',
  'acquire-client': 'mingcute:user-3-line',
  'product-design': 'mingcute:box-3-line',
  'deliver-order': 'mingcute:clipboard-line',
  'knowledge-base': 'mingcute:book-6-line',
  'data-analytics': 'mingcute:chart-line',
};

/**
 * PC 左侧导航栏（深色侧栏，始终显示）
 * 所有板块默认展开，当前页面菜单高亮
 */
export function Sidebar() {
  return (
    <aside className="rg-sidebar">
      {/* 品牌 Logo 区 */}
      <div className="rg-sidebar__brand">
        <div className="rg-sidebar__brand-logo">
          <span>耕</span>
        </div>
        <div className="rg-sidebar__brand-text">
          <span className="rg-sidebar__brand-name">{BRAND_NAME}</span>
          <span className="rg-sidebar__slogan">{SIDEBAR_SLOGAN}</span>
        </div>
      </div>

      {/* 导航板块 — 全部展开 */}
      <nav className="rg-sidebar__nav">
        {BOARDS.map((board) => {
          const modules = getModulesByBoard(board.id);

          return (
            <div key={board.id} className="rg-sidebar__board-group">
              {/* 板块标题 */}
              <div className="rg-sidebar__board">
                <span>
                  {board.name}
                  {board.id === 'board4' && (
                    <span className="rg-sidebar__board-badge">PRIVATE</span>
                  )}
                </span>
                <span className="rg-sidebar__board-arrow">
                  <Icon icon="mingcute:down-line" />
                </span>
              </div>

              {/* 模块列表 */}
              <div className="rg-sidebar__board-group-content">
                {modules.map((m) => (
                  <NavLink
                    key={m.slug}
                    to={`/m/${m.slug}`}
                    className={({ isActive }) =>
                      `rg-navitem ${isActive ? 'rg-navitem--active' : ''}`
                    }
                  >
                    <span className="rg-navitem__icon">
                      <Icon icon={MODULE_ICON_MAP[m.slug] || 'mingcute:asterisk-line'} />
                    </span>
                    <span>{m.name}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}

        {/* 管理后台入口 — 仅 superadmin 可见 */}
        {isSuperAdmin() && (
          <div className="rg-sidebar__board-group">
            <div className="rg-sidebar__board">
              <span>管理后台</span>
              <span className="rg-sidebar__board-badge">ADMIN</span>
            </div>
            <div className="rg-sidebar__board-group-content">
              <NavLink to="/admin" className={({ isActive }) => `rg-navitem ${isActive ? 'rg-navitem--active' : ''}`}>
                <span className="rg-navitem__icon"><Icon icon="mingcute:dashboard-line" /></span>
                <span>控制台</span>
              </NavLink>
              <NavLink to="/admin/users" className={({ isActive }) => `rg-navitem ${isActive ? 'rg-navitem--active' : ''}`}>
                <span className="rg-navitem__icon"><Icon icon="mingcute:user-4-line" /></span>
                <span>用户管理</span>
              </NavLink>
              <NavLink to="/admin/teachers" className={({ isActive }) => `rg-navitem ${isActive ? 'rg-navitem--active' : ''}`}>
                <span className="rg-navitem__icon"><Icon icon="mingcute:group-line" /></span>
                <span>老师管理</span>
              </NavLink>
            </div>
          </div>
        )}
      </nav>

      {/* 底部设置 */}
      <div className="rg-sidebar__footer">
        <NavLink
          to="/m/morning-plan/settings"
          className="rg-sidebar__settings-link"
          title="设置"
        >
          <Icon icon="mingcute:settings-3-line" />
        </NavLink>
      </div>
    </aside>
  );
}
