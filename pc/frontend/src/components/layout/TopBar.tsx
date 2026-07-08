import { NavLink } from 'react-router-dom';
import { type ModuleMeta, BOARDS } from '@/shared/data/modules';
import { VoiceButton } from '@/shared/components/chat';

/**
 * PC 顶部栏（64px）：始终显示面包屑导航 + 语音按钮 + 用户头像
 * 无移动端品牌行逻辑
 */
export function TopBar({ module, offline }: { module?: ModuleMeta; offline?: boolean }) {
  // 找到模块所属板块
  const board = module
    ? BOARDS.find((b) => b.id === module.board)
    : undefined;

  return (
    <>
      <header className="rg-topbar">
        <div className="rg-topbar__left">
          {/* 面包屑: 板块名 / 模块名 */}
          {module && board ? (
            <span className="rg-topbar__breadcrumb">
              <span className="rg-topbar__breadcrumb-board">{board.name}</span>
              <span className="rg-topbar__breadcrumb-sep">/</span>
              <span className="rg-topbar__breadcrumb-module">{module.name}</span>
            </span>
          ) : (
            <span className="rg-topbar__breadcrumb">
              <span className="rg-topbar__breadcrumb-module">首页</span>
            </span>
          )}
        </div>

        <div className="rg-topbar__right">
          <VoiceButton size="sm" aria-label="语音唤醒小耕" />
          <NavLink to="/m/morning-plan/settings" className="rg-topbar__settings" title="设置">
            ⚙
          </NavLink>
          <div className="rg-topbar__user">
            <div className="rg-topbar__user-avatar">
              <img
                src="https://modao.cc/agent-py/media/generated_images/2026-06-21/f6716f9433cc4691b61785d37d4b621e.jpg"
                alt="User Avatar"
              />
            </div>
            <span className="rg-topbar__user-name">苏东坡</span>
          </div>
        </div>
      </header>
      {offline && <div className="rg-offline">📡 当前处于离线状态，部分功能仅本地可用</div>}
    </>
  );
}
