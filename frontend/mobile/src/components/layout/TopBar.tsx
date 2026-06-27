import { MAIN_SLOGAN, BRAND_NAME, type ModuleMeta, BOARDS } from '@rigeng/shared/data/modules';

/**
 * 移动端紧凑顶部栏（64px）：
 * 显示品牌名 + slogan，无 VoiceButton，无面包屑
 */
export function TopBar({ module, offline }: { module?: ModuleMeta; offline?: boolean }) {
  const board = module
    ? BOARDS.find((b) => b.id === module.board)
    : undefined;

  return (
    <>
      <header className="rg-topbar">
        <div className="rg-topbar__left">
          {module && board ? (
            <span className="rg-topbar__breadcrumb">
              <span className="rg-topbar__breadcrumb-board">{board.name}</span>
              <span className="rg-topbar__breadcrumb-sep">/</span>
              <span className="rg-topbar__breadcrumb-module">{module.name}</span>
            </span>
          ) : (
            <div className="rg-topbar__brandline">
              <span className="rg-topbar__brand">{BRAND_NAME}</span>
              <span className="rg-topbar__slogan">{MAIN_SLOGAN}</span>
            </div>
          )}
        </div>
      </header>
      {offline && <div className="rg-offline">📡 当前处于离线状态，部分功能仅本地可用</div>}
    </>
  );
}
