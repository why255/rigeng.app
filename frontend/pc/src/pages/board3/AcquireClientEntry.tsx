import { useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import '../pages.css'
import './acquire-client.css'

const FLOW_STEPS = [
  { num: 1, title: '客户诊断', desc: 'AI 问卷精准诊断客户需求，匹配最佳服务方案', path: '/m/acquire-client/diagnosis' },
  { num: 2, title: '面谈沟通', desc: '智能提词器 + 录音转写，面谈不掉链子', path: '/m/acquire-client/meeting' },
  { num: 3, title: '签约管理', desc: '合同模板 + 自动生成 + 归档同步 M10', path: '/m/acquire-client/contract' },
]

const RECENT_MEETINGS = [
  { company: '华东科技', progress: 60, contact: '王总监' },
  { company: '盛达集团', progress: 85, contact: '李总' },
]

const TOOLS = [
  { icon: '🔍', label: '客户诊断', path: '/m/acquire-client/diagnosis' },
  { icon: '🎤', label: '面谈沟通', path: '/m/acquire-client/meeting' },
  { icon: '📝', label: '签约管理', path: '/m/acquire-client/contract' },
  { icon: '📊', label: '签约看板', disabled: true },
]

/** M9-P1 拿下一个客户入口 — 流程概览 + 快捷入口 */
export function AcquireClientEntry() {
  const navigate = useNavigate()

  return (
    <PageContainer width="chat">
      <div data-module="acquire-client">
        <p className="ac-slogan">日耕朝夕，耕愈工作，耕暖生活</p>
        <h1 className="ac-brand-title">真诚去触达，信任自然生</h1>

        {/* 模块介绍 */}
        <div className="ac-intro-card">
          <div className="ac-intro-card__icon">🤝</div>
          <div className="ac-intro-card__text">
            <div className="ac-intro-card__title">拿下一个客户</div>
            <div className="ac-intro-card__desc">
              从客户诊断到面谈沟通再到签约管理，系统化地帮你把每一个潜在客户转化为签约客户。
            </div>
            <div className="ac-intro-card__tags">
              <span className="ac-tag">客户诊断</span>
              <span className="ac-tag">面谈沟通</span>
              <span className="ac-tag">签约管理</span>
            </div>
          </div>
        </div>

        {/* 三步流程卡片 */}
        <div className="ac-flow-grid">
          {FLOW_STEPS.map((step) => (
            <div key={step.num} className="ac-flow-card" onClick={() => navigate(step.path)}>
              <div className="ac-flow-card__step">{step.num}</div>
              <div className="ac-flow-card__title">{step.title}</div>
              <div className="ac-flow-card__desc">{step.desc}</div>
              <span className="ac-flow-card__link">进入 →</span>
            </div>
          ))}
        </div>

        {/* 最近面谈 */}
        <div className="ac-section-title">📋 最近面谈</div>
        <div className="ac-meeting-list">
          {RECENT_MEETINGS.map((m) => (
            <div key={m.company} className="ac-meeting-card">
              <span className="ac-meeting-card__company">{m.company}</span>
              <div className="ac-meeting-card__bar">
                <div className="ac-meeting-card__bar-fill" style={{ width: `${m.progress}%` }} />
              </div>
              <span className="ac-meeting-card__pct">{m.progress}%</span>
            </div>
          ))}
        </div>

        {/* 快捷工具 */}
        <div className="ac-section-title">🔧 快捷工具</div>
        <div className="ac-tool-grid">
          {TOOLS.map((tool) => (
            <div
              key={tool.label}
              className={`ac-tool-item ${tool.disabled ? 'ac-tool-item--disabled' : ''}`}
              onClick={() => { if (!tool.disabled && tool.path) navigate(tool.path) }}
            >
              <span className="ac-tool-item__icon">{tool.icon}</span>
              <span className="ac-tool-item__label">{tool.label}</span>
            </div>
          ))}
        </div>
      </div>
    </PageContainer>
  )
}
