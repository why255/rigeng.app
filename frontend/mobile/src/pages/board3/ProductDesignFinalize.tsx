import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { useToast } from '@rigeng/shared/components/primitives/toast'
import '../pages.css'
import './product-design.css'

type ExportFormat = 'PDF' | 'Word' | 'Markdown'

/** M10-P4 移动端 方案定稿页 */
export function ProductDesignFinalize() {
  const navigate = useNavigate()
  const toast = useToast()
  const [exportFormat, setExportFormat] = useState<ExportFormat>('PDF')

  return (
    <PageContainer width="dashboard">
      <div data-module="product-design">
        {/* 品牌标语 */}
        <p className="pdm-slogan">日耕朝夕，耕愈工作，耕暖生活</p>
        <p className="pdm-brand-sub">经验沉下来，产品自然成</p>

        {/* ABS 进度条 — 全部完成 */}
        <div className="pdm-abs-steps">
          <div className="pdm-abs-step">
            <div className="pdm-abs-step__circle pdm-abs-step__circle--done">✓</div>
            <span className="pdm-abs-step__label pdm-abs-step__label--active">A 诊断</span>
          </div>
          <div className="pdm-abs-line pdm-abs-line--done" />
          <div className="pdm-abs-step">
            <div className="pdm-abs-step__circle pdm-abs-step__circle--done">✓</div>
            <span className="pdm-abs-step__label pdm-abs-step__label--active">B 目标</span>
          </div>
          <div className="pdm-abs-line pdm-abs-line--done" />
          <div className="pdm-abs-step">
            <div className="pdm-abs-step__circle pdm-abs-step__circle--done">✓</div>
            <span className="pdm-abs-step__label pdm-abs-step__label--active">S 方案</span>
          </div>
        </div>

        <span className="pdm-page-badge">ABS · 方案定稿</span>

        {/* 方案定稿预览 */}
        <div className="pdm-card">
          <div className="pdm-final-header">
            <div className="pdm-final-header__icon">📋</div>
            <div>
              <h4 className="pdm-final-header__name">A版保守型方案</h4>
              <p className="pdm-final-header__sub">薪酬体系渐进式优化方案</p>
            </div>
            <span style={{ marginLeft: 'auto' }}>✅</span>
          </div>

          <div style={{ borderTop: '1px solid #F5F3EF', paddingTop: 16 }}>
            <div className="pdm-final-chapter">
              <h5 className="pdm-final-chapter__title">
                <span className="pdm-final-chapter__dot" />
                第一章：薪酬结构优化
              </h5>
              <div className="pdm-final-chapter__content">
                建立从 P1 助理级到 P8 资深专家级的职级矩阵。薪酬带宽设定在 ±15%，确保各层级之间有合理的重叠与晋升空间。
              </div>
            </div>
            <div className="pdm-final-chapter">
              <h5 className="pdm-final-chapter__title">
                <span className="pdm-final-chapter__dot" />
                第二章：绩效联动机制
              </h5>
              <div className="pdm-final-chapter__content">
                引入调薪系数：S级 (1.5) / A级 (1.2) / B级 (1.0) / C级 (0.8)。年度奖金包与公司整体业绩达成率挂钩。
              </div>
            </div>
            <div className="pdm-final-chapter">
              <h5 className="pdm-final-chapter__title">
                <span className="pdm-final-chapter__dot" />
                第三章：员工保留计划
              </h5>
              <div className="pdm-final-chapter__content">
                针对关键岗位人才设立"留任奖金"，分三年发放。同时配套个性化职业发展路径规划。
              </div>
            </div>
          </div>
        </div>

        {/* 导出格式 */}
        <div className="pdm-format-selector">
          <p className="pdm-format-selector__title">导出格式</p>
          <div className="pdm-format-tabs">
            {(['PDF', 'Word', 'Markdown'] as ExportFormat[]).map((fmt) => (
              <button
                key={fmt}
                className={`pdm-format-tab ${exportFormat === fmt ? 'pdm-format-tab--active' : ''}`}
                onClick={() => setExportFormat(fmt)}
              >
                {fmt}
              </button>
            ))}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="pdm-action-stack">
          <button
            className="pdm-btn-primary"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onClick={() => {
              toast('方案已导入交付工作台')
              setTimeout(() => navigate('/m/deliver-order'), 800)
            }}
          >
            导入交付工作台 →
          </button>
          <button
            className="pdm-btn-outline"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            onClick={() => toast('方案已归档至知识库')}
          >
            归档至知识库 📦
          </button>
        </div>

        <p className="pdm-footer-note">方案已通过私有化加密处理，仅您可见</p>
      </div>
    </PageContainer>
  )
}
