import { Link, useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { useToast } from '@rigeng/shared/components/primitives/toast'
import '../pages.css'
import './product-design.css'

/** M10-P1 移动端 打磨一套产品入口 */
export function ProductDesignEntry() {
  const navigate = useNavigate()
  const toast = useToast()

  return (
    <PageContainer width="dashboard">
      <div data-module="product-design">
        <p className="pdm-slogan">日耕朝夕，耕愈工作，耕暖生活</p>
        <p className="pdm-brand-title">经验沉下来，产品自然成</p>

        {/* 概览数据卡片 */}
        <div className="pdm-stat-grid">
          <div className="pdm-stat-card">
            <p className="pdm-stat-card__number pdm-stat-card__number--brand">2</p>
            <p className="pdm-stat-card__label">进行中</p>
          </div>
          <div className="pdm-stat-card">
            <p className="pdm-stat-card__number pdm-stat-card__number--dark">1</p>
            <p className="pdm-stat-card__label">已完成</p>
          </div>
          <div className="pdm-stat-card">
            <p className="pdm-stat-card__number pdm-stat-card__number--muted">0</p>
            <p className="pdm-stat-card__label">预研中</p>
          </div>
        </div>

        {/* 双路径入口 */}
        <div className="pdm-path-section">
          <Link className="pdm-path-card" to="/m/product-design/diagnosis">
            <div className="pdm-path-card__badge">CORE</div>
            <h3 className="pdm-path-card__title">完整 ABS 流程</h3>
            <p className="pdm-path-card__sub">现状诊断 → 目标设定 → 解决方案</p>
            <div className="pdm-path-card__action">立即进入 →</div>
            <span className="pdm-path-card__bg-icon">🎯</span>
          </Link>

          <div className="pdm-path-card pdm-path-card--disabled" onClick={() => toast('功能开发中，敬请期待')}>
            <div className="pdm-path-card__badge">BETA</div>
            <h3 className="pdm-path-card__title">产品预研</h3>
            <p className="pdm-path-card__sub">快速验证市场需求与原型设计</p>
            <div className="pdm-path-card__coming-badge">即将上线</div>
          </div>
        </div>

        {/* 进行中项目列表 */}
        <div className="pdm-section-header">
          <h4 className="pdm-section-header__title">进行中项目</h4>
          <span className="pdm-section-header__link">查看全部</span>
        </div>

        <div className="pdm-project-list">
          <Link className="pdm-project-card" to="/m/product-design/finalize">
            <div className="pdm-project-card__header">
              <h5 className="pdm-project-card__name">某科技公司薪酬体系优化</h5>
              <span className="pdm-project-card__pct">80%</span>
            </div>
            <div className="pdm-project-card__progress-bar">
              <div className="pdm-project-card__seg pdm-project-card__seg--done" />
              <div className="pdm-project-card__seg pdm-project-card__seg--done" />
              <div className="pdm-project-card__seg pdm-project-card__seg--done" />
              <div className="pdm-project-card__seg pdm-project-card__seg--active" />
              <span className="pdm-project-card__status">定稿中</span>
            </div>
            <p className="pdm-project-card__time">更新于 2024-06-22 14:20</p>
          </Link>

          <Link className="pdm-project-card" to="/m/product-design/diagnosis">
            <div className="pdm-project-card__header">
              <h5 className="pdm-project-card__name">某电商企业绩效管理体系</h5>
              <span className="pdm-project-card__pct">40%</span>
            </div>
            <div className="pdm-project-card__progress-bar">
              <div className="pdm-project-card__seg pdm-project-card__seg--done" />
              <div className="pdm-project-card__seg pdm-project-card__seg--active" />
              <div className="pdm-project-card__seg pdm-project-card__seg--active" />
              <div className="pdm-project-card__seg pdm-project-card__seg--active" />
              <span className="pdm-project-card__status">目标设定</span>
            </div>
            <p className="pdm-project-card__time">更新于 昨天 09:15</p>
          </Link>
        </div>

        {/* 空态链接 */}
        <div className="pdm-empty">
          <p className="pdm-empty__text">还没想好做什么产品？</p>
          <a className="pdm-empty__link" onClick={() => navigate('/m/acquire-client')}>
            去拿下一个客户寻求灵感 →
          </a>
        </div>
      </div>
    </PageContainer>
  )
}
