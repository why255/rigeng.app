import { NavLink } from 'react-router-dom';
import { MAIN_SLOGAN, BRAND_NAME, type ModuleMeta, BOARDS } from '@/data/modules';
import { VoiceButton } from '../chat';
import { useIsDesktop } from '@/hooks/useMediaQuery';

/** 24d · 顶部栏（64px）：面包屑导航 + 用户头像 */
export function TopBar({ module, offline }: { module?: ModuleMeta; offline?: boolean }) {
  const isDesktop = useIsDesktop();

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
            <div className="rg-topbar__brandline">
              <span className="rg-topbar__brand">{BRAND_NAME}</span>
              {!isDesktop && <span className="rg-topbar__slogan">{MAIN_SLOGAN}</span>}
            </div>
          )}
        </div>

        <div className="rg-topbar__right">
          {isDesktop && (
            <VoiceButton size="sm" aria-label="语音唤醒小耕" />
          )}
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
