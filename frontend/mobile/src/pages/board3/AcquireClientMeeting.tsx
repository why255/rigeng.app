import { useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import '../pages.css'
import './acquire-client.css'

const PROMPTS = [
  { text: '感谢王总抽出时间，我们根据上次沟通，准备了一份初步的服务方案...', border: 'red' },
  { text: '想了解一下，贵司目前在人才发展方面遇到的最大瓶颈是什么？', border: 'blue' },
  { text: '关于预算的顾虑我完全理解，我们也可以分阶段推进，先做一个小范围的试点...', border: 'orange' },
  { text: '那今天的沟通非常有成效，我来总结一下接下来的三件事...', border: 'blue' },
]

const TRANSCRIPT = [
  { speaker: '客户', text: '我们今年的重点是区域扩张，急需一批能带团队的中层管理者。' },
  { speaker: '我', text: '了解，区域扩张确实对管理人才的要求非常高。我之前服务过的盛达集团也遇到过类似的情况...' },
  { speaker: '客户', text: '那你们当时是怎么解决的？我们现在最大的问题是内部培养速度跟不上。' },
]

const EXTRACTIONS = [
  { icon: '🎯', label: '关键需求', text: '区域扩张所需的中层管理人才，内部培养速度滞后' },
  { icon: '💰', label: '预算范围', text: '30-100万区间，倾向分阶段投入，优先试点' },
  { icon: '✅', label: '行动项', text: '1. 本周五前提交试点方案  2. 下周三安排案例参观' },
]

/** M9-P3 面谈沟通 — 提词器 + 录音 + 转录 + AI 提取 */
export function AcquireClientMeeting() {
  const navigate = useNavigate()

  return (
    <PageContainer width="chat">
      <div data-module="acquire-client">
        {/* 页面头部 */}
        <div className="ac-page-header">
          <p className="ac-slogan">日耕朝夕，耕愈工作，耕暖生活</p>
          <div className="ac-page-header__row">
            <h3 className="ac-brand-sub">真诚去触达，信任自然生</h3>
            <span className="ac-page-badge">面谈沟通</span>
          </div>
        </div>

        {/* 客户信息 */}
        <div className="ac-client-card">
          <div className="ac-client-card__avatar">🏢</div>
          <div className="ac-client-card__info">
            <div className="ac-client-card__name">华东科技</div>
            <div className="ac-client-card__detail">联系人：王总监 · 第3轮面谈</div>
          </div>
          <span className="ac-client-card__badge">匹配度 85%</span>
        </div>

        {/* 合规提示 */}
        <div className="ac-compliance" style={{ marginBottom: 20 }}>
          <span className="ac-compliance__icon">⚠️</span>
          <span className="ac-compliance__text">
            录音前请确认已获得客户同意。录音数据全程加密，仅用于本模块服务分析。
          </span>
        </div>

        {/* 提词器 */}
        <div className="ac-teleprompter">
          <div className="ac-teleprompter__header">
            <span className="ac-teleprompter__title">📋 话术提词器</span>
            <span className="ac-teleprompter__refresh">🔄 换一批</span>
          </div>
          {PROMPTS.map((p, i) => (
            <div key={i} className={`ac-prompt-card ac-prompt-card--${p.border}`}>
              {p.text}
            </div>
          ))}
          <div style={{ fontSize: 'var(--font-size-l7)', color: 'var(--color-neutral-500)', marginTop: 8 }}>
            💡 与 M4 智能记录联动，面谈中可随时调取历史记录
          </div>
        </div>

        {/* 录音区 */}
        <div className="ac-record-card">
          <button className="ac-record-btn">
            <div className="ac-record-btn__inner" />
          </button>
          <div className="ac-record-hint">点击开始录音，最大 60 分钟</div>
        </div>

        {/* 实时转录 */}
        <div className="ac-transcript">
          <div className="ac-transcript__header">
            <span className="ac-transcript__title">📝 实时转录</span>
            <span className="ac-transcript__live">
              <span className="ac-transcript__live-dot" /> 录音中
            </span>
          </div>
          {TRANSCRIPT.map((line, i) => (
            <div key={i} className="ac-transcript__line">
              <span className="ac-transcript__speaker">{line.speaker}：</span>
              {line.text}
            </div>
          ))}
        </div>

        {/* AI 提取 */}
        <div className="ac-extract-card">
          <div className="ac-extract-card__title">🤖 AI 关键信息提取</div>
          {EXTRACTIONS.map((e) => (
            <div key={e.label} className="ac-extract-item">
              <span className="ac-extract-item__icon">{e.icon}</span>
              <span className="ac-extract-item__label">{e.label}：</span>
              <span className="ac-extract-item__text">{e.text}</span>
            </div>
          ))}
        </div>

        {/* 面谈操作 */}
        <div className="ac-meeting-actions">
          <button className="ac-meeting-btn ac-meeting-btn--primary" onClick={() => navigate('/m/acquire-client/contract')}>
            ✅ 面谈完成 → 进入签约
          </button>
          <button className="ac-meeting-btn ac-meeting-btn--secondary" onClick={() => navigate('/m/acquire-client/contract')}>
            ⏭️ 跳过，直接去签约
          </button>
        </div>

        {/* 底部导航 */}
        <div className="ac-bottom-nav">
          <span className="ac-bottom-nav__back" onClick={() => navigate('/m/acquire-client/diagnosis')}>← 返回诊断</span>
          <button className="ac-bottom-nav__forward" onClick={() => navigate('/m/acquire-client/contract')}>
            进入签约管理 →
          </button>
        </div>
      </div>
    </PageContainer>
  )
}
