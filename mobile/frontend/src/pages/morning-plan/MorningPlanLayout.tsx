/**
 * MorningPlanLayout — 朝有规划模块布局，提供共享 MorningPlanProvider。
 */
import { Outlet } from 'react-router-dom';
import { MorningPlanProvider } from '@/shared/context/MorningPlanContext';

export function MorningPlanLayout() {
  return (
    <MorningPlanProvider>
      <Outlet />
    </MorningPlanProvider>
  );
}
