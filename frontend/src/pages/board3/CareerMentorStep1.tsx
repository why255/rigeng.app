import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { starExperiences, skillCrystals } from '@/data/mock'
import { useToast } from '@/components/primitives/toast'
import { getSkillCrystals, type SkillCrystal } from '@/api/career'
import '../pages.css'
import './career-mentor.css'

/** M7-P2 STEP 1·一盘 — 简历上传 + STAR盘点 + 技能晶体萃取 */
export function CareerMentorStep1() {
  const navigate = useNavigate()
  const toast = useToast()
  const [, setCrystals] = useState<SkillCrystal[]>([])

  useEffect(() => {
    getSkillCrystals().then(d => {
      if (d && d.crystals) setCrystals(d.crystals)
    }).catch(() => {})
  }, [])

  return (
    <PageContainer width="dashboard">
      <div data-module="career-mentor">
        {/* 品牌标语 */}
        <div style={{ marginBottom: 32 }}>
          <p className="cm-slogan">日耕朝夕，耕愈工作，耕暖生活</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
            <h3 className="cm-brand-sub">高维五步法，前程自发光</h3>
            <span className="cm-step-badge">STEP 1/5 · 一盘</span>
          </div>
        </div>

        {/* 简历上传区 */}
        <div className="cm-upload-zone">
          <div className="cm-upload-drop">
            <div className="cm-upload-drop__icon">📤</div>
            <h4 className="cm-upload-drop__title">拖拽简历到此处，或点击上传</h4>
            <p className="cm-upload-drop__hint">支持格式：PDF / Word / JPG (≤10MB)</p>
            <div className="cm-upload-success">
              <span>✅</span>
              <span>已上传：张三_产品经理_简历.pdf</span>
            </div>
          </div>
        </div>

        {/* 加载动画 */}
        <div className="cm-loading-bar">
          <div className="cm-loading-bar__spinner">耕</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="cm-loading-dots">
              <span className="cm-loading-dot" />
              <span className="cm-loading-dot" />
              <span className="cm-loading-dot" />
            </div>
            <span style={{ fontSize: 14, color: '#666', marginLeft: 8 }}>小耕正在深度解析您的简历资产，请稍候...</span>
          </div>
        </div>

        {/* STAR盘点清单 */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h4 className="cm-section-title">
              <span style={{ color: '#607D8B' }}>📋</span> STAR经历盘点
            </h4>
            <button style={{ fontSize: 14, color: 'var(--module-color-primary)', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer' }}>批量导出</button>
          </div>

          {starExperiences.map((exp, i) => (
            <div key={i} className="cm-star-card">
              <div className="cm-star-card__header">
                <div>
                  <h5 className="cm-star-card__company">{exp.company} · {exp.role}</h5>
                  <p className="cm-star-card__period">{exp.period}</p>
                </div>
                <span className={exp.status === 'pending' ? 'cm-star-tag-pending' : 'cm-star-tag-done'}>
                  {exp.status === 'pending' ? '待补充 Result' : '已完成'}
                </span>
              </div>
              <div className="cm-star-grid">
                <div className="cm-star-cell">
                  <span className="cm-star-cell__label">Situation</span>
                  <p className="cm-star-cell__text">{exp.situation}</p>
                </div>
                <div className="cm-star-cell">
                  <span className="cm-star-cell__label">Task</span>
                  <p className="cm-star-cell__text">{exp.task}</p>
                </div>
                <div className="cm-star-cell">
                  <span className="cm-star-cell__label">Action</span>
                  <p className="cm-star-cell__text">{exp.action}</p>
                </div>
                {exp.result ? (
                  <div className="cm-star-cell">
                    <span className="cm-star-cell__label">Result</span>
                    <p className="cm-star-cell__text">{exp.result}</p>
                  </div>
                ) : (
                  <div className="cm-star-cell--add">+ 补充结果数据</div>
                )}
              </div>
              {exp.status === 'done' && (
                <div className="cm-star-actions">
                  <button className="cm-star-action-btn">查看详情</button>
                  <button className="cm-star-action-btn">生成话术</button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 技能晶体萃取 */}
        <div style={{ background: 'var(--color-brand-white)', borderRadius: 16, padding: 32, border: '1px solid #E8E0D6', boxShadow: 'var(--shadow-sm)', marginBottom: 40 }}>
          <h4 className="cm-section-title">
            <span style={{ color: 'var(--module-color-primary)' }}>💎</span> 技能晶体萃取
          </h4>
          <div className="cm-crystal-grid" style={{ marginTop: 24 }}>
            {[
              { label: '做什么', value: skillCrystals.what },
              { label: '怎么做', value: skillCrystals.how },
              { label: '注意事项', value: skillCrystals.caution },
              { label: '成果', value: skillCrystals.result },
              { label: 'SOP', value: skillCrystals.sop },
            ].map((col) => (
              <div key={col.label}>
                <label className="cm-crystal-col__label">{col.label}</label>
                <div className="cm-crystal-col__box">{col.value}</div>
              </div>
            ))}
          </div>
          <div className="cm-crystal-actions">
            <button className="cm-crystal-btn cm-crystal-btn--re">重新萃取</button>
            <button className="cm-crystal-btn cm-crystal-btn--confirm" onClick={() => toast('技能晶体已沉淀至知识库', 'success')}>确认入库</button>
          </div>
        </div>

        {/* 下一步按钮 */}
        <div className="cm-step-nav">
          <button className="cm-step-nav-btn cm-step-nav-btn--military" onClick={() => navigate('/m/career-mentor/double')}>
            进入下一步：二定三投 →
          </button>
        </div>
      </div>
    </PageContainer>
  )
}
