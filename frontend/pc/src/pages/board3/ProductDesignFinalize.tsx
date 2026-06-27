import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { useToast } from '@rigeng/shared/components/primitives/toast'
import '../pages.css'
import './product-design.css'

type ExportFormat = 'PDF' | 'Word' | 'Markdown'

/** M10-P4 方案定稿页 — 方案预览 + 导出 + 归档 + 导入交付 */
export function ProductDesignFinalize() {
  const navigate = useNavigate()
  const toast = useToast()
  const [exportFormat, setExportFormat] = useState<ExportFormat>('PDF')

  const handleExport = () => {
    toast(`${exportFormat} 文档已导出，请查看下载文件夹`)
  }

  const handleDeploy = () => {
    toast('方案已导入交付工作台')
    setTimeout(() => navigate('/m/deliver-order'), 800)
  }

  const handleArchive = () => {
    toast('方案已归档至知识库')
  }

  return (
    <PageContainer width="dashboard">
      <div data-module="product-design">
        {/* 品牌标语 */}
        <p className="pd-slogan">日耕朝夕，耕愈工作，耕暖生活</p>
        <h1 className="pd-brand-sub">经验沉下来，产品自然成</h1>

        {/* ABS 阶段标签 */}
        <div className="pd-page-header">
          <span className="pd-page-badge">🚩 ABS · 方案定稿</span>
        </div>

        {/* ABS 进度条 — 全部完成 */}
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
              <div className="pd-abs-bar__circle pd-abs-bar__circle--done">✓</div>
              <span className="pd-abs-bar__label pd-abs-bar__label--done">S 方案</span>
            </div>
            <div className="pd-abs-bar__line pd-abs-bar__line--done" />
            <div className="pd-abs-bar__step">
              <div className="pd-abs-bar__circle pd-abs-bar__circle--done">✓</div>
              <span className="pd-abs-bar__label pd-abs-bar__label--active">定稿</span>
            </div>
          </div>
        </div>

        {/* 方案定稿预览 */}
        <div className="pd-card">
          <div className="pd-final-header">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div className="pd-card__header-icon">📋</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h2 className="pd-card__title">A 版：保守方案 — 薪酬体系渐进优化</h2>
                    <span>✅</span>
                  </div>
                  <span
                    className="pd-card__badge"
                    style={{ background: 'rgba(232,169,77,0.05)', color: '#E8A94D', border: '1px solid rgba(232,169,77,0.2)' }}
                  >
                    P2 方案内容
                  </span>
                </div>
                <p className="pd-final-header__meta">
                  客户：某科技公司 · 创建：2026-06-20 · 定稿：2026-06-22
                </p>
              </div>
            </div>
          </div>

          <div className="pd-final-content">
            {/* 第一章 */}
            <div className="pd-final-chapter">
              <h3 className="pd-final-chapter__title">
                <span style={{ color: 'var(--module-color-primary)' }}>📋</span>
                一、薪酬结构优化（4-6 个月）
              </h3>
              <div className="pd-final-chapter__items">
                <div className="pd-final-chapter__item">
                  <p className="pd-final-chapter__item-title">1.1 职级体系梳理</p>
                  <p className="pd-final-chapter__item-desc">
                    梳理现有 15 级 → 归并为 P1-P8 八级，明确各级职责定义与上下级汇报关系。
                  </p>
                </div>
                <div className="pd-final-chapter__item">
                  <p className="pd-final-chapter__item-title">1.2 带宽设计</p>
                  <p className="pd-final-chapter__item-desc">
                    每级带宽范围：中点 ±15%，确保级间重叠度控制在 30% 以内，打通晋升通道。
                  </p>
                </div>
                <div className="pd-final-chapter__item">
                  <p className="pd-final-chapter__item-title">1.3 套改方案</p>
                  <p className="pd-final-chapter__item-desc">
                    新老体系平滑过渡，无降薪原则，分三步在 6 个月内完成全员套改。
                  </p>
                </div>
              </div>
            </div>

            {/* 第二章 */}
            <div className="pd-final-chapter">
              <h3 className="pd-final-chapter__title">
                <span style={{ color: 'var(--module-color-primary)' }}>📋</span>
                二、绩效联动机制（2-3 个月）
              </h3>
              <div className="pd-final-chapter__items">
                <div className="pd-final-chapter__item">
                  <p className="pd-final-chapter__item-title">2.1 调薪系数设计</p>
                  <p className="pd-final-chapter__item-desc">
                    A 级 ≥15% / B 级 8-12% / C 级 ≤5%，绩效等级直接决定调薪幅度，强关联激励。
                  </p>
                </div>
                <div className="pd-final-chapter__item">
                  <p className="pd-final-chapter__item-title">2.2 特殊调整通道</p>
                  <p className="pd-final-chapter__item-desc">
                    核心岗位/稀缺人才可走绿色通道，不受年度调薪窗口期限制，灵活应对市场变化。
                  </p>
                </div>
              </div>
            </div>

            {/* 第三章 */}
            <div className="pd-final-chapter">
              <h3 className="pd-final-chapter__title">
                <span style={{ color: 'var(--module-color-primary)' }}>📋</span>
                三、员工保留计划（持续）
              </h3>
              <div className="pd-final-chapter__items">
                <div className="pd-final-chapter__item">
                  <p className="pd-final-chapter__item-title">3.1 核心岗位留任奖金</p>
                  <p className="pd-final-chapter__item-desc">
                    针对关键岗位设置分三年兑现的留任奖金，首年 40%、次年 30%、第三年 30%。
                  </p>
                </div>
                <div className="pd-final-chapter__item">
                  <p className="pd-final-chapter__item-title">3.2 关键人才识别与标记机制</p>
                  <p className="pd-final-chapter__item-desc">
                    建立九宫格人才盘点机制，每季度更新，高潜人才纳入继任计划池。
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="pd-final-footer">
            <p className="pd-final-footer__text">
              本方案由日耕 APP 提供 · 三源引用：M12 私有库 + M12 携君库 + M6 智能办公
            </p>
          </div>
        </div>

        {/* 操作按钮组 */}
        <div className="pd-card">
          {/* 导出格式选择 */}
          <div className="pd-format-selector">
            <span className="pd-format-selector__label">导出格式：</span>
            <div className="pd-format-segment">
              {(['PDF', 'Word', 'Markdown'] as ExportFormat[]).map((fmt) => (
                <button
                  key={fmt}
                  className={`pd-format-btn ${exportFormat === fmt ? 'pd-format-btn--active' : ''}`}
                  onClick={() => setExportFormat(fmt)}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          {/* 操作按钮组 */}
          <div className="pd-action-grid">
            <button className="pd-btn-outline" onClick={handleExport}>
              📤 导出 PDF
            </button>
            <button className="pd-btn-outline" onClick={handleExport}>
              📤 导出 Word
            </button>
            <button className="pd-btn-secondary" onClick={() => toast('编辑功能已打开')}>
              ✏️ 编辑方案
            </button>
            <button className="pd-btn-secondary" onClick={() => toast('视频辅导预约已提交')}>
              🎥 预约视频辅导
            </button>
          </div>

          {/* 主要操作行 */}
          <div className="pd-action-row">
            <div className="pd-action-row__primary">
              <button className="pd-btn-primary" style={{ width: '100%', padding: '12px 24px' }} onClick={handleDeploy}>
                → 导入交付工作台 →
              </button>
            </div>
            <div className="pd-action-row__secondary">
              <button
                className="pd-btn-outline"
                style={{ borderColor: '#6B8FBF', color: '#6B8FBF' }}
                onClick={handleArchive}
              >
                📦 归档至知识库
              </button>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
