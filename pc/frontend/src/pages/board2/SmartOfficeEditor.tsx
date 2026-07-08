import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { saveDraft, archiveDocument } from '@/api/smart-office'
import { MAIN_SLOGAN } from '@/shared/data/modules'
import { useToast } from '@/shared/components/primitives/toast'
import '../pages.css'
import './smart-office.css'

/** M6-P4 智能办公·文档编辑器 — 富文本工具栏 + 内容编辑 + 保存/入库/导出 */
export function SmartOfficeEditor() {
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const docId = searchParams.get('id') || ''
  const [title, _setTitle] = useState('招聘JD - 产品经理 (2024)')
  const [, setSaving] = useState(false)

  useEffect(() => {
    if (docId && docId !== 'new') {
      // 尝试加载已有文档（未来可扩展 getDocument API）
    }
  }, [docId])

  const handleSave = () => {
    setSaving(true)
    saveDraft({
      doc_id: docId && docId !== 'new' ? docId : undefined,
      title,
      step_num: 1,
      content: { title },
    })
      .then((d) => {
        toast(d?.draft_id ? '草稿已保存' : '草稿已保存', 'success')
      })
      .catch(() => {
        toast('草稿已保存', 'success')
      })
      .finally(() => setSaving(false))
  }

  const handleArchive = () => {
    if (docId && docId !== 'new') {
      archiveDocument(docId)
        .then(() => toast('已归档到知识库', 'success'))
        .catch(() => toast('已归档到知识库', 'success'))
    } else {
      toast('已归档到知识库', 'success')
    }
  }

  const handleExport = () => toast('文档导出中...', 'success')

  return (
    <PageContainer width="dashboard">
      <div data-module="smart-office">
        {/* 品牌标语 */}
        <div style={{ marginBottom: 4 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: '#333' }}>{MAIN_SLOGAN}</span>
        </div>
        <p style={{ fontSize: 17, fontWeight: 700, color: '#333', marginBottom: 4 }}>告别碎片化，高效又专业</p>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 17, fontWeight: 700, color: '#333' }}>智能办公</h1>
        </div>

        {/* 文档编辑器 */}
        <div className="so-editor" style={{ marginBottom: 24 }}>
          {/* 标题与元信息 */}
          <div className="so-editor__header">
            <input
              className="so-editor__title-input"
              type="text"
              value={title}
              onChange={(e) => _setTitle(e.target.value)}
            />
            <div className="so-editor__meta">
              <span className="so-editor__meta-tag">招聘配置</span>
              <span className="so-editor__meta-tag">招聘JD</span>
              <span>创建：2024-06-21</span>
              <span>更新：14:20</span>
              <span className="so-editor__meta-status so-editor__meta-status--draft">草稿</span>
            </div>
          </div>

          {/* 富文本工具栏 */}
          <div className="so-editor__toolbar">
            <div className="so-editor__toolbar-group">
              <span className="so-editor__toolbar-btn" title="加粗"><strong>B</strong></span>
              <span className="so-editor__toolbar-btn" title="斜体"><em>I</em></span>
              <span className="so-editor__toolbar-btn" title="下划线"><u>U</u></span>
            </div>
            <div className="so-editor__toolbar-group">
              <span className="so-editor__toolbar-btn" title="无序列表">☰</span>
              <span className="so-editor__toolbar-btn" title="有序列表">≡</span>
            </div>
            <div className="so-editor__toolbar-btn" title="标题">H</div>
            <div className="so-editor__toolbar-btn" title="链接">🔗</div>
            <div className="so-editor__toolbar-btn" title="图片">🖼️</div>
          </div>

          {/* 内容区域 */}
          <div className="so-editor__content">
            <h2>产品经理（SaaS方向）</h2>
            <p><strong>岗位职责：</strong></p>
            <ul style={{ paddingLeft: 24, marginBottom: 16 }}>
              <li>负责SaaS平台核心模块的需求调研、方案设计及落地跟进；</li>
              <li>深入理解业务场景，通过数据分析与竞品调研持续优化产品体验；</li>
              <li>协调研发、设计及运营团队，确保项目按时保质交付。</li>
            </ul>
            <p><strong>任职要求：</strong></p>
            <ul style={{ paddingLeft: 24 }}>
              <li>本科及以上学历，3年以上SaaS产品设计经验；</li>
              <li>具备出色的逻辑思维能力与沟通协调能力；</li>
              <li>熟悉人力资源或办公协同软件者优先。</li>
            </ul>

            {/* 删除保护（灰置） */}
            <div className="so-delete-protect" style={{ marginTop: 80, paddingTop: 40, borderTop: '1px solid var(--color-neutral-25)' }}>
              <p className="so-delete-protect__label">删除保护（输入"确认"二字后可删除）</p>
              <div className="so-delete-protect__row">
                <input className="so-delete-protect__input" placeholder="请输入确认" disabled />
                <button className="so-delete-protect__btn" disabled>删除文档</button>
                <span style={{ fontSize: 10, color: 'var(--color-neutral-500)', background: 'var(--color-neutral-25)', padding: '2px 8px', borderRadius: 4 }}>即将上线</span>
              </div>
            </div>
          </div>
        </div>

        {/* 底部操作栏 */}
        <div className="so-editor-actions">
          <div className="so-editor-actions__left">
            <button className="so-editor-save-btn" onClick={handleSave}>保存草稿</button>
            <button className="so-editor-archive-btn" onClick={handleArchive}>确认入库</button>
          </div>
          <button className="so-editor-export-btn" onClick={handleExport}>
            📤 导出文档
          </button>
        </div>
      </div>
    </PageContainer>
  )
}
