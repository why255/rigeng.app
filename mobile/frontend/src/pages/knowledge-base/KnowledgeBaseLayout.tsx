/**
 * 公私智库 — Layout 共享壳
 * 提供品牌标语 header + 返回按钮 + Outlet 子页面渲染 + 滚动容器
 *
 * 使用 kb-* BEM 类名 + 内联 style。无 Tailwind CSS。
 * 图标使用 @iconify/react <Icon> 组件。
 */
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Icon } from '@iconify/react';
import './knowledge-base.css';

/** 页面标题映射 */
const PAGE_TITLES: Record<string, string> = {
  '/m/knowledge-base': '公私智库',
  '/m/knowledge-base/list': '私有知识库',
  '/m/knowledge-base/export': '导出文档',
  '/m/knowledge-base/audit': '待审核区',
  '/m/knowledge-base/public': '携君知识库',
};

export function KnowledgeBaseLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;
  const isPublic = path === '/m/knowledge-base/public';
  const title = PAGE_TITLES[path] || '公私智库';

  return (
    <div className="kb-page">
      {/* Header */}
      <header className="kb-page__header">
        <button
          className="kb-header-btn"
          onClick={() => navigate(-1)}
          aria-label="返回"
        >
          <Icon icon="mingcute:left-line" style={{ fontSize: '24px' }} />
        </button>
        <span
          className={`kb-header-title${isPublic ? ' kb-header-title--public' : ''}`}
        >
          {title}
        </span>
        <div className="kb-header-spacer" />
      </header>

      {/* Scrollable main area */}
      <main className="kb-main-scroll">
        <Outlet />
      </main>
    </div>
  );
}
