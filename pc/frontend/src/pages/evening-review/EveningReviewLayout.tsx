/**
 * EveningReviewLayout — 暮有复盘模块布局（PC端），提供共享状态。
 */
import { Outlet } from 'react-router-dom';

export function EveningReviewLayout() {
  return (
    <div data-module="evening-review">
      <Outlet />
    </div>
  );
}
