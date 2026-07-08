/**
 * 高维求职 P5·四面 — 面试准备与复盘（面试前/中/后三Tab切换）。
 * Route: /m/career-mentor/simian
 * 严格对齐 m7-v31-p5-simian.html 原型 + 朝有规划 mp-mobile-page 布局模式。
 *
 * 使用 cm-* BEM 类名 + 内联 style。无 Tailwind CSS。
 * 图标使用 @iconify/react <Icon> 组件。返回按钮使用 navigate(-1)。
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import './career-mentor.css';

type TabKey = 'before' | 'during' | 'after';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'before', label: '面试前' },
  { key: 'during', label: '面试中' },
  { key: 'after', label: '面试后' },
];

export function CareerMentorSimian() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>('before');

  return (
    <div className="cm-mobile-page">

      {/* ===== 顶部栏 ===== */}
      <header className="cm-mobile-page__header">
        <button className="cm-header-btn" onClick={() => navigate(-1)}>
          <Icon icon="mingcute:left-line" width={24} />
        </button>
        <div className="cm-header-subtitle-row">
          <div className="cm-header-subtitle-main">STEP 4 · 四面</div>
          <div className="cm-header-subtitle-sub">面试准备与复盘</div>
        </div>
        <div className="cm-header-spacer" />
      </header>

      {/* ===== Tab 切换 ===== */}
      <div className="cm-tab-bar">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`cm-tab ${activeTab === tab.key ? 'cm-tab--active' : 'cm-tab--inactive'}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== 内容区 ===== */}
      <main className="cm-main-scroll">
        <div className="cm-main-padding" style={{ gap: 14 }}>

          {/* 品牌语 */}
          <div className="cm-hero">
            <p className="cm-hero__slogan">日耕朝夕，耕愈工作，耕暖生活</p>
            <p className="cm-hero__title" style={{ fontSize: 17 }}>高维五步法，前程自发光</p>
          </div>

          {/* ════════ Tab1: 面试前 ════════ */}
          {activeTab === 'before' && (
            <>
              <div>
                <div className="cm-module-card__header">
                  <Icon icon="mingcute:building-2-line" className="cm-module-card__header-icon" width={18} />
                  <span className="cm-module-card__header-title">企业情报</span>
                  <span className="cm-module-card__header-badge">老师交付</span>
                </div>
                <div className="cm-module-card__empty">
                  <div className="cm-module-card__empty-icon">
                    <Icon icon="mingcute:building-2-line" width={24} />
                  </div>
                  <p className="cm-module-card__empty-title">暂无企业情报</p>
                  <p className="cm-module-card__empty-desc">收到面试邀约后，安老师会为您准备目标企业的详细情报～</p>
                </div>
              </div>

              <div>
                <div className="cm-module-card__header">
                  <Icon icon="mingcute:chart-pie-line" className="cm-module-card__header-icon" width={18} />
                  <span className="cm-module-card__header-title">胜任力匹配分析</span>
                </div>
                <div className="cm-module-card__empty">
                  <div className="cm-module-card__empty-icon">
                    <Icon icon="mingcute:chart-pie-line" width={24} />
                  </div>
                  <p className="cm-module-card__empty-title">暂无匹配分析</p>
                  <p className="cm-module-card__empty-desc">添加目标企业后，系统自动对比您的技能晶体与岗位要求～</p>
                </div>
              </div>

              <div>
                <div className="cm-module-card__header">
                  <Icon icon="mingcute:strategy-line" className="cm-module-card__header-icon" width={18} />
                  <span className="cm-module-card__header-title">面试策略</span>
                </div>
                <div className="cm-module-card__empty">
                  <div className="cm-module-card__empty-icon">
                    <Icon icon="mingcute:strategy-line" width={24} />
                  </div>
                  <p className="cm-module-card__empty-title">暂无面试策略</p>
                  <p className="cm-module-card__empty-desc">匹配分析和企业情报就绪后，自动生成沟通主题、话术和注意事项～</p>
                </div>
              </div>

              <div>
                <div className="cm-module-card__header">
                  <Icon icon="mingcute:question-line" className="cm-module-card__header-icon" width={18} />
                  <span className="cm-module-card__header-title">预判面试问题</span>
                </div>
                <div className="cm-module-card__empty">
                  <div className="cm-module-card__empty-icon">
                    <Icon icon="mingcute:question-line" width={24} />
                  </div>
                  <p className="cm-module-card__empty-title">暂无预判问题</p>
                  <p className="cm-module-card__empty-desc">确定目标企业和岗位后，AI自动生成高频面试问题及回答要点～</p>
                </div>
              </div>
            </>
          )}

          {/* ════════ Tab2: 面试中 ════════ */}
          {activeTab === 'during' && (
            <>
              <div className="cm-interview-card">
                <div className="cm-interview-card__recording-icon">
                  <Icon icon="mingcute:mic-line" width={28} />
                </div>
                <h3 className="cm-interview-card__title">准备开始面试录音</h3>
                <p className="cm-interview-card__subtitle">标记场景：高维求职面试</p>
                <p className="cm-interview-card__desc">
                  面试开始后点击下方按钮，<br />小耕帮您实时录音并同步提词器～
                </p>

                <div className="cm-teleprompter">
                  <div className="cm-teleprompter__label">面试提词器</div>
                  <p className="cm-teleprompter__empty">面试策略制定后，提词要点将自动同步到此处</p>
                </div>

                <button className="cm-record-btn">
                  <Icon icon="mingcute:mic-line" width={20} />
                  开始面试录音
                </button>
              </div>
            </>
          )}

          {/* ════════ Tab3: 面试后 ════════ */}
          {activeTab === 'after' && (
            <div>
              <div className="cm-module-card__header">
                <Icon icon="mingcute:ai-line" className="cm-module-card__header-icon" width={18} />
                <span className="cm-module-card__header-title">面试录音分析</span>
              </div>
              <div className="cm-module-card__empty">
                <div className="cm-module-card__empty-icon">
                  <Icon icon="mingcute:file-text-line" width={24} />
                </div>
                <p className="cm-module-card__empty-title">暂无面试录音</p>
                <p className="cm-module-card__empty-desc">完成面试录音后，AI自动分析亮点、改进点和下一步建议～</p>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
