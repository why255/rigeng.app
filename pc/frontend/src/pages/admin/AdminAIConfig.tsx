/**
 * AI配置中心 — 管理员统一管理所有 AI 模块的算法文件和模型绑定
 * Route: /admin/settings/ai-config
 *
 * 合并了旧的 AdminAlgorithm（算法管理）和 AdminModelDegradation（模型降级）。
 * 以模块为维度，一站式管理每个 AI 模块的：
 *   - 算法文件（上传/查看/编辑/删除）
 *   - 模型绑定（查看/降级切换）
 *   - 模块信息（默认配置/降级链/AI能力）
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '@iconify/react'
import {
  getAIModules,
  getAIModuleDetail,
  getAlgorithms,
  getAlgorithmDetail,
  uploadAlgorithm,
  updateAlgorithm,
  deleteAlgorithm,
  getModelConfigs,
  degradeModule,
  type AIModuleItem,
  type AIModuleFullInfo,
  type AlgorithmFileItem,
  type AlgorithmFileDetail,
  type ModelConfigItem,
} from '../../api/admin'
import './admin.css'

/* ─────── 提供商中文名 ─────── */
const PROVIDER_LABELS: Record<string, string> = {
  volcano: '火山引擎',
  dashscope: '阿里云',
  hunyuan: '腾讯混元',
  kimi: 'Kimi',
  deepseek: 'DeepSeek',
  zhipu: '智谱',
  anthropic: 'Claude',
}

/* ─────── 工具函数 ─────── */
function getMyRole(): string {
  try { return JSON.parse(localStorage.getItem('rg_user') || '{}').role || '' } catch { return '' }
}

