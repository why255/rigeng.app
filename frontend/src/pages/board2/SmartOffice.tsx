import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { getHRModules, getModuleTools, generateDocument } from '@/api/smart-office'
import type { HRModuleItem, ToolCard } from '@/api/smart-office'
import { hrModules as mockHRModules } from '@/data/mock'
import { MAIN_SLOGAN } from '@/data/modules'
import '../pages.css'
import './smart-office.css'

/** M6-P2 智能办公·工具库 — 八大HR模块入口 + 引导式问答 + 生成文档 */
export function SmartOffice() {
  const navigate = useNavigate()
  const [modules, setModules] = useState<HRModuleItem[]>(mockHRModules as unknown as HRModuleItem[])
  const [tools, setTools] = useState<ToolCard[]>([])
  const [activeModule, setActiveModule] = useState('recruitment')
  const [step, setStep] = useState(1) // 1=选择类型, 2=选择规格, 3=生成
  const [docType, setDocType] = useState('招聘 JD')
  const [spec, setSpec] = useState('')
  const [generating, setGenerating] = useState(false)
  const docTypes = ['招聘 JD', '面试评估表', '录用通知书', '入职引导手册']
  const specs = ['基础版', '详细版', '带评分模板']

  useEffect(() => {
    getHRModules().then((d) => { if (d?.modules) setModules(d.modules) }).catch(() => {})
    getModuleTools(activeModule).then((d) => { if (d?.tools) setTools(d.tools) }).catch(() => {})
  }, [])

  const handleGenerate = () => {
    setGenerating(true)
    generateDocument({
      module_key: activeModule,
      tool_key: docType,
      input_text: spec,
      doc_type: docType,
    })
      .then((d) => {
        if (d?.doc_id) {
          navigate(`/m/smart-office/editor?id=${d.doc_id}`)
        } else {
          navigate('/m/smart-office/editor?id=new')
        }
      })
      .catch(() => {
        navigate('/m/smart-office/editor?id=new')
      })
      .finally(() => setGenerating(false))
  }

  return (
    <PageContainer width="dashboard">
      <div data-module="smart-office" style={{ paddingBottom: 280 }}>
        {/* 品牌标语（简写） */}
        <div style={{ marginBottom: 4 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: '#333' }}>{MAIN_SLOGAN}</span>
        </div>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: '#333' }}>告别碎片化，高效又专业</h1>
        </div>

        {/* 八大模块卡片 */}
        <div className="so-modules-grid">
          {modules.map((m: any) => (
            <div
              key={m.key}
              className={`so-module-card ${activeModule === m.key ? 'so-module-card--active' : ''}`}
              onClick={() => { setActiveModule(m.key); setStep(1); setDocType('招聘 JD'); setSpec(''); setGenerating(false); getModuleTools(m.key).then((d) => { if (d?.tools) setTools(d.tools) }).catch(() => {}) }}
            >
              <div className="so-module-card__icon" style={{ backgroundColor: `${m.color || '#6B8FBF'}15` }}>
                <span style={{ fontSize: 24 }}>{m.icon}</span>
              </div>
              <div>
                <h3 className="so-module-card__title">{m.name}</h3>
                <p className="so-module-card__desc">{m.description || m.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* API 工具列表提示 */}
        {tools.length > 0 && (
          <div style={{ margin: '16px 0', padding: 12, background: 'var(--color-neutral-50)', borderRadius: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--color-neutral-500)' }}>
              📋 {tools.length} 个工具可用：{tools.map(t => t.name).join(' · ')}
            </span>
          </div>
        )}

        {/* 引导式提问固定底部栏 */}
        <div className="so-composer-bar">
          <div className="so-composer-bar__inner">
            {/* 第一轮：选择文档类型 */}
            {step >= 1 && (
              <>
                <div className="so-composer-bubble">
                  <div className="so-composer-bubble__avatar">耕</div>
                  <div className="so-composer-bubble__text">
                    姐，需要生成什么类型的文档？
                  </div>
                </div>
                <div className="so-composer-chips">
                  {docTypes.map((t) => (
                    <button
                      key={t}
                      className={`so-composer-chip ${docType === t ? 'so-composer-chip--active' : ''}`}
                      onClick={() => { setDocType(t); setStep(2) }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* 第二轮：选择规格 */}
            {step >= 2 && (
              <>
                <div className="so-composer-bubble" style={{ marginTop: 8 }}>
                  <div className="so-composer-bubble__avatar">耕</div>
                  <div className="so-composer-bubble__text">
                    好的，想要哪种规格的模板？
                  </div>
                </div>
                <div className="so-composer-chips">
                  {specs.map((s) => (
                    <button
                      key={s}
                      className={`so-composer-chip ${spec === s ? 'so-composer-chip--active' : ''}`}
                      onClick={() => { setSpec(s); setStep(3) }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* 生成按钮 / 加载动画 */}
            {step >= 3 && (
              <div className="so-composer-actions">
                {!generating ? (
                  <button className="so-gen-btn" onClick={handleGenerate}>
                    生成文档
                  </button>
                ) : (
                  <div className="so-loading-area">
                    <div className="so-loading-spinner">耕</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>小耕在整理思路…</span>
                      <div className="so-loading-dots">
                        <span className="so-loading-dot" />
                        <span className="so-loading-dot" />
                        <span className="so-loading-dot" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
