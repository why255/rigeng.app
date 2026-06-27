import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { useToast } from '@rigeng/shared/components/primitives/toast'
import '../pages.css'
import './product-design.css'

/** M10-P3 移动端 B目标+S方案页 */
export function ProductDesignTarget() {
  const navigate = useNavigate()
  const toast = useToast()
  const [selectedOption, setSelectedOption] = useState<'A' | 'B' | null>('A')
  const [isLoading, setIsLoading] = useState(false)

  const handleGenerate = () => {
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      toast('方案已生成')
    }, 2000)
  }

  return (
    <PageContainer width="dashboard">
      <div data-module="product-design">
        {/* 品牌标语 */}
        <p className="pdm-slogan">日耕朝夕，耕愈工作，耕暖生活</p>
        <p className="pdm-brand-sub">经验沉下来，产品自然成</p>

        {/* ABS 阶段进度条 */}
        <div className="pdm-abs-steps">
          <div className="pdm-abs-step">
            <div className="pdm-abs-step__circle pdm-abs-step__circle--done">✓</div>
            <span className="pdm-abs-step__label pdm-abs-step__label--active">A 诊断</span>
          </div>
          <div className="pdm-abs-line pdm-abs-line--done" />
          <div className="pdm-abs-step">
            <div className="pdm-abs-step__circle pdm-abs-step__circle--current">🎯</div>
            <span className="pdm-abs-step__label pdm-abs-step__label--active">B 目标</span>
          </div>
          <div className="pdm-abs-line pdm-abs-line--pending" />
          <div className="pdm-abs-step">
            <div className="pdm-abs-step__circle pdm-abs-step__circle--pending">💡</div>
            <span className="pdm-abs-step__label pdm-abs-step__label--muted">S 方案</span>
          </div>
        </div>

        <span className="pdm-page-badge">ABS · B 目标设定 + S 解决方案</span>

        {/* 量化目标 */}
        <div className="pdm-card">
          <h4 className="pdm-card__title">设定量化目标</h4>
          <div className="pdm-goal-item">
            <div className="pdm-goal-item__info">
              <input className="pdm-goal-item__checkbox" type="checkbox" defaultChecked />
              <span className="pdm-goal-item__text">薪酬结构调整 (P1-P8)</span>
            </div>
            <span>⚙️</span>
          </div>
          <div className="pdm-goal-item">
            <div className="pdm-goal-item__info">
              <input className="pdm-goal-item__checkbox" type="checkbox" />
              <span className="pdm-goal-item__text">绩效与奖金包挂钩</span>
            </div>
            <span>⚙️</span>
          </div>
          <div className="pdm-goal-item">
            <div className="pdm-goal-item__info">
              <input className="pdm-goal-item__checkbox" type="checkbox" />
              <span className="pdm-goal-item__text">核心人才流失率降至 8% 以下</span>
            </div>
            <span>⚙️</span>
          </div>
          <button className="pdm-btn-primary" style={{ marginTop: 16 }} onClick={handleGenerate}>
            确认目标并生成方案
          </button>
        </div>

        {/* 三源标注 */}
        <div className="pdm-sources">
          <div className="pdm-source-tag">
            <span className="pdm-source-tag__dot pdm-source-tag__dot--green" />
            私有库已接入
          </div>
          <div className="pdm-source-tag">
            <span className="pdm-source-tag__dot pdm-source-tag__dot--blue" />
            携君库可用
          </div>
          <div className="pdm-source-tag">
            <span className="pdm-source-tag__dot pdm-source-tag__dot--orange" />
            智能办公模板
          </div>
        </div>

        {/* 智能生成方案 */}
        <div className="pdm-solution-section">
          <h4 className="pdm-card__title" style={{ paddingLeft: 0 }}>智能生成方案</h4>

          {/* A版 — 选中 */}
          <div
            className={`pdm-solution-card ${selectedOption === 'A' ? 'pdm-solution-card--selected' : ''}`}
            onClick={() => setSelectedOption('A')}
          >
            <div className="pdm-solution-card__header">
              <div>
                <span className="pdm-solution-card__badge pdm-solution-card__badge--a">方案 A</span>
                <h5 className="pdm-solution-card__name">保守型：渐进式优化方案</h5>
              </div>
              {selectedOption === 'A' && <span>✅</span>}
            </div>
            <p className="pdm-solution-card__desc">
              侧重于在现有体系基础上进行微调，降低变革阻力，优先解决薪酬公平性问题。
            </p>
            <div className="pdm-solution-card__meta">
              <span>📋 3 个核心章节</span>
              <span>⏱ 预计落地周期：3个月</span>
            </div>
          </div>

          {/* B版 — 锁定 */}
          <div className="pdm-solution-card">
            <div className="pdm-vip-lock">
              <span className="pdm-vip-lock__icon">🔒</span>
              <p className="pdm-vip-lock__text">升级初级 VIP 解锁进取方案</p>
              <button className="pdm-vip-lock__btn" onClick={() => toast('请前往会员中心升级')}>
                立即升级
              </button>
            </div>
            <div>
              <span className="pdm-solution-card__badge pdm-solution-card__badge--b">方案 B</span>
              <h5 className="pdm-solution-card__name">进取型：全面重构方案</h5>
            </div>
            <p className="pdm-solution-card__desc">
              彻底重塑薪酬绩效体系，引入OKR+宽带薪酬，大幅提升组织活力...
            </p>
          </div>
        </div>

        {/* 加载覆盖层 */}
        {isLoading && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              background: 'white', borderRadius: 24, padding: 32, textAlign: 'center',
              maxWidth: 280,
            }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', border: '5px solid #E8E0D6', borderBottomColor: '#C03A39', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
              <p style={{ fontSize: 14, fontWeight: 700, color: '#333' }}>小耕正在为您生成定制方案...</p>
              <p style={{ fontSize: 11, color: '#666', marginTop: 8 }}>
                基于 100+ 行业案例与您的现状诊断实时计算
              </p>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  )
}