function formatTime(iso: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

/* ═══════════════════════════════════════════════════════════════
 * 组件
 * ═══════════════════════════════════════════════════════════════ */

export function AdminAIConfig() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  /* ── 模块列表 ── */
  const [modules, setModules] = useState<AIModuleItem[]>([])
  const [loading, setLoading] = useState(true)

  /* ── 选中模块详情 ── */
  const [selectedKey, setSelectedKey] = useState<string | null>(searchParams.get('module'))
  const [moduleDetail, setModuleDetail] = useState<AIModuleFullInfo | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailTab, setDetailTab] = useState<'files' | 'binding' | 'info'>('files')

  /* ── 算法文件操作 ── */
  const [showUpload, setShowUpload] = useState(false)
  const [uploadFilename, setUploadFilename] = useState('')
  const [uploadContent, setUploadContent] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)

  /* 算法文件列表 */
  const [files, setFiles] = useState<AlgorithmFileItem[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)

  /* 查看/编辑 */
  const [viewingFile, setViewingFile] = useState<AlgorithmFileDetail | null>(null)
  const [editingFile, setEditingFile] = useState<AlgorithmFileDetail | null>(null)
  const [editFilename, setEditFilename] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editError, setEditError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  /* ── 模型降级 ── */
  const [allModels, setAllModels] = useState<ModelConfigItem[]>([])
  const [degradeTarget, setDegradeTarget] = useState(false)
  const [degradeModelId, setDegradeModelId] = useState('')
  const [degrading, setDegrading] = useState(false)

  /* ════════════════════════════════════════
   * 加载
   * ════════════════════════════════════════ */

  useEffect(() => {
    if (getMyRole() !== 'superadmin') { navigate('/', { replace: true }); return }
  }, [navigate])

  const loadModules = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAIModules()
      setModules(data)
    } catch (e) {
      console.error('加载模块列表失败', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadModules() }, [loadModules])

  /* 选中模块 */
  const selectModule = useCallback(async (key: string) => {
    setSelectedKey(key)
    setSearchParams({ module: key })
    setDetailTab('files')
    setShowUpload(false)
    setUploadError('')
    setEditingFile(null)
    setViewingFile(null)

    // 加载详情
    setLoadingDetail(true)
    try {
      const detail = await getAIModuleDetail(key)
      setModuleDetail(detail)
      setFiles(detail.files || [])
    } catch (e) {
      console.error('加载模块详情失败', e)
      setModuleDetail(null)
      setFiles([])
    } finally {
      setLoadingDetail(false)
    }

    // 加载模型列表（供降级使用）
    try {
      const modelsData = await getModelConfigs({ page: '1', page_size: '200' })
      setAllModels(modelsData.items)
    } catch (e) {
      console.error('加载模型列表失败', e)
    }
  }, [setSearchParams])

  // 初始化时从 URL 恢复选中模块
  useEffect(() => {
    const moduleFromUrl = searchParams.get('module')
    if (moduleFromUrl && modules.length > 0 && !selectedKey) {
      selectModule(moduleFromUrl)
    }
  }, [modules, searchParams, selectedKey, selectModule])

  /* ════════════════════════════════════════
   * 算法文件操作
   * ════════════════════════════════════════ */

  const handleUpload = async () => {
    setUploadError('')
    if (!uploadFilename.trim()) { setUploadError('请输入文件名'); return }
    if (!uploadContent.trim()) { setUploadError('请输入文件内容'); return }

    setUploading(true)
    try {
      await uploadAlgorithm(selectedKey!, uploadFilename, uploadContent)
      setUploadFilename('')
      setUploadContent('')
      setShowUpload(false)
      // 刷新
      if (selectedKey) selectModule(selectedKey)
      loadModules()
    } catch (e: any) {
      setUploadError(e.message || '上传失败')
    } finally {
      setUploading(false)
    }
  }

  const handleViewFile = async (fileId: string) => {
    try {
      const detail = await getAlgorithmDetail(fileId)
      setViewingFile(detail)
    } catch (e: any) {
      alert(e.message || '获取文件内容失败')
    }
  }

  const handleEditFile = async (fileId: string) => {
    try {
      const detail = await getAlgorithmDetail(fileId)
      setEditingFile(detail)
      setEditFilename(detail.original_filename)
      setEditContent(detail.content)
      setEditError('')
    } catch (e: any) {
      alert(e.message || '获取文件内容失败')
    }
  }

  const handleSaveEdit = async () => {
    if (!editingFile) return
    setEditError('')
    setSaving(true)
    try {
      await updateAlgorithm(editingFile.id, {
        original_filename: editFilename,
        content: editContent,
      })
      setEditingFile(null)
      if (selectedKey) selectModule(selectedKey)
      loadModules()
    } catch (e: any) {
      setEditError(e.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteFile = async (fileId: string) => {
    try {
      await deleteAlgorithm(fileId)
      setDeletingId(null)
      if (selectedKey) selectModule(selectedKey)
      loadModules()
    } catch (e: any) {
      alert(e.message || '删除失败')
      setDeletingId(null)
    }
  }

  /* ════════════════════════════════════════
   * 模型降级
   * ════════════════════════════════════════ */

  const handleDegrade = async () => {
    if (!selectedKey || !degradeModelId) return
    setDegrading(true)
    try {
      await degradeModule(selectedKey, degradeModelId)
      setDegradeTarget(false)
      setDegradeModelId('')
      if (selectedKey) selectModule(selectedKey)
      loadModules()
    } catch (e: any) {
      alert(e.message || '降级失败')
    } finally {
      setDegrading(false)
    }
  }

  /* ════════════════════════════════════════
   * 渲染
   * ════════════════════════════════════════ */

  /* 降级可用模型 */
  const availableForDegrade = moduleDetail
    ? allModels.filter(m => m.is_available && m.model_name !== moduleDetail.current_model)
    : []
  const sameProviderModels = availableForDegrade.filter(
    m => m.provider_key === moduleDetail?.current_provider
  )
  const otherProviderModels = availableForDegrade.filter(
    m => m.provider_key !== moduleDetail?.current_provider
  )

  return (
    <div className="adm-page">
      {/* ═══════ 页头 ═══════ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Icon icon="mingcute:robot-line" width={28} style={{ color: 'var(--color-primary)' }} />
        <div>
          <h2 style={{ margin: 0 }}>AI配置中心</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--color-neutral-500)', fontSize: 'var(--font-size-l5)' }}>
            管理全部 16 个 AI 模块的算法文件和模型绑定
          </p>
        </div>
      </div>

      {/* ═══════ 模块卡片网格 ═══════ */}
      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-neutral-400)' }}>加载中...</div>
      ) : (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 12, marginBottom: 24,
        }}>
          {modules.map((m) => (
            <div
              key={m.key}
              onClick={() => selectModule(m.key)}
              style={{
                background: selectedKey === m.key ? 'var(--color-primary-light, #FDF0E0)' : '#fff',
                border: selectedKey === m.key
                  ? `2px solid var(--color-primary)`
                  : '1px solid var(--color-neutral-200)',
                borderRadius: 10, padding: 16, cursor: 'pointer',
                transition: 'all 0.15s',
                borderLeft: `4px solid ${m.color || '#999'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Icon icon={m.icon} width={20} style={{ color: m.color || '#999' }} />
                <span style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</span>
                {!m.has_active_binding && (
                  <span style={{
                    fontSize: 10, padding: '1px 6px', borderRadius: 8,
                    background: '#FFEBEE', color: '#C62828', marginLeft: 'auto',
                  }}>未绑定</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-neutral-400)', lineHeight: 1.6 }}>
                {m.current_model ? (
                  <span>
                    {m.model_display_name || m.current_model}
                    <span style={{ marginLeft: 4, opacity: 0.7 }}>
                      ({PROVIDER_LABELS[m.current_provider || ''] || m.current_provider})
                    </span>
                  </span>
                ) : (
                  <span style={{ color: 'var(--color-danger)' }}>未配置模型</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 11, color: 'var(--color-neutral-400)' }}>
                <span>📄 {m.file_count} 个算法文件</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══════ 详情面板 ═══════ */}
      {selectedKey && (
        <div className="adm-panel">
          <div className="adm-panel__header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {moduleDetail && (
                <Icon icon={moduleDetail.icon} width={20} style={{ color: moduleDetail.color }} />
              )}
              <span className="adm-panel__title">{moduleDetail?.name || selectedKey}</span>
              <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-neutral-400)' }}>
                {selectedKey}
              </span>
            </div>
            <button className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => { setSelectedKey(null); setSearchParams({}) }}>
              <Icon icon="mingcute:close-line" width={14} /> 关闭
            </button>
          </div>

          {loadingDetail ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-neutral-400)' }}>加载模块详情...</div>
          ) : moduleDetail ? (
            <>
              {/* Tab 切换 */}
              <div style={{ display: 'flex', gap: 8, padding: '0 20px', borderBottom: '1px solid var(--color-neutral-100)' }}>
                {([
                  ['files', '算法文件', 'mingcute:code-line'],
                  ['binding', '模型绑定', 'mingcute:connection-line'],
                  ['info', '模块信息', 'mingcute:information-line'],
                ] as const).map(([tab, label, icon]) => (
                  <button
                    key={tab}
                    className={`adm-tab${detailTab === tab ? ' adm-tab--active' : ''}`}
                    onClick={() => setDetailTab(tab)}
                    style={{ borderBottom: 'none', borderRadius: '8px 8px 0 0' }}
                  >
                    <Icon icon={icon} width={14} style={{ marginRight: 4 }} />
                    {label}
                  </button>
                ))}
              </div>

              <div style={{ padding: 20 }}>
                {/* ═══ Tab 1: 算法文件 ═══ */}
                {detailTab === 'files' && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                      <button
                        className="adm-btn adm-btn--primary adm-btn--sm"
                        onClick={() => setShowUpload(!showUpload)}
                        disabled={files.length >= 5}
                      >
                        <Icon icon="mingcute:add-line" width={14} /> 上传文件
                      </button>
                      <span style={{ fontSize: 12, color: 'var(--color-neutral-400)' }}>
                        {files.length}/5 个文件
                      </span>
                    </div>

                    {/* 上传表单 */}
                    {showUpload && (
                      <div style={{
                        background: 'var(--color-neutral-50)', borderRadius: 8, padding: 16,
                        marginBottom: 16, border: '1px solid var(--color-neutral-200)',
                      }}>
                        <div style={{ marginBottom: 12 }}>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>文件名 *</label>
                          <input
                            className="adm-search"
                            style={{ width: '100%' }}
                            placeholder="如: hr_rules.txt"
                            value={uploadFilename}
                            onChange={(e) => setUploadFilename(e.target.value)}
                          />
                        </div>
                        <div style={{ marginBottom: 12 }}>
                          <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>文件内容 *</label>
                          <textarea
                            className="adm-search"
                            style={{ width: '100%', minHeight: 200, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
                            placeholder="输入算法/规则文件的文本内容..."
                            value={uploadContent}
                            onChange={(e) => setUploadContent(e.target.value)}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={handleUpload} disabled={uploading}>
                            {uploading ? '上传中...' : '确认上传'}
                          </button>
                          <button className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => { setShowUpload(false); setUploadError('') }}>
                            取消
                          </button>
                          {uploadError && <span style={{ color: 'var(--color-danger)', fontSize: 12 }}>{uploadError}</span>}
                        </div>
                      </div>
                    )}

                    {/* 文件列表 */}
                    {loadingFiles ? (
                      <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-neutral-400)' }}>加载中...</div>
                    ) : files.length === 0 ? (
                      <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-neutral-400)', fontSize: 13 }}>
                        <Icon icon="mingcute:inbox-line" width={32} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.4 }} />
                        暂无算法文件
                      </div>
                    ) : (
                      <div className="adm-table-wrap">
                        <table className="adm-table">
                          <thead>
                            <tr>
                              <th style={{ width: '24%' }}>文件名</th>
                              <th style={{ width: '10%' }}>大小</th>
                              <th style={{ width: '32%' }}>内容预览</th>
                              <th style={{ width: '14%' }}>上传时间</th>
                              <th style={{ width: '20%' }}>操作</th>
                            </tr>
                          </thead>
                          <tbody>
                            {files.map((f) => (
                              <tr key={f.id}>
                                <td style={{ fontWeight: 500, fontSize: 13 }}>{f.original_filename}</td>
                                <td style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>{formatSize(f.file_size)}</td>
                                <td style={{ fontSize: 12, color: 'var(--color-neutral-400)' }}>
                                  {f.content_preview || '-'}
                                </td>
                                <td style={{ fontSize: 12, color: 'var(--color-neutral-400)' }}>{formatTime(f.created_at)}</td>
                                <td>
                                  <div style={{ display: 'flex', gap: 4 }}>
                                    <button className="adm-btn adm-btn--outline adm-btn--sm"
                                      onClick={() => handleViewFile(f.id)}>
                                      <Icon icon="mingcute:eye-line" width={14} /> 查看
                                    </button>
                                    <button className="adm-btn adm-btn--outline adm-btn--sm"
                                      onClick={() => handleEditFile(f.id)}>
                                      <Icon icon="mingcute:edit-line" width={14} /> 编辑
                                    </button>
                                    {deletingId === f.id ? (
                                      <>
                                        <button className="adm-btn adm-btn--danger adm-btn--sm"
                                          onClick={() => handleDeleteFile(f.id)}>确认</button>
                                        <button className="adm-btn adm-btn--outline adm-btn--sm"
                                          onClick={() => setDeletingId(null)}>取消</button>
                                      </>
                                    ) : (
                                      <button className="adm-btn adm-btn--danger adm-btn--sm"
                                        onClick={() => setDeletingId(f.id)}>
                                        <Icon icon="mingcute:delete-2-line" width={14} /> 删除
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}

                {/* ═══ Tab 2: 模型绑定 ═══ */}
                {detailTab === 'binding' && (
                  <>
                    {/* 当前模型 */}
                    <div style={{
                      background: 'var(--color-neutral-50)', borderRadius: 8, padding: 16, marginBottom: 20,
                      border: '1px solid var(--color-neutral-200)',
                    }}>
                      <div style={{ fontSize: 12, color: 'var(--color-neutral-400)', marginBottom: 8 }}>当前绑定</div>
                      {moduleDetail.has_active_binding ? (
                        <div>
                          <div style={{ fontSize: 16, fontWeight: 600 }}>
                            {moduleDetail.model_display_name || moduleDetail.current_model}
                            <span style={{
                              display: 'inline-block', marginLeft: 10, padding: '2px 10px', borderRadius: 4,
                              background: 'var(--color-neutral-200)', fontSize: 12, fontWeight: 500,
                            }}>
                              {PROVIDER_LABELS[moduleDetail.current_provider || ''] || moduleDetail.current_provider}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--color-neutral-400)', marginTop: 4 }}>
                            {moduleDetail.current_model} · v{moduleDetail.current_model_version}
                          </div>
                        </div>
                      ) : (
                        <div style={{ color: 'var(--color-danger)', fontSize: 13, fontWeight: 500 }}>
                          ⚠️ 该模块尚无活跃的模型绑定，将使用注册表默认值：
                          <span style={{ display: 'block', marginTop: 4, color: 'var(--color-neutral-500)' }}>
                            {moduleDetail.default_model} ({PROVIDER_LABELS[moduleDetail.default_provider] || moduleDetail.default_provider})
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 降级按钮 */}
                    <button
                      className="adm-btn adm-btn--primary"
                      onClick={() => { setDegradeTarget(true); setDegradeModelId('') }}
                    >
                      <Icon icon="mingcute:arrow-down-line" width={14} /> 降级/切换模型
                    </button>

                    {/* 降级对话框 */}
                    {degradeTarget && (
                      <div style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
                      }} onClick={() => setDegradeTarget(false)}>
                        <div style={{
                          background: '#fff', borderRadius: 12, padding: 24, width: 500, maxWidth: '90vw',
                          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                        }} onClick={(e) => e.stopPropagation()}>
                          <h3 style={{ margin: '0 0 12px' }}>模型降级 — {moduleDetail.name}</h3>

                          <div style={{
                            background: 'var(--color-neutral-50)', borderRadius: 8, padding: 12, marginBottom: 16,
                          }}>
                            <div style={{ fontSize: 12, color: 'var(--color-neutral-400)' }}>当前</div>
                            <div style={{ fontSize: 14, fontWeight: 600 }}>
                              {moduleDetail.model_display_name || moduleDetail.current_model || moduleDetail.default_model}
                              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-neutral-500)', marginLeft: 8 }}>
                                ({PROVIDER_LABELS[moduleDetail.current_provider || moduleDetail.default_provider] || '未知'})
                              </span>
                            </div>
                          </div>

                          {availableForDegrade.length === 0 ? (
                            <div style={{ color: 'var(--color-neutral-400)', padding: 16, textAlign: 'center' }}>
                              暂无可用的其他模型版本
                            </div>
                          ) : (
                            <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--color-neutral-200)', borderRadius: 8, marginBottom: 16 }}>
                              {sameProviderModels.length > 0 && (
                                <>
                                  <div style={{
                                    fontSize: 11, fontWeight: 600, color: 'var(--color-neutral-400)',
                                    padding: '8px 14px 4px', background: '#fafafa',
                                  }}>
                                    📌 同提供商 · {PROVIDER_LABELS[moduleDetail.current_provider || moduleDetail.default_provider] || '未知'}
                                  </div>
                                  {sameProviderModels.map((m) => (
                                    <label key={m.id} style={{
                                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                                      cursor: 'pointer', borderBottom: '1px solid var(--color-neutral-100)',
                                      background: degradeModelId === m.id ? 'var(--color-primary-light, #FDF0E0)' : '#fff',
                                    }}>
                                      <input type="radio" name="degradeModel" value={m.id}
                                        checked={degradeModelId === m.id}
                                        onChange={() => setDegradeModelId(m.id)} />
                                      <div>
                                        <div style={{ fontSize: 13, fontWeight: 500 }}>
                                          {m.display_name || m.model_name}
                                          <span style={{ fontSize: 11, color: 'var(--color-neutral-400)', marginLeft: 6 }}>v{m.model_version}</span>
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--color-neutral-400)' }}>{m.model_name}</div>
                                      </div>
                                    </label>
                                  ))}
                                </>
                              )}
                              {otherProviderModels.length > 0 && (
                                <>
                                  <div style={{
                                    fontSize: 11, fontWeight: 600, color: 'var(--color-neutral-400)',
                                    padding: '8px 14px 4px', background: '#fafafa',
                                    borderTop: sameProviderModels.length > 0 ? '1px solid var(--color-neutral-200)' : undefined,
                                  }}>🔄 其他提供商</div>
                                  {otherProviderModels.map((m) => (
                                    <label key={m.id} style={{
                                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                                      cursor: 'pointer', borderBottom: '1px solid var(--color-neutral-100)',
                                      background: degradeModelId === m.id ? 'var(--color-primary-light, #FDF0E0)' : '#fff',
                                    }}>
                                      <input type="radio" name="degradeModel" value={m.id}
                                        checked={degradeModelId === m.id}
                                        onChange={() => setDegradeModelId(m.id)} />
                                      <div>
                                        <div style={{ fontSize: 13, fontWeight: 500 }}>
                                          {m.display_name || m.model_name}
                                          <span style={{ fontSize: 11, color: 'var(--color-neutral-400)', marginLeft: 6 }}>v{m.model_version}</span>
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--color-neutral-400)' }}>
                                          {PROVIDER_LABELS[m.provider_key] || m.provider_key} · {m.model_name}
                                        </div>
                                      </div>
                                    </label>
                                  ))}
                                </>
                              )}
                            </div>
                          )}

                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button className="adm-btn adm-btn--outline" onClick={() => setDegradeTarget(false)}>取消</button>
                            <button className="adm-btn adm-btn--primary"
                              disabled={!degradeModelId || degrading}
                              onClick={handleDegrade}>
                              {degrading ? '降级中...' : '确认降级'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* ═══ Tab 3: 模块信息 ═══ */}
                {detailTab === 'info' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--color-neutral-400)', marginBottom: 4 }}>描述</div>
                      <div style={{ fontSize: 13 }}>{moduleDetail.description || '-'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--color-neutral-400)', marginBottom: 4 }}>默认模型</div>
                      <div style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 500 }}>
                        {moduleDetail.default_model}
                        <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 6, color: 'var(--color-neutral-500)' }}>
                          ({PROVIDER_LABELS[moduleDetail.default_provider] || moduleDetail.default_provider})
                        </span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--color-neutral-400)', marginBottom: 4 }}>温度 (Temperature)</div>
                      <div style={{ fontSize: 20, fontWeight: 600, fontFamily: 'monospace' }}>{moduleDetail.temperature}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--color-neutral-400)', marginBottom: 4 }}>AI 能力</div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {moduleDetail.ai_capabilities.map((cap) => (
                          <span key={cap} style={{
                            fontSize: 11, padding: '2px 8px', borderRadius: 12,
                            background: 'var(--color-primary-light, #FDF0E0)',
                            color: 'var(--color-primary)',
                          }}>{cap}</span>
                        ))}
                      </div>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: 12, color: 'var(--color-neutral-400)', marginBottom: 4 }}>降级链 (Fallback Chain)</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 500, color: 'var(--color-primary)' }}>
                          {moduleDetail.default_model}
                        </span>
                        {moduleDetail.fallback_chain.map((m, i) => (
                          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ color: 'var(--color-neutral-300)' }}>→</span>
                            <span style={{ fontSize: 13, fontFamily: 'monospace' }}>{m}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <div style={{ fontSize: 12, color: 'var(--color-neutral-400)', marginBottom: 4 }}>兜底回复模板</div>
                      <div style={{
                        fontSize: 12, color: 'var(--color-neutral-500)', fontStyle: 'italic',
                        background: 'var(--color-neutral-50)', padding: '8px 12px', borderRadius: 6,
                        border: '1px solid var(--color-neutral-100)',
                      }}>
                        {moduleDetail.template_fallback || '-'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ═══════ 文件查看弹窗 ═══════ */}
      {viewingFile && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }} onClick={() => setViewingFile(null)}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 24, width: 700, maxWidth: '90vw',
            maxHeight: '80vh', overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0 }}>{viewingFile.original_filename}</h3>
                <div style={{ fontSize: 12, color: 'var(--color-neutral-400)', marginTop: 2 }}>
                  {formatSize(viewingFile.file_size)} · {formatTime(viewingFile.created_at)}
                </div>
              </div>
              <button className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => setViewingFile(null)}>
                <Icon icon="mingcute:close-line" width={14} /> 关闭
              </button>
            </div>
            <pre style={{
              background: 'var(--color-neutral-50)', padding: 16, borderRadius: 8,
              fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              maxHeight: '60vh', overflow: 'auto', margin: 0,
              border: '1px solid var(--color-neutral-200)',
            }}>
              {viewingFile.content}
            </pre>
          </div>
        </div>
      )}

      {/* ═══════ 文件编辑弹窗 ═══════ */}
      {editingFile && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
        }} onClick={() => setEditingFile(null)}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 24, width: 700, maxWidth: '90vw',
            maxHeight: '90vh', overflow: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px' }}>编辑算法文件</h3>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>文件名</label>
              <input className="adm-search" style={{ width: '100%' }}
                value={editFilename}
                onChange={(e) => setEditFilename(e.target.value)} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>文件内容</label>
              <textarea className="adm-search"
                style={{ width: '100%', minHeight: 350, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)} />
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button className="adm-btn adm-btn--primary" onClick={handleSaveEdit} disabled={saving}>
                {saving ? '保存中...' : '保存'}
              </button>
              <button className="adm-btn adm-btn--outline" onClick={() => setEditingFile(null)}>
                取消
              </button>
              {editError && <span style={{ color: 'var(--color-danger)', fontSize: 12 }}>{editError}</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
