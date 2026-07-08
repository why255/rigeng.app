/**
 * P1 智能办公首页 — 双库入口卡片 + 最近文档。
 * Route: /m/smart-office/home
 * 对齐 m6-p1-mobile.html 设计规范。
 *
 * 使用 so-* BEM 类名 + 内联 style。无 Tailwind CSS。
 * 图标使用 @iconify/react <Icon> 组件。返回按钮使用 navigate(-1)。
 */
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import './smart-office.css';

export function SmartOfficeHome() {
  const navigate = useNavigate();

  return (
    <div className="so-page">
      {/* ===== 顶部 Header ===== */}
      <header className="so-header">
        <button className="so-header__back" onClick={() => navigate(-1)}>
          <Icon icon="solar:alt-arrow-left-linear" style={{ fontSize: '24px' }} />
        </button>
        <span className="so-header__title">智能办公</span>
        <div className="so-header__spacer" />
      </header>

      <main className="so-main">
        <div className="so-main-pad">
          {/* ===== 品牌标语 ===== */}
          <div>
            <div className="so-hero__slogan">日耕朝夕，耕愈工作，耕暖生活</div>
            <h1 className="so-hero__title">
              告别碎片化<br />高效又专业
            </h1>
          </div>

          {/* ===== 入口卡片 ===== */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 工具库 */}
            <a
              className="so-entry-card"
              onClick={() => navigate('/m/smart-office/tool-library')}
              style={{ cursor: 'pointer' }}
            >
              <div className="so-entry-card__row">
                <div className="so-entry-card__icon" style={{ backgroundColor: 'rgba(192,58,57,0.1)' }}>
                  <Icon icon="mingcute:tool-line" style={{ fontSize: '20px', color: '#C03A39' }} />
                </div>
                <div>
                  <h2 className="so-entry-card__title">工具库</h2>
                  <p className="so-entry-card__sub">按需生成文档，AI引导补全信息</p>
                </div>
              </div>
              <span className="so-entry-card__btn so-entry-card__btn--primary">
                进入工具库
              </span>
            </a>

            {/* 体系库（即将上线） */}
            <div className="so-entry-card">
              <div className="so-entry-card__row">
                <div className="so-entry-card__icon" style={{ backgroundColor: 'rgba(232,169,77,0.1)' }}>
                  <Icon icon="mingcute:flow-chart-line" style={{ fontSize: '20px', color: '#E8A94D' }} />
                </div>
                <div>
                  <h2 className="so-entry-card__title">体系库</h2>
                  <p className="so-entry-card__sub">战略解码→模块搭建，六步闭环</p>
                </div>
              </div>
              <span className="so-entry-card__btn so-entry-card__btn--disabled">
                即将上线
              </span>
            </div>
          </div>

          {/* ===== 最近文档 ===== */}
          <div>
            <div className="so-section__header">
              <h3 className="so-section__title">最近文档</h3>
              <span className="so-section__more">查看全部</span>
            </div>
            <div className="so-empty">
              <span>暂无最近文档</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
