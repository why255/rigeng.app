import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import '../pages.css'
import './acquire-client.css'

const NEGO_STEPS = [
  { key: 'contact', label: '初次接触', status: 'done' as const },
  { key: 'needs', label: '需求确认', status: 'done' as const },
  { key: 'proposal', label: '方案初稿', status: 'done' as const },
  { key: 'negotiate', label: '多轮谈判', status: 'current' as const },
  { key: 'sign', label: '签约落地', status: 'pending' as const },
]

const QUESTIONS = [
  { id: 1, text: '客户目前最关注的核心需求是什么？', type: 'radio', options: ['降本增效', '组织架构优化', '薪酬体系设计', '数字化转型'] },
  { id: 2, text: '项目的紧迫程度如何？', type: 'radio', options: ['非常紧急（1周内启动）', '比较紧急（1个月内）', '一般（3个月内）', '长期规划（半年以上）'] },
  { id: 3, text: '预算范围在哪个区间？', type: 'radio', options: ['10万以下', '10-30万', '30-100万', '100万以上'] },
]

/** M9-P2 客户诊断 — 问卷诊断 + AI 智能洞察 */
export function AcquireClientDiagnosis() {
  const navigate = useNavigate()
  const [qIndex, setQIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({ 1: 1, 2: 2, 3: 1 })
  const [showInsight, setShowInsight] = useState(false)
  const [complianceDismissed, setComplianceDismissed] = useState(false)

  const current = QUESTIONS[qIndex]
  const isLast = qIndex === QUESTIONS.length - 1
  const total = QUESTIONS.length
  const done = Object.keys(answers).length

  return (
    <PageContainer width="chat">
      <div data-module="acquire-client">
        {/* 页面头部 */}
        <div className="ac-page-header">
          <p className="ac-slogan">日耕朝夕，耕愈工作，耕暖生活</p>
          <div className="ac-page-header__row">
            <h3 className="ac-brand-sub">真诚去触达，信任自然生</h3>
            <span className="ac-page-badge">客户诊断</span>
          </div>
        </div>

        {/* 5步谈判进度条 */}
        <div className="ac-step-bar">
          {NEGO_STEPS.map((s) => (
            <div key={s.key} className="ac-step-node">
              <div className={`ac-step-node__circle ac-step-node__circle--${s.status}`}>
                {s.status === 'done' ? '✓' : NEGO_STEPS.indexOf(s) + 1}
              </div>
              <span className={`ac-step-node__label ${s.status === 'current' ? 'ac-step-node__label--active' : ''}`}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* 合规提示 */}
        {!complianceDismissed && (
          <div className="ac-compliance">
            <span className="ac-compliance__icon">⚠️</span>
            <span className="ac-compliance__text">
              客户隐私受法律保护，所有诊断数据将加密存储，仅用于服务匹配。未经客户授权不会向第三方透露。
            </span>
            <span className="ac-compliance__dismiss" onClick={() => setComplianceDismissed(true)}>
              我知道了
            </span>
          </div>
        )}

        {/* 诊断问卷 */}
        <div className="ac-question-card">
          <div className="ac-question-card__progress">
            诊断进度：{done} / {total} 题（{Math.round((done / total) * 100)}%）
          </div>
          <div className="ac-question-num">Q{current.id}</div>
          <div className="ac-question-text">{current.text}</div>
          <div className="ac-question-options">
            {current.options.map((opt, i) => (
              <div
                key={i}
                className={`ac-option ${answers[current.id] === i ? 'ac-option--selected' : ''}`}
                onClick={() => setAnswers({ ...answers, [current.id]: i })}
              >
                <span className="ac-option__radio" />
                {opt}
              </div>
            ))}
          </div>
          <div className="ac-question-nav">
            <button className="ac-nav-btn" disabled={qIndex === 0} onClick={() => setQIndex(qIndex - 1)}>
              ← 上一题
            </button>
            {isLast ? (
              <button className="ac-nav-btn ac-nav-btn--primary" onClick={() => setShowInsight(true)}>
                完成诊断 →
              </button>
            ) : (
              <button className="ac-nav-btn ac-nav-btn--primary" onClick={() => setQIndex(qIndex + 1)}>
                下一题 →
              </button>
            )}
          </div>
        </div>

        {/* 智能洞察面板 */}
        {showInsight && (
          <div className="ac-insight-panel">
            <div className="ac-insight-panel__title">🤖 AI 智能洞察</div>

            {/* 匹配度 */}
            <div className="ac-match-row">
              <span className="ac-match-score">85%</span>
              <span className="ac-match-label">服务匹配度</span>
              <div className="ac-match-bar">
                <div className="ac-match-bar__fill" style={{ width: '85%' }} />
              </div>
            </div>

            {/* 推荐方案 */}
            <div style={{ fontSize: 'var(--font-size-l5)', fontWeight: 'var(--font-weight-bold)', color: '#333', marginBottom: 10 }}>
              📌 推荐方案
            </div>
            <div className="ac-priority-list">
              <div className="ac-priority-item">
                <span className="ac-priority-item__rank">P0</span> 组织架构诊断
              </div>
              <div className="ac-priority-item">
                <span className="ac-priority-item__rank">P1</span> 薪酬体系咨询
              </div>
              <div className="ac-priority-item">
                <span className="ac-priority-item__rank">P1</span> 人才盘点
              </div>
            </div>

            {/* 下一步建议 */}
            <div className="ac-next-card">
              <div className="ac-next-card__title">💡 下一步建议</div>
              <div className="ac-next-card__desc">
                建议在首次面谈中重点了解客户的业务痛点，使用提词器引导对话节奏。
              </div>
              <button className="ac-bottom-nav__forward" onClick={() => navigate('/m/acquire-client/meeting')}>
                进入面谈 →
              </button>
            </div>
          </div>
        )}

        {/* 底部导航 */}
        <div className="ac-bottom-nav">
          <span className="ac-bottom-nav__back" onClick={() => navigate('/m/acquire-client')}>← 返回概览</span>
          {showInsight && (
            <button className="ac-bottom-nav__forward" onClick={() => navigate('/m/acquire-client/meeting')}>
              完成诊断，进入面谈 →
            </button>
          )}
        </div>
      </div>
    </PageContainer>
  )
}
