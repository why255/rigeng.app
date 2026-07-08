/**
 * 高维求职入口页 (P1) — 品牌标语 + 小耕欢迎语 + 五步进度 + 快速入口 + 数据提示。
 * Route: /m/career-mentor
 * 严格对齐 m7-v31-p1-entry.html 原型 + 朝有规划 mp-mobile-page 布局模式。
 *
 * 使用 cm-* BEM 类名 + 内联 style。无 Tailwind CSS。
 * 图标使用 @iconify/react <Icon> 组件。返回按钮使用 navigate(-1)。
 */
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import './career-mentor.css';

export function CareerMentorEntry() {
  const navigate = useNavigate();

  return (
    <div className="cm-mobile-page">

      {/* ===== 顶部栏 ===== */}
      <header className="cm-mobile-page__header">
        <button className="cm-header-btn" onClick={() => navigate(-1)}>
          <Icon icon="mingcute:left-line" width={24} />
        </button>
        <span className="cm-header-title">高维求职</span>
        <div className="cm-header-spacer" />
      </header>

      {/* ===== 内容区 ===== */}
      <main className="cm-main-scroll">
        <div className="cm-main-padding" style={{ gap: 18 }}>

          {/* 品牌 Slogan */}
          <div className="cm-hero">
            <p className="cm-hero__slogan">日耕朝夕，耕愈工作，耕暖生活</p>
            <h1 className="cm-hero__title">高维五步法，前程自发光</h1>
          </div>

          {/* 小耕欢迎语 */}
          <div className="cm-welcome cm-fade-up">
            <div className="cm-welcome__avatar">
              <span className="cm-welcome__avatar-text">耕</span>
            </div>
            <div className="cm-welcome__text">
              <p style={{ margin: 0 }}>
                欢迎来到<strong>高维求职</strong>～我是小耕，接下来我会用<strong>五步法</strong>陪您走完求职全程：从盘点个人资产、制定求职策略、追踪投递进展，到面试准备复盘、Offer对比选择。
              </p>
              <p style={{ margin: 0, marginTop: 8 }}>
                您只需要像聊天一样跟我说话就行，我会一步一步引导您～
              </p>
            </div>
          </div>

          {/* 五步法进度 */}
          <div>
            <div className="cm-steps-section__header">
              <span className="cm-steps-section__title">求职进度</span>
              <span className="cm-steps-section__count">0/5 步完成</span>
            </div>
            <div className="cm-steps-bar">
              <div className="cm-steps-bar__line" />
              <div className="cm-step-node">
                <div className="cm-step-node__dot cm-step-node__dot--active">
                  <div className="cm-step-node__dot-inner" />
                </div>
                <span className="cm-step-node__name cm-step-node__name--active">一盘</span>
                <span className="cm-step-node__desc">简历重构</span>
              </div>
              <div className="cm-step-node">
                <div className="cm-step-node__dot cm-step-node__dot--inactive">
                  <span className="cm-step-node__number">2</span>
                </div>
                <span className="cm-step-node__name cm-step-node__name--inactive">二定</span>
                <span className="cm-step-node__desc">策略资源</span>
              </div>
              <div className="cm-step-node">
                <div className="cm-step-node__dot cm-step-node__dot--inactive">
                  <span className="cm-step-node__number">3</span>
                </div>
                <span className="cm-step-node__name cm-step-node__name--inactive">三投</span>
                <span className="cm-step-node__desc">投递追踪</span>
              </div>
              <div className="cm-step-node">
                <div className="cm-step-node__dot cm-step-node__dot--inactive">
                  <span className="cm-step-node__number">4</span>
                </div>
                <span className="cm-step-node__name cm-step-node__name--inactive">四面</span>
                <span className="cm-step-node__desc">面试复盘</span>
              </div>
              <div className="cm-step-node">
                <div className="cm-step-node__dot cm-step-node__dot--inactive">
                  <span className="cm-step-node__number">5</span>
                </div>
                <span className="cm-step-node__name cm-step-node__name--inactive">五选</span>
                <span className="cm-step-node__desc">Offer入职</span>
              </div>
            </div>
          </div>

          {/* 快速入口卡片 */}
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#333', marginBottom: 10 }}>选择开始方式</h3>
            <div className="cm-entry-cards">
              <div className="cm-entry-card cm-entry-card--primary" onClick={() => navigate('/m/career-mentor/yipan')}>
                <div className="cm-entry-card__icon cm-entry-card__icon--red">
                  <Icon icon="mingcute:file-info-line" width={24} />
                </div>
                <div className="cm-entry-card__body">
                  <div className="cm-entry-card__title">我有简历，直接上传</div>
                  <div className="cm-entry-card__desc">上传最新简历，AI自动解码分析，快速启动五步法</div>
                </div>
                <Icon icon="mingcute:right-line" className="cm-entry-card__arrow cm-entry-card__arrow--active" width={20} />
              </div>
              <div className="cm-entry-card cm-entry-card--secondary" onClick={() => navigate('/m/career-mentor/yipan')}>
                <div className="cm-entry-card__icon cm-entry-card__icon--blue">
                  <Icon icon="mingcute:message-line" width={24} />
                </div>
                <div className="cm-entry-card__body">
                  <div className="cm-entry-card__title">没有简历，从小耕对话开始</div>
                  <div className="cm-entry-card__desc">小耕用自然语言引导您梳理经历，不用担心不会写</div>
                </div>
                <Icon icon="mingcute:right-line" className="cm-entry-card__arrow" width={20} />
              </div>
            </div>
          </div>

          {/* 数据沉淀提示 */}
          <div className="cm-data-hint">
            <Icon icon="mingcute:information-line" className="cm-data-hint__icon" width={18} />
            <div>
              <div className="cm-data-hint__title">全程数据自动归档</div>
              <div className="cm-data-hint__desc">
                五步法全过程数据自动归档至您的<strong>私有知识库</strong>。萃取的技能晶体可被品牌打造中心复用，求职资料永久保留、随时回来继续。
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
