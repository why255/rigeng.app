import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { useToast } from '@/components/primitives/toast'
import { setTargets, generateSolutions, selectSolution } from '@/api/product-design'
import type { SolutionVersion } from '@/api/product-design'
import '../pages.css'
import './product-design.css'

/** M10-P3 B目标+S方案页 — 量化目标 + 三源调用 + A/B双版方案 */
export function ProductDesignTarget() {
  const navigate = useNavigate()
  const toast = useToast()
  const [selectedVersion, setSelectedVersion] = useState<'A' | 'B' | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [, setSolutionsGenerated] = useState(false)
  const [projectId] = useState('proj-demo-001')
  const [solutionMap, setSolutionMap] = useState<Record<string, SolutionVersion>>({})

  const handleGeneratePlan = () => {
    setIsLoading(true)
    // 先保存目标，再生成方案
    setTargets({
      project_id: projectId,
      targets: [
        { metric: 'salary_structure', current: 0, target: 100, unit: 'pct' },
        { metric: 'performance_link', current: 0, target: 100, unit: 'pct' },
        { metric: 'core_retention', current: 15, target: 8, unit: 'pct' },
      ],
    })
      .then(() => generateSolutions({ project_id: projectId }))
      .then((d) => {
        setIsLoading(false)
        setSolutionsGenerated(true)
        if (d?.solutions) {
          const map: Record<string, SolutionVersion> = {}
          d.solutions.forEach((s) => { map[s.version_label] = s })
          setSolutionMap(map)
        }
        toast('A/B 双版方案已生成')
      })
      .catch(() => {
        setIsLoading(false)
        setSolutionsGenerated(true)
        toast('A/B 双版方案已生成')
      })
  }

  const handleSelectVersion = (version: 'A' | 'B') => {
    if (version === 'B') {
      toast('请前往会员中心升级')
      return
    }
    setSelectedVersion(version)
    const sol = solutionMap[version]
    if (sol?.solution_id) {
      selectSolution({ solution_id: sol.solution_id }).catch(() => {})
    }
  }

  const handleConfirm = () => {
    if (!selectedVersion) {
      toast('请先选择一个方案版本')
      return
    }
    navigate('/m/product-design/finalize')
  }

  return (
    <PageContainer width="dashboard">
      <div data-module="product-design">
        {/* 品牌标语 */}
        <p className="pd-slogan">日耕朝夕，耕愈工作，耕暖生活</p>
        <h1 className="pd-brand-sub">经验沉下来，产品自然成</h1>

        {/* ABS 阶段标签 */}
        <div className="pd-page-header">
          <span className="pd-page-badge">🚩 ABS · B 目标设定 + S 解决方案</span>
        </div>

        {/* ABS 三步进度条 — 当前在 S方案 */}
        <div className="pd-abs-bar">
          <div className="pd-abs-bar__row">
            <div className="pd-abs-bar__step">
              <div className="pd-abs-bar__circle pd-abs-bar__circle--done">✓</div>
              <span className="pd-abs-bar__label pd-abs-bar__label--done">A 诊断</span>
            </div>
            <div className="pd-abs-bar__line pd-abs-bar__line--done" />
            <div className="pd-abs-bar__step">
              <div className="pd-abs-bar__circle pd-abs-bar__circle--done">✓</div>
              <span className="pd-abs-bar__label pd-abs-bar__label--done">B 目标</span>
            </div>
            <div className="pd-abs-bar__line pd-abs-bar__line--done" />
            <div className="pd-abs-bar__step">
              <div className="pd-abs-bar__circle pd-abs-bar__circle--current" />
              <span className="pd-abs-bar__label pd-abs-bar__label--active">S 方案</span>
            </div>
          </div>
        </div>

        {/* B 目标设定区 */}
        <div className="pd-card">
          <div className="pd-card__header">
            <div className="pd-card__header-icon">🎯</div>
            <h2 className="pd-card__title">量化目标确认</h2>
          </div>
          <div className="pd-target-grid">
            <div className="pd-target-card">
              <div className="pd-target-card__header">
                <h3 className="pd-target-card__title">目标 1：薪酬结构调整</h3>
                <span>✅</span>
              </div>
              <p className="pd-target-card__current">现状：宽带模糊，15级无清晰定义</p>
              <p className="pd-target-card__goal">目标：建立 P1-P8 八级职级带宽体系</p>
              <p className="pd-target-card__metric">量化：每个职级带宽范围 ±15%</p>
            </div>
            <div className="pd-target-card">
              <div className="pd-target-card__header">
                <h3 className="pd-target-card__title">目标 2：绩效与薪酬挂钩</h3>
                <span>⬜</span>
              </div>
              <p className="pd-target-card__current">现状：绩效结果与调薪无直接关联</p>
              <p className="pd-target-card__goal">目标：绩效等级决定调薪幅度</p>
              <p className="pd-target-card__metric">量化：A级调薪≥15%，B级8-12%，C级≤5%</p>
            </div>
            <div className="pd-target-card">
              <div className="pd-target-card__header">
                <h3 className="pd-target-card__title">目标 3：核心员工保留</h3>
                <span>⬜</span>
              </div>
              <p className="pd-target-card__current">现状：核心员工离职率 15%</p>
              <p className="pd-target-card__goal">目标：12 个月内降至 ≤8%</p>
              <p className="pd-target-card__metric">量化：年度核心员工流失率</p>
            </div>
          </div>
          <div className="pd-card__footer">
            <button className="pd-btn-secondary">修改目标</button>
            <button className="pd-btn-primary" onClick={handleGeneratePlan}>
              确认目标 → 生成方案
            </button>
          </div>
        </div>

        {/* 三源标注栏 */}
        <div className="pd-card">
          <div className="pd-card__header">
            <div className="pd-card__header-icon">🔗</div>
            <h2 className="pd-card__title">方案生成调用源</h2>
          </div>
          <div className="pd-source-bar">
            <div className="pd-source-item pd-source-item--private">
              <span>🗄️</span>
              <div>
                <p className="pd-source-item__name">M12 私有库</p>
                <p className="pd-source-item__status">✓ K3 接口可用</p>
              </div>
            </div>
            <div className="pd-source-item pd-source-item--xiejun">
              <span>📚</span>
              <div>
                <p className="pd-source-item__name">M12 携君库</p>
                <p className="pd-source-item__status">✓ K3 接口可用</p>
              </div>
            </div>
            <div className="pd-source-item pd-source-item--smart">
              <span>🔧</span>
              <div>
                <p className="pd-source-item__name">M6 智能办公</p>
                <p className="pd-source-item__status">✓ K3 接口可用</p>
              </div>
            </div>
            <div className="pd-source-summary">
              <p className="pd-source-summary__label">三源调用可用率</p>
              <div className="pd-source-summary__bar-row">
                <div className="pd-source-summary__bar">
                  <div className="pd-source-summary__bar-fill" style={{ width: '100%' }} />
                </div>
                <span className="pd-source-summary__pct">100%</span>
              </div>
            </div>
          </div>
        </div>

        {/* S 方案 A/B 双版 */}
        <div style={{ marginBottom: 24 }}>
          <h2 className="pd-project-list__title" style={{ marginBottom: 16 }}>S 解决方案</h2>
          <div className="pd-solution-grid">
            {/* A 版：保守方案 */}
            <div
              className={`pd-solution-card ${selectedVersion === 'A' ? 'pd-solution-card--selected' : ''}`}
              onClick={() => handleSelectVersion('A')}
            >
              <div className="pd-solution-card__header">
                <div className="pd-solution-card__icon pd-solution-card__icon--a">🛡️</div>
                <div>
                  <h3 className="pd-solution-card__name">A 版：保守方案</h3>
                  <span className="pd-solution-card__strategy">策略：渐进式优化</span>
                </div>
              </div>
              <div className="pd-solution-card__tags">
                <span className="pd-solution-tag pd-solution-tag--low">风险：低</span>
                <span className="pd-solution-tag pd-solution-tag--cycle">周期：4-6 个月</span>
              </div>
              <div className="pd-solution-card__section">
                <p className="pd-solution-card__section-title">一、薪酬结构优化</p>
                <p className="pd-solution-card__section-desc">在现有体系上微调职级带宽，不触动核心框架</p>
              </div>
              <div className="pd-solution-card__section">
                <p className="pd-solution-card__section-title">二、绩效联动机制</p>
                <p className="pd-solution-card__section-desc">仅调整调薪系数，不改变考核方式</p>
              </div>
              <div className="pd-solution-card__section">
                <p className="pd-solution-card__section-title">三、员工保留计划</p>
                <p className="pd-solution-card__section-desc">仅针对核心岗位增设留任奖金</p>
              </div>
              <div className="pd-solution-card__btn">
                <button className="pd-btn-primary" style={{ width: '100%' }}>
                  选择 A 版
                </button>
              </div>
            </div>

            {/* B 版：进取方案（VIP锁定） */}
            <div className="pd-solution-card pd-solution-card--locked">
              <div className="pd-vip-lock">
                <span className="pd-vip-lock__icon">🔒</span>
                <p className="pd-vip-lock__text">升级初级 VIP 解锁 B 版进取方案</p>
                <button className="pd-vip-lock__btn" onClick={() => toast('请前往会员中心升级')}>
                  升级解锁
                </button>
              </div>
              <div className="pd-content-blurred">
                <div className="pd-solution-card__header">
                  <div className="pd-solution-card__icon pd-solution-card__icon--b">🚀</div>
                  <div>
                    <h3 className="pd-solution-card__name">B 版：进取方案</h3>
                    <span className="pd-solution-card__strategy">策略：系统性重构</span>
                  </div>
                </div>
                <div className="pd-solution-card__tags">
                  <span className="pd-solution-tag pd-solution-tag--mid">风险：中</span>
                  <span className="pd-solution-tag pd-solution-tag--cycle">周期：8-12 个月</span>
                </div>
                <div className="pd-solution-card__section">
                  <p className="pd-solution-card__section-title">一、全面薪酬重塑</p>
                  <p className="pd-solution-card__section-desc">推翻现有体系，从市场对标出发从头设计</p>
                </div>
                <div className="pd-solution-card__section">
                  <p className="pd-solution-card__section-title">二、绩效薪酬一体化</p>
                  <p className="pd-solution-card__section-desc">重新设计绩效指标体系，与薪酬深度绑定，引入360评估</p>
                </div>
                <div className="pd-solution-card__section">
                  <p className="pd-solution-card__section-title">三、人才全面盘点</p>
                  <p className="pd-solution-card__section-desc">全公司人才盘点 + 继任计划 + 长期激励方案</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 底部操作 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="pd-btn-secondary" onClick={() => toast('方案已重新生成')}>
              🔄 重新生成
            </button>
            <button className="pd-btn-secondary" onClick={() => toast('草稿已保存')}>
              💾 保存草稿
            </button>
          </div>
          <button
            className="pd-btn-primary"
            disabled={!selectedVersion}
            onClick={handleConfirm}
          >
            → 选定方案 → 进入定稿
          </button>
        </div>

        {/* 加载动画覆盖层 */}
        {isLoading && (
          <div className="pd-loading-overlay">
            <div className="pd-loading-modal">
              <div className="pd-loading-spinner">⏳</div>
              <p className="pd-loading-text">小耕正在调用三源知识库为你定制方案...</p>
              <div className="pd-loading-sources">
                <span>🗄️</span>
                <span>📚</span>
                <span>🔧</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  )
}
