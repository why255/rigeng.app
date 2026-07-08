/**
 * 高维求职 P3·二定 — 求职策略与资源盘点（人脉资源 + 求职计划表）。
 * Route: /m/career-mentor/erding
 * 严格对齐 m7-v31-p3-erding.html 原型 + 朝有规划 mp-mobile-page 布局模式。
 *
 * 使用 cm-* BEM 类名 + 内联 style。无 Tailwind CSS。
 * 图标使用 @iconify/react <Icon> 组件。返回按钮使用 navigate(-1)。
 */
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import './career-mentor.css';

export function CareerMentorErding() {
  const navigate = useNavigate();

  return (
    <div className="cm-mobile-page">

      {/* ===== 顶部栏 ===== */}
      <header className="cm-mobile-page__header">
        <button className="cm-header-btn" onClick={() => navigate(-1)}>
          <Icon icon="mingcute:left-line" width={24} />
        </button>
        <div className="cm-header-subtitle-row">
          <div className="cm-header-subtitle-main">STEP 2 · 二定</div>
          <div className="cm-header-subtitle-sub">求职策略与资源盘点</div>
        </div>
        <div className="cm-header-spacer" />
      </header>

      {/* ===== 五步法迷你进度条 ===== */}
      <div className="cm-mini-steps">
        <div className="cm-mini-steps__line" />
        <span className="cm-mini-steps__dot cm-mini-steps__dot--done">● 1</span>
        <span className="cm-mini-steps__dot cm-mini-steps__dot--active">● 2</span>
        <span className="cm-mini-steps__dot cm-mini-steps__dot--pending">○ 3</span>
        <span className="cm-mini-steps__dot cm-mini-steps__dot--pending">○ 4</span>
        <span className="cm-mini-steps__dot cm-mini-steps__dot--pending">○ 5</span>
      </div>

      {/* ===== 对话区 ===== */}
      <main className="cm-main-scroll" style={{ padding: '16px', background: '#FAF9F7' }}>

        {/* 品牌语 */}
        <div className="cm-hero" style={{ marginBottom: 8 }}>
          <p className="cm-hero__slogan">日耕朝夕，耕愈工作，耕暖生活</p>
          <p className="cm-hero__title" style={{ fontSize: 17 }}>高维五步法，前程自发光</p>
        </div>

        {/* 小耕开场 */}
        <div className="cm-xiaogeng-bubble cm-fade-up">
          <div className="cm-xiaogeng-bubble__avatar">
            <span className="cm-xiaogeng-bubble__avatar-text">耕</span>
          </div>
          <div className="cm-xiaogeng-bubble__body">
            <p>
              一盘盘点已完成！接下来咱们<strong>二定</strong>——盘点您能调动的资源，制定清晰的求职策略。
            </p>
          </div>
        </div>

        {/* ═══ 人脉资源盘点 ═══ */}
        <div style={{ marginTop: 8 }}>
          <div className="cm-block__header">
            <Icon icon="mingcute:group-line" className="cm-block__header-icon" width={18} />
            <span className="cm-block__header-title">人脉资源盘点</span>
          </div>

          <div className="cm-xiaogeng-bubble">
            <div className="cm-xiaogeng-bubble__avatar">
              <span className="cm-xiaogeng-bubble__avatar-text">耕</span>
            </div>
            <div className="cm-xiaogeng-bubble__body">
              <p>
                姐，您想想看——<strong>身边有哪些人可以帮您找工作？</strong>比如前领导、前同事、同学、朋友……不管关系远近，先都列出来。
              </p>
            </div>
          </div>

          <div className="cm-block__empty">
            <div className="cm-block__empty-icon">
              <Icon icon="mingcute:user-add-line" width={24} />
            </div>
            <p className="cm-block__empty-title">尚未添加人脉资源</p>
            <p className="cm-block__empty-desc">点击下方麦克风，告诉小耕您认识哪些可以帮忙的人～</p>
          </div>
        </div>

        {/* ═══ 求职计划表 ═══ */}
        <div style={{ marginTop: 20 }}>
          <div className="cm-block__header">
            <Icon icon="mingcute:target-line" className="cm-block__header-icon" width={18} />
            <span className="cm-block__header-title">求职计划表</span>
          </div>

          <div className="cm-xiaogeng-bubble">
            <div className="cm-xiaogeng-bubble__avatar">
              <span className="cm-xiaogeng-bubble__avatar-text">耕</span>
            </div>
            <div className="cm-xiaogeng-bubble__body">
              <p>
                接下来咱们定策略——<strong>您想去什么行业？期待什么级别？薪资大概什么范围？</strong>您一个一个跟我说就行～
              </p>
            </div>
          </div>

          <div className="cm-block__empty">
            <div className="cm-block__empty-icon">
              <Icon icon="mingcute:document-line" width={24} />
            </div>
            <p className="cm-block__empty-title">尚未制定求职计划</p>
            <p className="cm-block__empty-desc">跟小耕聊聊您的目标行业、职级、薪资期望，自动生成求职计划～</p>
          </div>
        </div>

      </main>

      {/* ===== 底部输入栏 ===== */}
      <div className="cm-input-bar">
        <div className="cm-input-bar__field">
          <Icon icon="mingcute:mic-line" className="cm-input-bar__mic" width={16} />
          <span>按住说话，继续补充...</span>
        </div>
        <button className="cm-input-bar__send">
          <Icon icon="mingcute:send-fill" width={18} />
        </button>
      </div>
    </div>
  );
}
