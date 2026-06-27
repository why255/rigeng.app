import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { useToast } from '@rigeng/shared/components/primitives/toast'
import '../pages.css'
import './product-design.css'

/** M10-P1 打磨一套产品入口 — 概览数据 + 双路径入口 + 项目列表 */
export function ProductDesignEntry() {
  const navigate = useNavigate()
  const toast = useToast()
  const [hasProjects] = useState(true) // 从 API 获取，暂时固定

  return (
    <PageContainer width="dashboard">
      <div data-module="product-design">
        {/* 品牌标语 */}
        <p className="pd-slogan">日耕朝夕，耕愈工作，耕暖生活</p>
        <h1 className="pd-brand-title">经验沉下来，产品自然成</h1>

        {/* 概览数据 */}
        <div className="pd-stat-grid">
          <div className="pd-stat-card">
            <span className="pd-stat-card__label">进行中项目</span>
            <span className="pd-stat-card__number">2</span>
          </div>
          <div className="pd-stat-card">
            <span className="pd-stat-card__label">已完成项目</span>
            <span className="pd-stat-card__number">1</span>
          </div>
          <div className="pd-stat-card">
            <span className="pd-stat-card__label">预研产品</span>
            <span className="pd-stat-card__number">0</span>
          </div>
        </div>

        {/* 双路径入口 */}
        <div className="pd-path-grid">
          {/* 完整 ABS 流程 */}
          <div className="pd-path-card" onClick={() => navigate('/m/product-design/diagnosis')}>
            <div className="pd-path-card__header">
              <div className="pd-path-card__icon">🔧</div>
              <div>
                <div className="pd-path-card__title">完整 ABS 流程</div>
                <div className="pd-path-card__abs-steps">
                  <span>A 现状诊断</span>
                  <span>→</span>
                  <span>B 目标设定</span>
                  <span>→</span>
                  <span>S 解决方案</span>
                </div>
              </div>
            </div>
            <p className="pd-path-card__desc">
              从签约合同出发，使用 ABS 模型系统化诊断客户现状，输出 A/B 双版方案。内置视频辅导，老师带着做不是替做。
            </p>
            <button
              className="pd-btn-primary"
              onClick={(e) => { e.stopPropagation(); navigate('/m/product-design/diagnosis') }}
            >
              进入完整 ABS →
            </button>
          </div>

          {/* 产品预研（灰置） */}
          <div className="pd-path-card pd-path-card--disabled">
            <div className="pd-path-card__badge">即将上线</div>
            <div className="pd-path-card__header">
              <div className="pd-path-card__icon">🧪</div>
              <div className="pd-path-card__title">产品预研</div>
            </div>
            <p className="pd-path-card__desc">
              未签约用户预打磨通用产品，存入私有库，签约后快速适配。
            </p>
            <button
              className="pd-btn-disabled"
              onClick={(e) => { e.stopPropagation(); toast('功能开发中，敬请期待') }}
            >
              进入预研
            </button>
          </div>
        </div>

        {/* 进行中项目列表 */}
        {hasProjects ? (
          <div className="pd-project-list">
            <div className="pd-project-list__header">
              <h2 className="pd-project-list__title">进行中项目</h2>
            </div>

            {/* 项目1 — 方案定稿阶段 */}
            <div className="pd-project-card" onClick={() => navigate('/m/product-design/finalize')}>
              <div className="pd-project-card__header">
                <div className="pd-project-card__icon">🏢</div>
                <div className="pd-project-card__info">
                  <div className="pd-project-card__name-row">
                    <span className="pd-project-card__name">某科技公司</span>
                    <span className="pd-project-card__date">2026-06-21</span>
                  </div>
                  <p className="pd-project-card__desc">项目：薪酬体系优化方案</p>
                </div>
              </div>
              <div className="pd-project-card__progress">
                <div className="pd-project-card__bar-row">
                  <div className="pd-project-card__bar">
                    <div className="pd-project-card__bar-fill" style={{ width: '80%' }} />
                  </div>
                  <span className="pd-project-card__pct">80%</span>
                </div>
                <div className="pd-project-card__steps">
                  <div className="pd-project-card__step">
                    <div className="pd-project-card__step-dot pd-project-card__step-dot--done" />
                    <span>A 诊断</span>
                  </div>
                  <span>→</span>
                  <div className="pd-project-card__step">
                    <div className="pd-project-card__step-dot pd-project-card__step-dot--done" />
                    <span>B 目标</span>
                  </div>
                  <span>→</span>
                  <div className="pd-project-card__step">
                    <div className="pd-project-card__step-dot pd-project-card__step-dot--done" />
                    <span>S 方案</span>
                  </div>
                  <span>→</span>
                  <div className="pd-project-card__step pd-project-card__step--active">
                    <div className="pd-project-card__step-dot pd-project-card__step-dot--current" />
                    <span>定稿</span>
                  </div>
                </div>
              </div>
              <div className="pd-project-card__footer">
                <span className="pd-project-card__status">当前：方案定稿</span>
                <button
                  className="pd-btn-primary"
                  onClick={(e) => { e.stopPropagation(); navigate('/m/product-design/finalize') }}
                >
                  继续
                </button>
              </div>
            </div>

            {/* 项目2 — B目标阶段 */}
            <div className="pd-project-card" onClick={() => navigate('/m/product-design/diagnosis')}>
              <div className="pd-project-card__header">
                <div className="pd-project-card__icon">🏢</div>
                <div className="pd-project-card__info">
                  <div className="pd-project-card__name-row">
                    <span className="pd-project-card__name">某电商企业</span>
                    <span className="pd-project-card__date">2026-06-18</span>
                  </div>
                  <p className="pd-project-card__desc">项目：绩效管理体系搭建</p>
                </div>
              </div>
              <div className="pd-project-card__progress">
                <div className="pd-project-card__bar-row">
                  <div className="pd-project-card__bar">
                    <div className="pd-project-card__bar-fill" style={{ width: '40%' }} />
                  </div>
                  <span className="pd-project-card__pct">40%</span>
                </div>
                <div className="pd-project-card__steps">
                  <div className="pd-project-card__step">
                    <div className="pd-project-card__step-dot pd-project-card__step-dot--done" />
                    <span>A 诊断</span>
                  </div>
                  <span>→</span>
                  <div className="pd-project-card__step pd-project-card__step--active">
                    <div className="pd-project-card__step-dot pd-project-card__step-dot--current" />
                    <span>B 目标</span>
                  </div>
                  <span>→</span>
                  <div className="pd-project-card__step">
                    <div className="pd-project-card__step-dot pd-project-card__step-dot--pending" />
                    <span>S 方案</span>
                  </div>
                  <span>→</span>
                  <div className="pd-project-card__step">
                    <div className="pd-project-card__step-dot pd-project-card__step-dot--pending" />
                    <span>定稿</span>
                  </div>
                </div>
              </div>
              <div className="pd-project-card__footer">
                <span className="pd-project-card__status">当前：A 诊断</span>
                <button
                  className="pd-btn-primary"
                  onClick={(e) => { e.stopPropagation(); navigate('/m/product-design/diagnosis') }}
                >
                  继续
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* 空态 */
          <div className="pd-empty-state">
            <div className="pd-empty-state__icon">🔧</div>
            <h3 className="pd-empty-state__title">还没有打磨项目</h3>
            <p className="pd-empty-state__desc">
              从拿下一个客户签约后，合同会自动同步到这里开始 ABS 诊断。
            </p>
            <button className="pd-btn-primary" onClick={() => navigate('/m/acquire-client')}>
              去拿下一个客户 →
            </button>
          </div>
        )}
      </div>
    </PageContainer>
  )
}
