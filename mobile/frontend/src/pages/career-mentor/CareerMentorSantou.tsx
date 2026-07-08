/**
 * 高维求职 P4·三投 — 投递追踪与分析（数据概览 + 新增记录 + 投递列表）。
 * Route: /m/career-mentor/santou
 * 严格对齐 m7-v31-p4-santou.html 原型 + 朝有规划 mp-mobile-page 布局模式。
 *
 * 使用 cm-* BEM 类名 + 内联 style。无 Tailwind CSS。
 * 图标使用 @iconify/react <Icon> 组件。返回按钮使用 navigate(-1)。
 */
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import './career-mentor.css';

export function CareerMentorSantou() {
  const navigate = useNavigate();

  return (
    <div className="cm-mobile-page">

      {/* ===== 顶部栏 ===== */}
      <header className="cm-mobile-page__header">
        <button className="cm-header-btn" onClick={() => navigate(-1)}>
          <Icon icon="mingcute:left-line" width={24} />
        </button>
        <div className="cm-header-subtitle-row">
          <div className="cm-header-subtitle-main">STEP 3 · 三投</div>
          <div className="cm-header-subtitle-sub">投递追踪与分析</div>
        </div>
        <div className="cm-header-spacer" />
      </header>

      {/* ===== 内容区 ===== */}
      <main className="cm-main-scroll">
        <div className="cm-main-padding" style={{ gap: 14 }}>

          {/* 品牌语 */}
          <div className="cm-hero">
            <p className="cm-hero__slogan">日耕朝夕，耕愈工作，耕暖生活</p>
            <p className="cm-hero__title" style={{ fontSize: 17 }}>高维五步法，前程自发光</p>
          </div>

          {/* 投递数据概览 */}
          <div className="cm-stats-row">
            <div className="cm-stat-card">
              <div className="cm-stat-card__num">0</div>
              <div className="cm-stat-card__label">累计投递</div>
            </div>
            <div className="cm-stat-card">
              <div className="cm-stat-card__num">0</div>
              <div className="cm-stat-card__label">面试邀约</div>
            </div>
            <div className="cm-stat-card">
              <div className="cm-stat-card__num">--</div>
              <div className="cm-stat-card__label">邀约率</div>
            </div>
          </div>

          {/* 引导提示 */}
          <div className="cm-guide-tip">
            <Icon icon="mingcute:information-line" className="cm-guide-tip__icon" width={18} />
            <div className="cm-guide-tip__body">
              <div className="cm-guide-tip__title">开始投递，数据自动汇总</div>
              <div className="cm-guide-tip__desc">每次投递后回到这里记录，小耕帮您追踪进展、分析邀约率～</div>
            </div>
          </div>

          {/* 新增投递按钮 */}
          <button className="cm-add-btn">
            <Icon icon="mingcute:add-line" width={20} />
            新增投递记录
          </button>

          {/* 投递列表 */}
          <div>
            <div className="cm-filter-row">
              <h3 className="cm-filter-row__title">投递记录</h3>
              <div className="cm-filter-tags">
                <button className="cm-filter-tag">全部</button>
                <button className="cm-filter-tag">筛选中</button>
                <button className="cm-filter-tag">已邀约</button>
                <button className="cm-filter-tag">已结束</button>
              </div>
            </div>

            <div className="cm-list-empty">
              <div className="cm-list-empty__icon">
                <Icon icon="mingcute:inbox-line" width={28} />
              </div>
              <p className="cm-list-empty__title">还没有投递记录</p>
              <p className="cm-list-empty__desc">
                点击上方「新增投递记录」按钮，<br />开始追踪您的求职进展～
              </p>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
