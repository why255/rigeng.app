import { useState, useEffect } from 'react'
import { PageContainer } from '@/components/layout/AppShell'
import { startSystemBuild, submitBuildStep } from '@/api/smart-office'
import { MAIN_SLOGAN } from '@rigeng/shared/data/modules'
import { useToast } from '@rigeng/shared/components/primitives/toast'
import '../pages.css'
import './smart-office.css'

interface SystemStep {
  key: string
  num: number
  title: string
  status: 'done' | 'current' | 'todo'
  desc: string
  summary?: string
}

const FALLBACK_STEPS: SystemStep[] = [
  { key: 's1', num: 1, title: '需求诊断', status: 'current', desc: '系统自动分析组织需求与痛点，生成诊断报告' },
  { key: 's2', num: 2, title: '框架设计', status: 'todo', desc: '基于诊断结果搭建体系框架与核心模块' },
  { key: 's3', num: 3, title: '制度起草', status: 'todo', desc: '起草制度文件、流程图与操作手册' },
  { key: 's4', num: 4, title: '工具配置', status: 'todo', desc: '配置审批流、表单模板与自动化规则' },
  { key: 's5', num: 5, title: '试运行', status: 'todo', desc: '选定试点部门，收集反馈并迭代优化' },
  { key: 's6', num: 6, title: '全员推行', status: 'todo', desc: '发布正式版本，组织全员培训与宣讲' },
]

/** M6-P3 智能办公·体系库 — 六步闭环进度条 + 步骤卡片 */
export function SmartOfficeSystem() {
  const toast = useToast()
  const [steps, setSteps] = useState<SystemStep[]>(FALLBACK_STEPS)
  const [textInput, setTextInput] = useState('')
  const [buildId, setBuildId] = useState('')
  const [, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    startSystemBuild({})
      .then((d) => {
        if (d) {
          setBuildId(d.build_id)
          if (d.steps && d.steps.length > 0) {
            setSteps(
              d.steps.map((s) => ({
                key: `s${s.step_num}`,
                num: s.step_num,
                title: s.step_title,
                status: s.completed ? 'done' as const : s.step_num === d.current_step ? 'current' as const : 'todo' as const,
                desc: s.question || s.hint || '',
              })),
            )
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const doneCount = steps.filter((s) => s.status === 'done').length

  const handleNext = () => {
    if (!textInput.trim()) return
    const idx = steps.findIndex((s) => s.status === 'current')
    if (idx < 0 || idx >= steps.length - 1) return

    const stepNum = idx + 1
    setSubmitting(true)

    submitBuildStep(stepNum, { answer: textInput })
      .then(() => {
        setSteps((prev) =>
          prev.map((s, i) => {
            if (i === idx) return { ...s, status: 'done' as const, summary: textInput }
            if (i === idx + 1) return { ...s, status: 'current' as const }
            return s
          }),
        )
        setTextInput('')
        if (idx + 1 === steps.length - 1) {
          toast('六步闭环完成！', 'success')
        }
      })
      .catch(() => {
        setSteps((prev) =>
          prev.map((s, i) => {
            if (i === idx) return { ...s, status: 'done' as const, summary: textInput }
            if (i === idx + 1) return { ...s, status: 'current' as const }
            return s
          }),
        )
        setTextInput('')
        if (idx + 1 === steps.length - 1) {
          toast('六步闭环完成！', 'success')
        }
      })
      .finally(() => setSubmitting(false))
  }

  if (loading) {
    return (
      <PageContainer width="dashboard">
        <p style={{ padding: 40, textAlign: 'center', color: 'var(--color-neutral-500)' }}>加载中...</p>
      </PageContainer>
    )
  }

  return (
    <PageContainer width="dashboard">
      <div data-module="smart-office">
        {/* 品牌标语 */}
        <div style={{ marginBottom: 4 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: '#333' }}>{MAIN_SLOGAN}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: '#333' }}>告别碎片化，高效又专业</h1>
          <span style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>
            已完成 <span style={{ color: 'var(--module-color-primary)', fontWeight: 700 }}>{doneCount}/{steps.length}</span> 步
          </span>
        </div>

        {/* 六步进度条 */}
        <div className="so-step-bar" style={{ marginBottom: 24 }}>
          {steps.map((s, i) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 0 }}>
              <div className="so-step-node">
                <div className={`so-step-node__circle so-step-node__circle--${s.status}`}>
                  {s.status === 'done' ? '✓' : s.num}
                </div>
                <span className={`so-step-node__label so-step-node__label--${s.status}`}>
                  {s.title}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div className={`so-step-line ${s.status === 'done' ? 'so-step-line--active' : ''}`} />
              )}
            </div>
          ))}
        </div>

        {/* 步骤卡片列表 */}
        <div>
          {steps.map((s) => {
            const cardClass = `so-step-card so-step-card--${s.status}`
            return (
              <div key={s.key} className={cardClass}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <span className="so-step-card__num">{String(s.num).padStart(2, '0')}</span>
                  <div style={{ flex: 1 }}>
                    <div className="so-step-card__header">
                      <span className="so-step-card__icon">{s.status === 'done' ? '✅' : s.status === 'current' ? '\u{1F4DD}' : '\u{1F512}'}</span>
                      <h3 className="so-step-card__title">{s.title}</h3>
                      {s.status === 'done' && <span style={{ color: '#27AE60', marginLeft: 8 }}>✅</span>}
                    </div>

                    {s.status === 'done' && s.summary && (
                      <div className="so-step-summary">{s.summary}</div>
                    )}

                    {s.status === 'current' && (
                      <div style={{ marginTop: 16 }}>
                        {(() => {
                          const prev = steps.find((st) => st.num === s.num - 1)
                          if (prev?.summary) {
                            return (
                              <div className="so-step-hint">
                                <p className="so-step-hint__label">上一步输出摘要：</p>
                                <p className="so-step-hint__text">{prev.summary}</p>
                              </div>
                            )
                          }
                          return null
                        })()}
                        <label style={{ fontSize: 14, fontWeight: 700, display: 'block', marginBottom: 8 }}>
                          本阶段核心任务：
                        </label>
                        <p style={{ fontSize: 13, color: 'var(--color-neutral-500)', marginBottom: 12 }}>{s.desc}</p>
                        <textarea
                          className="so-step-textarea"
                          placeholder="请输入本阶段人力资源总体规划内容..."
                          value={textInput}
                          onChange={(e) => setTextInput(e.target.value)}
                        />
                        <div className="so-step-next">
                          <button className="so-step-next__btn" onClick={handleNext}>
                            下一步
                          </button>
                        </div>
                      </div>
                    )}

                    {s.status === 'todo' && (
                      <p style={{ fontSize: 12, color: 'var(--color-neutral-500)', marginTop: 8 }}>
                        完成上一步后开启
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </PageContainer>
  )
}
