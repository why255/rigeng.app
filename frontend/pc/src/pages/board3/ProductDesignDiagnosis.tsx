import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { useToast } from '@rigeng/shared/components/primitives/toast'
import '../pages.css'
import './product-design.css'

/** 诊断问卷数据结构 */
interface DiagnosisData {
  q1_salary_level: string
  q2_grade_clarity: string
  q3_performance_issue: string
  q4_turnover_rate: string
  q5_satisfaction: string
}

/** 上传文件 */
interface UploadedFile {
  name: string
  size: string
  date: string
  icon: string
  color: string
}

const INITIAL_FILES: UploadedFile[] = [
  { name: '现有薪酬制度.pdf', size: '2.4MB', date: '06-16', icon: '📄', color: '#E8A94D' },
  { name: '组织架构图.xlsx', size: '1.8MB', date: '06-14', icon: '📊', color: '#6B8FBF' },
]

/** M10-P2 A诊断页 — 诊断问卷 + 文档上传 + 诊断报告 */
export function ProductDesignDiagnosis() {
  const navigate = useNavigate()
  const toast = useToast()
  const [diagnosis, setDiagnosis] = useState<DiagnosisData>({
    q1_salary_level: 'above_avg',
    q2_grade_clarity: 'basically_clear',
    q3_performance_issue: '考核指标与业务目标脱节，员工普遍反映考核流于形式...',
    q4_turnover_rate: '15',
    q5_satisfaction: 'average',
  })
  const [files, setFiles] = useState<UploadedFile[]>(INITIAL_FILES)
  const [isDragOver, setIsDragOver] = useState(false)
  const [reportConfirmed, setReportConfirmed] = useState(false)
  const [teacherDone, setTeacherDone] = useState(true) // 演示：老师已优化

  const updateField = (field: keyof DiagnosisData, value: string) => {
    setDiagnosis((prev) => ({ ...prev, [field]: value }))
  }

  const handleDeleteFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
    toast('文档已删除')
  }

  const handleUploadClick = () => {
    toast('文件上传功能已触发（演示）')
  }

  return (
    <PageContainer width="dashboard">
      <div data-module="product-design">
        {/* 品牌标语 */}
        <p className="pd-slogan">日耕朝夕，耕愈工作，耕暖生活</p>
        <h1 className="pd-brand-sub">经验沉下来，产品自然成</h1>

        {/* ABS 阶段标签 */}
        <div className="pd-page-header">
          <span className="pd-page-badge">🚩 ABS · A 现状诊断</span>
        </div>

        {/* ABS 三步进度条 */}
        <div className="pd-abs-bar">
          <div className="pd-abs-bar__row">
            <div className="pd-abs-bar__step">
              <div className="pd-abs-bar__circle pd-abs-bar__circle--done">✓</div>
              <span className="pd-abs-bar__label pd-abs-bar__label--done">A 现状诊断</span>
            </div>
            <div className="pd-abs-bar__line pd-abs-bar__line--done" />
            <div className="pd-abs-bar__step">
              <div className="pd-abs-bar__circle pd-abs-bar__circle--pending" />
              <span className="pd-abs-bar__label pd-abs-bar__label--pending">B 目标设定</span>
            </div>
            <div className="pd-abs-bar__line pd-abs-bar__line--pending" />
            <div className="pd-abs-bar__step">
              <div className="pd-abs-bar__circle pd-abs-bar__circle--pending" />
              <span className="pd-abs-bar__label pd-abs-bar__label--pending">S 解决方案</span>
            </div>
          </div>
        </div>

        {/* 诊断问卷 */}
        <div className="pd-card">
          <div className="pd-card__header">
            <div className="pd-card__header-icon">📋</div>
            <h2 className="pd-card__title">客户现状诊断问卷</h2>
          </div>

          {/* 问题1 */}
          <div className="pd-question">
            <p className="pd-question__text">1. 公司当前薪酬水平在行业中处于？</p>
            <div className="pd-question__options">
              {[
                { value: 'below_avg', label: '低于平均' },
                { value: 'avg', label: '持平' },
                { value: 'above_avg', label: '领先' },
              ].map((opt) => (
                <div
                  key={opt.value}
                  className={`pd-option ${diagnosis.q1_salary_level === opt.value ? 'pd-option--selected' : ''}`}
                  onClick={() => updateField('q1_salary_level', opt.value)}
                >
                  <div className="pd-option__radio" />
                  <span className="pd-option__text">{opt.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 问题2 */}
          <div className="pd-question">
            <p className="pd-question__text">2. 现有职级体系是否清晰？</p>
            <div className="pd-question__options">
              {[
                { value: 'very_clear', label: '非常清晰' },
                { value: 'basically_clear', label: '基本清晰' },
                { value: 'unclear', label: '不清晰' },
              ].map((opt) => (
                <div
                  key={opt.value}
                  className={`pd-option ${diagnosis.q2_grade_clarity === opt.value ? 'pd-option--selected' : ''}`}
                  onClick={() => updateField('q2_grade_clarity', opt.value)}
                >
                  <div className="pd-option__radio" />
                  <span className="pd-option__text">{opt.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 问题3 */}
          <div className="pd-question">
            <p className="pd-question__text">3. 绩效管理目前最大的问题是什么？</p>
            <textarea
              className="pd-textarea"
              placeholder="请描述当前绩效管理的主要问题"
              value={diagnosis.q3_performance_issue}
              onChange={(e) => updateField('q3_performance_issue', e.target.value)}
            />
          </div>

          {/* 问题4 */}
          <div className="pd-question">
            <p className="pd-question__text">4. 近一年核心员工离职率？</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                className="pd-number-input"
                type="text"
                value={diagnosis.q4_turnover_rate}
                onChange={(e) => updateField('q4_turnover_rate', e.target.value)}
              />
              <span style={{ fontSize: 'var(--font-size-l5)', color: 'var(--color-neutral-700)' }}>%</span>
            </div>
          </div>

          {/* 问题5 */}
          <div className="pd-question">
            <p className="pd-question__text">5. 员工对薪酬满意度如何？</p>
            <div className="pd-question__options">
              {[
                { value: 'satisfied', label: '满意' },
                { value: 'average', label: '一般' },
                { value: 'dissatisfied', label: '不满意' },
              ].map((opt) => (
                <div
                  key={opt.value}
                  className={`pd-option ${diagnosis.q5_satisfaction === opt.value ? 'pd-option--selected' : ''}`}
                  onClick={() => updateField('q5_satisfaction', opt.value)}
                >
                  <div className="pd-option__radio" />
                  <span className="pd-option__text">{opt.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pd-card__footer">
            <button className="pd-btn-outline" onClick={() => toast('问卷已保存')}>
              保存问卷
            </button>
            <button className="pd-btn-primary" onClick={() => toast('请先完成文档上传')}>
              下一步：上传客户文档 →
            </button>
          </div>
        </div>

        {/* 客户文档上传区 */}
        <div className="pd-card">
          <div className="pd-card__header">
            <div className="pd-card__header-icon">📤</div>
            <h2 className="pd-card__title">客户文档上传</h2>
            <span
              className="pd-card__badge"
              style={{ background: 'rgba(232,169,77,0.1)', color: '#E8A94D' }}
            >
              P2 客户文档
            </span>
          </div>
          <div
            className={`pd-upload-zone ${isDragOver ? 'pd-upload-zone--dragover' : ''}`}
            onClick={handleUploadClick}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragOver(false); toast('文件已接收') }}
          >
            <div className="pd-upload-zone__icon">📤</div>
            <p className="pd-upload-zone__text">拖拽客户文档到此处，或点击上传</p>
            <p className="pd-upload-zone__hint">支持 PDF / Word / Excel（≤20MB）</p>
          </div>
          <div style={{ marginTop: 16 }}>
            {files.map((f, idx) => (
              <div key={idx} className="pd-file-item">
                <div className="pd-file-item__info">
                  <span>{f.icon}</span>
                  <span className="pd-file-item__name">{f.name}</span>
                  <span className="pd-file-item__meta">{f.size} · {f.date}</span>
                </div>
                <button className="pd-file-item__delete" onClick={() => handleDeleteFile(idx)}>
                  删除
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 诊断报告 */}
        <div className="pd-card">
          <div className="pd-card__header">
            <div className="pd-card__header-icon" style={{ background: 'rgba(107,143,191,0.1)' }}>
              🤖
            </div>
            <div>
              <h2 className="pd-card__title">系统诊断报告 V1.0</h2>
            </div>
          </div>
          <div className="pd-report-grid">
            <div>
              <h3 className="pd-report-section__title">
                <span className="pd-report-item__icon pd-report-item__icon--danger">⚠</span>
                核心发现
              </h3>
              <div className="pd-report-item">
                <span className="pd-report-item__icon pd-report-item__icon--danger">•</span>
                <span>薪酬水平领先行业，但结构不透明</span>
              </div>
              <div className="pd-report-item">
                <span className="pd-report-item__icon pd-report-item__icon--danger">•</span>
                <span>职级带宽过窄，晋升通道模糊</span>
              </div>
              <div className="pd-report-item">
                <span className="pd-report-item__icon pd-report-item__icon--danger">•</span>
                <span>绩效与薪酬挂钩不足，激励效果弱</span>
              </div>
            </div>
            <div>
              <h3 className="pd-report-section__title">
                <span style={{ color: '#E8A94D' }}>⚠</span>
                风险提示
              </h3>
              <div className="pd-report-item pd-report-item--risk">
                <span className="pd-report-item__icon pd-report-item__icon--warn">⚠</span>
                <span>核心员工 15% 离职率接近警戒线</span>
              </div>
              <div className="pd-report-item pd-report-item--risk">
                <span className="pd-report-item__icon pd-report-item__icon--warn">⚠</span>
                <span>新老员工薪酬倒挂风险</span>
              </div>
            </div>
          </div>
          <div className="pd-card__footer">
            <button className="pd-btn-secondary">编辑修改</button>
            <button
              className="pd-btn-primary"
              onClick={() => { setReportConfirmed(true); toast('诊断报告已推送老师优化') }}
            >
              确认 → 推送老师优化
            </button>
          </div>

          {/* 老师优化完成提示 */}
          {teacherDone && (
            <div className="pd-teacher-banner">
              <div className="pd-teacher-banner__info">
                <span className="pd-teacher-banner__icon">✅</span>
                <div>
                  <p style={{ fontSize: 'var(--font-size-l5)', fontWeight: 'var(--font-weight-bold)', color: '#333' }}>
                    安老师已完成优化
                  </p>
                  <p style={{ fontSize: 'var(--font-size-l7)', color: 'var(--color-neutral-500)' }}>
                    优化时间：2026-06-20 14:30
                  </p>
                </div>
              </div>
              <button
                className="pd-btn-primary"
                onClick={() => navigate('/m/product-design/target')}
              >
                进入 B 目标设定 →
              </button>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  )
}
