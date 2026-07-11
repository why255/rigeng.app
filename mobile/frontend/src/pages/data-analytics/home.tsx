/**
 * M13-P1 数据分析入口页 — 移动端（占位）
 * Route: /m/data-analytics
 *
 * 原型 m13-p1-mobile.html / m13-p2-mobile.html 尚未创建，
 * 当前为占位页面，待原型就绪后完整实现。
 *
 * 使用 kb-* BEM 类名（复用公私智库布局壳）+ 内联 style。
 * 图标使用 @iconify/react <Icon> 组件。无 emoji 字符。
 */
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import '../knowledge-base/knowledge-base.css';

export function AnalyticsHome() {
  const navigate = useNavigate();

  return (
    <div className="kb-page">
      {/* Header — 左上角返回按钮 */}
      <header className="kb-page__header">
        <button
          className="kb-header-btn"
          onClick={() => navigate(-1)}
          aria-label="返回"
        >
          <Icon icon="mingcute:left-line" style={{ fontSize: '24px' }} />
        </button>
        <span className="kb-header-title">数据分析</span>
        <div className="kb-header-spacer" />
      </header>

      {/* 占位内容 */}
      <main className="kb-main-scroll">
        <div className="kb-main-padding">
          {/* 品牌标语 */}
          <div className="kb-hero">
            <p className="kb-hero__slogan">日耕朝夕，耕愈工作，耕暖生活</p>
            <h2 className="kb-hero__title">数据照一照，看到好自己</h2>
          </div>

          {/* 占位卡片 */}
          <div className="kb-card" style={{ textAlign: 'center', padding: '48px 20px' }}>
            <Icon
              icon="mingcute:chart-bar-line"
              style={{ fontSize: '48px', color: '#6B8E23', marginBottom: '16px' }}
            />
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#333', marginBottom: '8px' }}>
              数据分析模块开发中
            </p>
            <p style={{ fontSize: '12px', color: '#999' }}>
              全平台仪表盘一屏看全貌，数据是照见成长的镜子
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
