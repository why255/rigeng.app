/**
 * SmartQaLayout — 智能问答模块布局，提供嵌套路由出口。
 * Route: /m/smart-qa
 * 对齐 morning-plan Layout 模式。
 */
import { Outlet } from 'react-router-dom';

export function SmartQaLayout() {
  return <Outlet />;
}
