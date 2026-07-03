/**
 * MorningPlanLayout — 朝有规划模块布局，提供共享状态。
 * 所有子页面通过 <Outlet /> 渲染，共享同一个 MorningPlanProvider。
 */
import { Outlet } from 'react-router-dom';
import { MorningPlanProvider } from '@rigeng/shared/context/MorningPlanContext';

export function MorningPlanLayout() {
  return (
    <MorningPlanProvider>
      <Outlet />
    </MorningPlanProvider>
  );
}
