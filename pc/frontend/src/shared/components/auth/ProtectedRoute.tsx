import { Navigate } from 'react-router-dom';

function hasToken(): boolean {
  try {
    return !!localStorage.getItem('rg_token');
  } catch {
    return false;
  }
}

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * 路由守卫组件。
 * 无 token → 重定向到 /login；已登录 → 正常渲染子组件。
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  if (!hasToken()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
