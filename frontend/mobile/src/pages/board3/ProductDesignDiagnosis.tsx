import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { useToast } from '@rigeng/shared/components/primitives/toast'
import '../pages.css'
import './product-design.css'

/** M10-P2 移动端 A诊断页 */
export function ProductDesignDiagnosis() {
  const navigate = useNavigate()
  const toast = useToast()
  const [q1, setQ1] = useState('领先')
  const [q2, setQ2] = useState(true)
  const [q3, setQ3] = useState('')
  const [q4, setQ4] = useState('15')

  return (
    <PageContainer width="dashboard">
      <div data-module="product-design">
        {/* 品牌标语 */}
        <p className="pdm-slogan">日耕朝夕，耕愈工作，耕暖生活</p>
        <p className="pdm-brand-sub">经验沉下来，产品自然成</p>

        {/* ABS 阶段进度条 */}
        <div className="pdm-abs-steps">
          <div className="pdm-abs-step">
            <div className="pdm-abs-step__circle pdm-abs-step__circle--current">✏️</div>
            <span className="pdm-abs-step__label pdm-abs-step__label--active">A 诊断</span>
          </div>
          <div className="pdm-abs-line pdm-abs-line--pending" />
          <div className="pdm-abs-step">
            <div className="pdm-abs-step__circle pdm-abs-step__circle--pending">🎯</div>
            <span className="pdm-abs-step__label pdm-abs-step__label--muted">B 目标</span>
          </div>
          <div className="pdm-abs-line pdm-abs-line--pending" />
          <div className="pdm-abs-step">
            <div className="pdm-abs-step__circle pdm-abs-step__circle--pending">💡</div>
            <span className="pdm-abs-step__label pdm-abs-step__label--muted">S 方案</span>
          </div>
        </div>

        <span className="pdm-page-badge">ABS · A 现状诊断</span>

        {/* 诊断问卷 */}
        <div className="pdm-card">
          <h4 className="pdm-card__title">
            <span className="pdm-card__title-bar" />
            企业现状调研
          </h4>

          <div className="pdm-question">
            <p className="pdm-question__text">1. 您企业的当前薪酬水平在行业中处于？</p>
            <div className="pdm-question__options">
              {['领先', '持平', '低于'].map((opt) => (
                <button
                  key={opt}
                  className={`pdm-option-btn ${q1 === opt ? 'pdm-option-btn--selected' : ''}`}
                  onClick={() => setQ1(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="pdm-question">
            <p className="pdm-question__text">2. 是否有明确的职级体系？</p>
            <div className="pdm-radio-group">
              <label className="pdm-radio-label">
                <input className="pdm-radio" type="radio" checked={q2} onChange={() => setQ2(true)} />
                是
              </label>
              <label className="pdm-radio-label">
                <input className="pdm-radio" type="radio" checked={!q2} onChange={() => setQ2(false)} />
                否
              </label>
            </div>
          </div>

          <div className="pdm-question">
            <p className="pdm-question__text">3. 您认为当前绩效管理最大的痛点是？</p>
            <textarea
              className="pdm-textarea"
              placeholder="例如：考核流于形式、指标无法量化..."
              rows={3}
              value={q3}
              onChange={(e) => setQ3(e.target.value)}
            />
          </div>

          <div className="pdm-question">
            <p className="pdm-question__text">4. 年度核心人才离职率约为？</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                className="pdm-number-input"
                type="number"
                value={q4}
                onChange={(e) => setQ4(e.target.value)}
              />
              <span style={{ fontSize: 12, color: '#666' }}>%</span>
            </div>
          </div>

          <button className="pdm-btn-primary" onClick={() => toast('问卷已保存')}>
            保存问卷
          </button>
        </div>

        {/* 文档上传 */}
        <div className="pdm-card">
          <h4 className="pdm-card__title">参考文档上传</h4>
          <div className="pdm-upload-zone" onClick={() => toast('文件上传已触发')}>
            <span className="pdm-upload-zone__icon">📤</span>
            <p className="pdm-upload-zone__text">点击或拖拽上传现有方案/数据</p>
          </div>
          <div className="pdm-file-item">
            <div className="pdm-file-item__info">
              <span>📄</span>
              <span className="pdm-file-item__name">2023薪酬表.xlsx</span>
            </div>
            <span onClick={() => toast('文档已删除')}>✕</span>
          </div>
          <div className="pdm-file-item">
            <div className="pdm-file-item__info">
              <span>📕</span>
              <span className="pdm-file-item__name">绩效管理制度V2.pdf</span>
            </div>
            <span onClick={() => toast('文档已删除')}>✕</span>
          </div>
        </div>

        {/* 诊断报告 */}
        <div className="pdm-card">
          <div className="pdm-report-header">
            <h4 className="pdm-card__title" style={{ marginBottom: 0 }}>诊断报告 V1.0</h4>
            <span style={{ fontSize: 10, color: '#666' }}>刚刚更新</span>
          </div>
          <div className="pdm-report-item">
            <span>✅</span>
            <p>薪酬水平具备竞争力，但内部分配不均。</p>
          </div>
          <div className="pdm-report-item">
            <span>⚠️</span>
            <p>绩效指标与战略目标脱节，导致执行力偏差。</p>
          </div>
          <div className="pdm-report-item">
            <span>⚠️</span>
            <p>核心人才流职率高于行业均值 (12%)，存在流失风险。</p>
          </div>
        </div>

        {/* 下一步CTA */}
        <div className="pdm-cta-banner" onClick={() => navigate('/m/product-design/target')}>
          <div>
            <p className="pdm-cta-banner__text">诊断已就绪</p>
            <p className="pdm-cta-banner__sub">进入 B 目标设定阶段</p>
          </div>
          <span>→</span>
        </div>
      </div>
    </PageContainer>
  )
}
