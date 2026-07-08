import { useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { extractionData } from '@/shared/data/mock'
import { useToast } from '@/shared/components/primitives/toast'
import '../pages.css'
import './smart-record.css'

/** M4-P4 萃取结果页（PC） — 候选人画像 + 胜任力评估 + 归档 */
export function SmartRecordExtract() {
  const navigate = useNavigate()
  const toast = useToast()
  const d = extractionData

  const handleArchive = () => {
    toast('已归档到知识库', 'success')
    setTimeout(() => navigate('/m/smart-record'), 1500)
  }

  return (
    <PageContainer width="dashboard">
      <div data-module="smart-record">
        {/* 品牌标语（简写） */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-neutral-900)' }}>日耕朝夕，耕愈工作，耕暖生活</p>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-neutral-900)', marginTop: 4 }}>智能记录</p>
        </div>

        {/* 萃取报告卡片 */}
        <div className="sr-extract-card">
          {/* 候选人画像 */}
          <div className="sr-extract-profile">
            <div className="sr-extract-avatar" style={{ backgroundColor: d.avatarBg }}>
              👤
            </div>
            <div>
              <h2 className="sr-extract-name">{d.name}</h2>
              <p className="sr-extract-role">{d.role}</p>
            </div>
          </div>

          <div className="sr-extract-grid">
            <div>
              <div className="sr-extract-field">
                <p className="sr-extract-field__label">工作年限</p>
                <p className="sr-extract-field__value">{d.years}</p>
              </div>
              <div className="sr-extract-field">
                <p className="sr-extract-field__label">毕业院校</p>
                <p className="sr-extract-field__value">{d.school}</p>
              </div>
              <div className="sr-extract-field">
                <p className="sr-extract-field__label">核心技能</p>
                <div className="sr-extract-skills">
                  {d.skills.map((s) => (
                    <span key={s} className="sr-extract-skill-tag">{s}</span>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <div className="sr-extract-field">
                <p className="sr-extract-field__label">薪酬期望</p>
                <p className="sr-extract-field__value">{d.salary}</p>
              </div>
              <div className="sr-extract-field">
                <p className="sr-extract-field__label">最快入职时间</p>
                <p className="sr-extract-field__value">{d.onboard}</p>
              </div>
            </div>
          </div>

          {/* 胜任力评估 */}
          <div className="sr-extract-competencies">
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-neutral-900)', marginBottom: 12 }}>胜任力评估</h3>
            <div className="sr-extract-grid">
              {d.competencies.map((c) => (
                <div key={c.label} className="sr-competency-row">
                  <span className="sr-competency-label">{c.label}</span>
                  <div className="sr-stars">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span key={star} className={star <= c.stars ? 'sr-star--filled' : 'sr-star--empty'}>
                        ★
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="sr-actions">
          <button className="sr-btn-primary" onClick={handleArchive}>
            📚 归档到知识库
          </button>
          <button className="sr-btn-secondary" onClick={() => navigate('/m/smart-record/transcript?id=demo')}>
            重新萃取
          </button>
        </div>
      </div>
    </PageContainer>
  )
}
