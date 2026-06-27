import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { companyIntel } from '@/data/mock'
import { useToast } from '@/components/primitives/toast'
import { prepareInterview, type InterviewPrep } from '@/api/career'
import '../pages.css'
import './career-mentor.css'

/** M7-P4 STEP 4·四面 — 企业情报 + 匹配度分析 + 面试复盘 */
export function CareerMentorStep4() {
  const navigate = useNavigate()
  const toast = useToast()
  const [, setInterviewPrep] = useState<InterviewPrep | null>(null)

  useEffect(() => {
    prepareInterview({}).then(d => { if (d) setInterviewPrep(d) }).catch(() => {})
  }, [])

  const circumference = 2 * Math.PI * 58

  return (
    <PageContainer width="dashboard">
      <div data-module="career-mentor">
        <div style={{ marginBottom: 32 }}>
          <p className="cm-slogan">日耕朝夕，耕愈工作，耕暖生活</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
            <h3 className="cm-brand-sub">高维五步法，前程自发光</h3>
            <span className="cm-step-badge">STEP 4/5 · 四面</span>
          </div>
        </div>

        <div className="cm-intel-layout">
          {/* 左侧：企业情报 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="cm-intel-card">
              <div className="cm-intel-header">
                <div className="cm-intel-company">
                  <div className="cm-intel-company__icon">🏢</div>
                  <div>
                    <h4 className="cm-intel-company__name">{companyIntel.name}</h4>
                    <p className="cm-intel-company__role">{companyIntel.position}</p>
                  </div>
                </div>
                <span className="cm-intel-privacy">🔒 隐私分级：P1</span>
              </div>
              <div className="cm-intel-meta">
                <div className="cm-intel-meta__item">
                  <span className="cm-intel-meta__label">信息来源</span>
                  <p className="cm-intel-meta__value">{companyIntel.source}</p>
                </div>
                <div className="cm-intel-meta__item">
                  <span className="cm-intel-meta__label">核心业务</span>
                  <p className="cm-intel-meta__value">{companyIntel.business}</p>
                </div>
                <div className="cm-intel-meta__item">
                  <span className="cm-intel-meta__label">团队规模</span>
                  <p className="cm-intel-meta__value">{companyIntel.scale}</p>
                </div>
              </div>
              <div className="cm-intel-summary">
                <p className="cm-intel-summary__label">情报摘要：</p>
                {companyIntel.summary}
              </div>
            </div>

            {/* 面试策略+问题清单 */}
            <div className="cm-intel-card">
              <h4 className="cm-section-title">
                <span style={{ color: 'var(--module-color-primary)' }}>📋</span> 面试策略与高频问题
              </h4>
              {companyIntel.strategies.map((st, i) => (
                <div key={i} className={`cm-strategy-card ${i === 0 ? 'cm-strategy-card--brand' : 'cm-strategy-card--military'}`} style={{ marginTop: 16 }}>
                  <p className="cm-strategy-card__title" style={{ color: st.color }}>{st.title}</p>
                  <p className="cm-strategy-card__desc">{st.desc}</p>
                </div>
              ))}
              <div style={{ marginTop: 24 }}>
                <h5 style={{ fontSize: 14, fontWeight: 700, color: '#333', marginBottom: 12 }}>预计高频问题：</h5>
                {companyIntel.questions.map((q, i) => (
                  <div key={i} className="cm-question-item">
                    <span className="cm-question-item__icon">💬</span>
                    <span>{q}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 右侧：匹配度分析 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="cm-intel-card">
              <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-neutral-500)', marginBottom: 24, textTransform: 'uppercase', letterSpacing: 1 }}>岗位匹配度</h4>
              <div className="cm-match-ring">
                <div className="cm-match-ring__circle">
                  <svg className="cm-match-ring__svg">
                    <circle className="cm-match-ring__bg" cx="64" cy="64" r="58" />
                    <circle
                      className="cm-match-ring__fill"
                      cx="64" cy="64" r="58"
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference * (1 - companyIntel.matchRate / 100)}
                    />
                  </svg>
                  <span className="cm-match-ring__value">{companyIntel.matchRate}%</span>
                </div>
                <p className="cm-match-ring__hint">匹配度高于 90% 的候选人</p>
              </div>
              {companyIntel.matchDetails.map((d) => (
                <div key={d.label} className="cm-match-bar">
                  <div className="cm-match-bar__header">
                    <span className="cm-match-bar__label">{d.label}</span>
                    <span className="cm-match-bar__value" style={{ color: d.color }}>{d.value}%</span>
                  </div>
                  <div className="cm-match-bar__track">
                    <div className="cm-match-bar__fill" style={{ width: `${d.value}%`, backgroundColor: d.color }} />
                  </div>
                </div>
              ))}
            </div>

            {/* 面试记录入口 */}
            <div className="cm-intel-card">
              <h4 style={{ fontSize: 14, fontWeight: 700, color: '#333', marginBottom: 16 }}>面试现场记录</h4>
              <button className="cm-record-placeholder">
                <span>🎤</span>
                <span className="cm-record-placeholder__text">请在移动端使用录音功能</span>
              </button>
              <p style={{ fontSize: 10, color: 'var(--color-neutral-500)', marginTop: 12, textAlign: 'center' }}>录音将自动同步至本页进行 AI 复盘</p>
            </div>
          </div>
        </div>

        {/* 面试复盘区 */}
        <div className="cm-intel-card" style={{ marginTop: 32, marginBottom: 40 }}>
          <h4 className="cm-section-title">
            <span style={{ color: '#607D8B' }}>📝</span> 面试复盘 (AI 生成)
          </h4>
          <div className="cm-review-grid" style={{ marginTop: 24 }}>
            <div>
              <span className="cm-review-item__label">面试时间</span>
              <p className="cm-review-item__value">{companyIntel.reviewTime}</p>
            </div>
            <div>
              <span className="cm-review-item__label">录音时长</span>
              <p className="cm-review-item__value">{companyIntel.reviewDuration}</p>
            </div>
            <div>
              <span className="cm-review-item__label">关联录音</span>
              <p className="cm-review-item__value" style={{ color: 'var(--module-color-primary)', textDecoration: 'underline', cursor: 'pointer' }}>{companyIntel.reviewAudio}</p>
            </div>
            <div>
              <span className="cm-review-item__label">复盘SOP</span>
              <p className="cm-review-item__value">{companyIntel.reviewSOP}</p>
            </div>
          </div>
          <div className="cm-review-actions">
            <button className="cm-review-btn cm-review-btn--outline">查看复盘SOP</button>
            <button className="cm-review-btn cm-review-btn--primary" onClick={() => toast('已归档至知识库', 'success')}>归档至知识库</button>
          </div>
        </div>

        {/* 下一步按钮 */}
        <div className="cm-step-nav">
          <button className="cm-step-nav-btn cm-step-nav-btn--military" onClick={() => navigate('/m/career-mentor/select')}>
            进入下一步：五选 →
          </button>
        </div>
      </div>
    </PageContainer>
  )
}
