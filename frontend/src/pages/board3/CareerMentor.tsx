import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { careerSteps as stepsData } from '@/data/mock'
import { getProgress, type CareerProgress } from '@/api/career'
import '../pages.css'
import './career-mentor.css'

/** M7-P1 高维求职入口 — 五步法流程概览 + 0/5进度 + 开始求职 */
export function CareerMentor() {
  const navigate = useNavigate()
  const [progress, setProgress] = useState<CareerProgress | null>(null)

  useEffect(() => {
    getProgress().then(d => { if (d) setProgress(d) }).catch(() => {})
  }, [])

  return (
    <PageContainer width="dashboard">
      <div data-module="career-mentor">
        {/* 品牌标语 */}
        <div style={{ marginBottom: 48 }}>
          <p className="cm-slogan">日耕朝夕，耕愈工作，耕暖生活</p>
          <h3 className="cm-brand-title">高维五步法，前程自发光</h3>
        </div>

        {/* 五步法流程概览 */}
        <div className="cm-steps-bar">
          <div className="cm-steps-row">
            <div className="cm-steps-line" />
            {stepsData.map((s) => (
              <div key={s.key} className="cm-step-node">
                <div className={`cm-step-circle ${s.status === 'current' ? 'cm-step-circle--active' : 'cm-step-circle--todo'}`}>
                  {String(s.num).padStart(2, '0')}
                </div>
                <span className={`cm-step-label ${s.status === 'current' ? 'cm-step-label--active' : 'cm-step-label--todo'}`}>
                  {s.title}
                </span>
              </div>
            ))}
          </div>
          <div className="cm-progress-section">
            <div className="cm-progress-row">
              <span style={{ color: '#666' }}>总体求职进度</span>
              <span style={{ fontWeight: 700, color: 'var(--module-color-primary)' }}>已完成 {progress ? `${progress.completed_steps}/${progress.total_steps}` : '0/5'} 步</span>
            </div>
            <div className="cm-progress-bar">
              <div className="cm-progress-fill" style={{ width: progress ? `${(progress.completed_steps / progress.total_steps) * 100}%` : '0%' }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 48 }}>
            <button className="cm-start-btn" onClick={() => navigate('/m/career-mentor/steps')}>
              开始求职 →
            </button>
          </div>
        </div>

        {/* 模块说明 */}
        <div className="cm-info-cards">
          <div className="cm-info-card">
            <div className="cm-info-card__icon" style={{ background: 'rgba(96,125,139,0.1)', color: '#607D8B' }}>🎯</div>
            <h4 className="cm-info-card__title">高维视角</h4>
            <p className="cm-info-card__desc">跳出传统海投模式，从能力资产盘点到企业情报深度挖掘，建立降维打击的求职优势。</p>
          </div>
          <div className="cm-info-card">
            <div className="cm-info-card__icon" style={{ background: 'rgba(192,58,57,0.1)', color: '#C03A39' }}>⚡</div>
            <h4 className="cm-info-card__title">资产沉淀</h4>
            <p className="cm-info-card__desc">求职不仅是换工作，更是通过 STAR 盘点与技能萃取，将职场经历转化为可复用的核心资产。</p>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
