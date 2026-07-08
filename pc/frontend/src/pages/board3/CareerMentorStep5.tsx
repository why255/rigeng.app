import { useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import '../pages.css'
import './career-mentor.css'

/** M7-P5 STEP 5·五选 — 完成庆祝 + Offer决策(灰置) + 试用期计划(灰置) */
export function CareerMentorStep5() {
  const navigate = useNavigate()

  return (
    <PageContainer width="dashboard">
      <div data-module="career-mentor">
        <div style={{ marginBottom: 32 }}>
          <p className="cm-slogan">日耕朝夕，耕愈工作，耕暖生活</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
            <h3 className="cm-brand-sub">高维五步法，前程自发光</h3>
            <span className="cm-step-badge">STEP 5/5 · 五选</span>
          </div>
        </div>

        {/* 完成庆祝区 */}
        <div className="cm-celebrate">
          <div className="cm-celebrate__icon">🎯</div>
          <h4 className="cm-celebrate__title">恭喜完成五步法！</h4>
          <p className="cm-celebrate__desc">
            您已成功从简历盘点、策略制定到面试复盘完成了完整的求职链路。<br />
            高维视角的开启，是职业生涯进阶的开始。
          </p>
          <div className="cm-celebrate__actions">
            <button className="cm-celebrate-btn cm-celebrate-btn--primary" onClick={() => navigate('/m/career-mentor')}>
              返回首页
            </button>
            <button className="cm-celebrate-btn cm-celebrate-btn--secondary">查看求职报告</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 40 }}>
          {/* Offer决策矩阵 (灰置) */}
          <div className="cm-disabled-block">
            <div className="cm-disabled-block__badge">即将上线</div>
            <h4 className="cm-section-title">
              <span style={{ color: 'var(--module-color-primary)' }}>⚖️</span> Offer 决策矩阵
            </h4>
            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ height: 40, background: 'var(--color-neutral-25)', borderRadius: 8 }} />
              <div style={{ height: 40, background: 'var(--color-neutral-25)', borderRadius: 8 }} />
              <div style={{ height: 40, background: 'var(--color-neutral-25)', borderRadius: 8 }} />
            </div>
          </div>

          {/* 试用期90天计划 (灰置) */}
          <div className="cm-disabled-block">
            <div className="cm-disabled-block__badge">即将上线</div>
            <h4 className="cm-section-title">
              <span style={{ color: '#607D8B' }}>🚩</span> 试用期90天里程碑
            </h4>
            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--color-neutral-200)' }} />
                  <div style={{ height: 16, flex: 1, background: 'var(--color-neutral-25)', borderRadius: 4 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
