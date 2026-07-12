/**
 * 模型降级管理 — 管理员配置模型版本和模块绑定
 * Route: /admin/settings/model-degradation
 *
 * Tab 1: 模型版本管理 — 管理可用的模型版本目录
 * Tab 2: 模块模型绑定 — 管理模块→模型版本的绑定关系，支持一键降级
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'
import {
  getProviders,
  getModelConfigs,
  createModelConfig,
  updateModelConfig,
  deleteModelConfig,
  getModuleBindings,
  degradeModule,
  type ProviderInfo,
  type ModelConfigItem,
  type ModuleModelBindingItem,
} from '../../api/admin'
import './admin.css'

/* ─────── 模块信息映射 ─────── */
const MODULE_INFO: Record<string, { name: string; icon: string; color: string }> = {
  morning_plan:     { name: '朝有规划', icon: 'mingcute:sun-line', color: '#E8A94D' },
  evening_review:   { name: '暮有复盘', icon: 'mingcute:moon-line', color: '#6B8FBF' },
  emotion_treehole: { name: '情绪树洞', icon: 'mingcute:heart-line', color: '#D46B6B' },
  mood_haven:       { name: '情绪港湾', icon: 'mingcute:heart-pulse-line', color: '#D46B6B' },
  smart_qa:         { name: '智能问答', icon: 'mingcute:comment-line', color: '#6BA4B8' },
  smart_office:     { name: '智能办公', icon: 'mingcute:briefcase-line', color: '#C03A39' },
  smart_record:     { name: '会议纪要', icon: 'mingcute:mic-line', color: '#27AE60' },
  smart_job:        { name: '智能求职', icon: 'mingcute:search-line', color: '#27AE60' },
  career:           { name: '高维求职', icon: 'mingcute:rocket-line', color: '#8E44AD' },
  general:          { name: '通用模块', icon: 'mingcute:app-line', color: '#999' },
  hr_template:      { name: 'HR模板', icon: 'mingcute:file-text-line', color: '#E67E22' },
  knowledge_base:   { name: '知识库', icon: 'mingcute:book-6-line', color: '#2ECC71' },
  growth_analysis:  { name: '成长分析', icon: 'mingcute:chart-line', color: '#3498DB' },
  brand_building:   { name: '品牌建设', icon: 'mingcute:star-line', color: '#F39C12' },
  ip_creation:      { name: 'IP创作', icon: 'mingcute:pen-line', color: '#E91E63' },
  multimodal:       { name: '多模态解析', icon: 'mingcute:image-line', color: '#9B59B6' },
}

const PROVIDER_LABELS: Record<string, string> = {
  volcano: '火山引擎',
  dashscope: '阿里云',
  hunyuan: '腾讯混元',
  kimi: 'Kimi',
  deepseek: 'DeepSeek',
  zhipu: '智谱',
  anthropic: 'Claude',
}

function getMyRole(): string {
  try { return JSON.parse(localStorage.getItem('rg_user') || '{}').role || '' } catch { return '' }
}

function formatTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

/* ═══════════════════════════════════════════════════════════════
 * 组件
 * ═══════════════════════════════════════════════════════════════ */

export function AdminModelDegradation() {
  const navigate = useNavigate()

  // 标签页
  const [activeTab, setActiveTab] = useState<'models' | 'bindings'>('models')

  // ── Tab 1: 模型版本管理 ──
  const [models, setModels] = useState<ModelConfigItem[]>([])
  const [modelsTotal, setModelsTotal] = useState(0)
  const [providerFilter, setProviderFilter] = useState<string>('')
  const [loadingModels, setLoadingModels] = useState(false)

  // 新增表单
  const [showAdd, setShowAdd] = useState(false)
  const [newModel, setNewModel] = useState({ provider_key: 'volcano', model_name: '', model_version: '', display_name: '' })
  const [addError, setAddError] = useState('')

  // 编辑行
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<ModelConfigItem>>({})

  // 删除确认
  const [deletingModelId, setDeletingModelId] = useState<string | null>(null)

  // ── Tab 2: 模块绑定 ──
  const [bindings, setBindings] = useState<ModuleModelBindingItem[]>([])
  const [bindingsTotal, setBindingsTotal] = useState(0)
  const [loadingBindings, setLoadingBindings] = useState(false)

  // 降级对话框
  const [degradeTarget, setDegradeTarget] = useState<ModuleModelBindingItem | null>(null)
  const [degradeModelId, setDegradeModelId] = useState<string>('')
  const [degrading, setDegrading] = useState(false)

  /* ─────── 加载 ─────── */

  useEffect(() => {
    if (getMyRole() !== 'superadmin') { navigate('/', { replace: true }); return }
  }, [navigate])

  const loadModels = useCallback(async (provider?: string) => {
    setLoadingModels(true)
    try {
      const params: Record<string, string> = { page: '1', page_size: '200' }
      if (provider) params.provider_key = provider
      const data = await getModelConfigs(params)
      setModels(data.items)
      setModelsTotal(data.total)
    } catch (e) {
      console.error('加载模型列表失败', e)
    } finally {
      setLoadingModels(false)
    }
  }, [])

  const loadBindings = useCallback(async () => {
    setLoadingBindings(true)
    try {
      const data = await getModuleBindings({ page: '1', page_size: '200' })
      // Filter to only active bindings for the main view
      setBindings(data.items.filter(b => b.is_active))
      setBindingsTotal(data.total)
    } catch (e) {
      console.error('加载绑定列表失败', e)
    } finally {
      setLoadingBindings(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'models') loadModels(providerFilter)
    else loadBindings()
  }, [activeTab, providerFilter, loadModels, loadBindings])

  /* ─────── Tab 1 操作 ─────── */

  const handleAddModel = async () => {
    setAddError('')
    if (!newModel.model_name.trim()) { setAddError('请输入模型名称'); return }
    if (!newModel.model_version.trim()) { setAddError('请输入版本号'); return }

    try {
      await createModelConfig(newModel)
      setShowAdd(false)
      setNewModel({ provider_key: 'volcano', model_name: '', model_version: '', display_name: '' })
      loadModels(providerFilter)
    } catch (e: any) {
      setAddError(e.message || '新增失败')
    }
  }

  const handleEditModel = (m: ModelConfigItem) => {
    setEditingId(m.id)
    setEditData({
      provider_key: m.provider_key,
      model_name: m.model_name,
      model_version: m.model_version,
      display_name: m.display_name,
      is_available: m.is_available,
    })
  }

  const handleSaveEdit = async (id: string) => {
    try {
      await updateModelConfig(id, editData)
      setEditingId(null)
      loadModels(providerFilter)
    } catch (e) {
      console.error('更新失败', e)
    }
  }

  const handleDeleteModel = async (id: string) => {
    try {
      await deleteModelConfig(id)
      setDeletingModelId(null)
      loadModels(providerFilter)
    } catch (e: any) {
      alert(e.message || '删除失败')
      setDeletingModelId(null)
    }
  }

  const handleToggleAvailable = async (m: ModelConfigItem) => {
    try {
      await updateModelConfig(m.id, { is_available: !m.is_available })
      loadModels(providerFilter)
    } catch (e) {
      console.error('切换状态失败', e)
    }
  }

  /* ─────── Tab 2 操作 ─────── */

  const handleDegrade = (binding: ModuleModelBindingItem) => {
    setDegradeTarget(binding)
    setDegradeModelId('')
  }

  const handleConfirmDegrade = async () => {
    if (!degradeTarget || !degradeModelId) return
    setDegrading(true)
    try {
      await degradeModule(degradeTarget.module_key, degradeModelId)
      setDegradeTarget(null)
      loadBindings()
    } catch (e: any) {
      alert(e.message || '降级失败')
    } finally {
      setDegrading(false)
    }
  }

  /* ─────── 渲染 ─────── */

  // 降级时可选的目标模型（排除当前使用的）
  const availableForDegrade = degradeTarget
    ? models.filter(m => m.is_available && m.id !== degradeTarget.model_config_id)
    : []

  return (
    <div className="adm-page">
      {/* 页头 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Icon icon="mingcute:robot-line" width={28} style={{ color: 'var(--color-primary)' }} />
        <div>
          <h2 style={{ margin: 0 }}>模型降级</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--color-neutral-500)', fontSize: 'var(--font-size-l5)' }}>
            管理模型版本目录和模块→模型绑定，支持运行时一键降级切换
          </p>
        </div>
      </div>

      {/* 标签页切换 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button
          className={`adm-tab${activeTab === 'models' ? ' adm-tab--active' : ''}`}
          onClick={() => setActiveTab('models')}
        >
          <Icon icon="mingcute:box-line" width={14} style={{ marginRight: 4 }} />
          模型版本管理
        </button>
        <button
          className={`adm-tab${activeTab === 'bindings' ? ' adm-tab--active' : ''}`}
          onClick={() => setActiveTab('bindings')}
        >
          <Icon icon="mingcute:connection-line" width={14} style={{ marginRight: 4 }} />
          模块模型绑定
        </button>
      </div>

      {/* ══════════════════════════════════════
          Tab 1: 模型版本管理
          ══════════════════════════════════════ */}
      {activeTab === 'models' && (
        <>
          {/* 提供商筛选 */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
            <button
              onClick={() => setProviderFilter('')}
              className={`adm-tab${providerFilter === '' ? ' adm-tab--active' : ''}`}
              style={{ fontSize: 12, padding: '4px 12px' }}
            >
              全部
            </button>
            {Object.entries(PROVIDER_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setProviderFilter(key)}
                className={`adm-tab${providerFilter === key ? ' adm-tab--active' : ''}`}
                style={{ fontSize: 12, padding: '4px 12px' }}
              >
                {label}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button
              className="adm-btn adm-btn--primary adm-btn--sm"
              onClick={() => { setShowAdd(!showAdd); setAddError('') }}
            >
              <Icon icon="mingcute:add-line" width={14} /> 新增版本
            </button>
          </div>

          {/* 新增表单 */}
          {showAdd && (
            <div className="adm-panel" style={{ marginBottom: 20 }}>
              <div className="adm-panel__header">
                <span className="adm-panel__title">新增模型版本</span>
                <button className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => setShowAdd(false)}>取消</button>
              </div>
              <div style={{ padding: '0 20px 20px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>提供商</label>
                  <select
                    value={newModel.provider_key}
                    onChange={(e) => setNewModel({ ...newModel, provider_key: e.target.value })}
                    style={{ height: 34, padding: '0 8px', borderRadius: 6, border: '1px solid var(--color-neutral-200)' }}
                  >
                    {Object.entries(PROVIDER_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>模型名称 *</label>
                  <input className="adm-search" style={{ width: 200 }}
                    placeholder="如: doubao-seed-2-0-pro"
                    value={newModel.model_name}
                    onChange={(e) => setNewModel({ ...newModel, model_name: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>版本号 *</label>
                  <input className="adm-search" style={{ width: 120 }}
                    placeholder="如: 2.0-pro"
                    value={newModel.model_version}
                    onChange={(e) => setNewModel({ ...newModel, model_version: e.target.value })} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>显示名称</label>
                  <input className="adm-search" style={{ width: 160 }}
                    placeholder="如: 豆包 Seed 2.0"
                    value={newModel.display_name}
                    onChange={(e) => setNewModel({ ...newModel, display_name: e.target.value })} />
                </div>
                <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={handleAddModel}>
                  确认新增
                </button>
                {addError && <span style={{ color: 'var(--color-danger)', fontSize: 12 }}>{addError}</span>}
              </div>
            </div>
          )}

          {/* 模型列表 */}
          <div className="adm-panel">
            <div className="adm-panel__header">
              <span className="adm-panel__title">模型版本列表</span>
              <span style={{ fontSize: 12, color: 'var(--color-neutral-400)' }}>共 {modelsTotal} 个</span>
            </div>
            {loadingModels ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-neutral-400)' }}>加载中...</div>
            ) : models.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-neutral-400)', fontSize: 13 }}>
                <Icon icon="mingcute:inbox-line" width={32} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.4 }} />
                暂无模型版本
              </div>
            ) : (
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th style={{ width: '14%' }}>提供商</th>
                      <th style={{ width: '22%' }}>模型名称</th>
                      <th style={{ width: '12%' }}>版本</th>
                      <th style={{ width: '16%' }}>显示名称</th>
                      <th style={{ width: '10%' }}>状态</th>
                      <th style={{ width: '26%' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {models.map((m) => (
                      <tr key={m.id}>
                        {editingId === m.id ? (
                          <>
                            <td>
                              <select
                                value={editData.provider_key || ''}
                                onChange={(e) => setEditData({ ...editData, provider_key: e.target.value })}
                                style={{ width: '100%', height: 30, fontSize: 12, borderRadius: 4, border: '1px solid var(--color-neutral-200)' }}
                              >
                                {Object.entries(PROVIDER_LABELS).map(([k, v]) => (
                                  <option key={k} value={k}>{v}</option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input className="adm-search" style={{ width: '100%', height: 30 }}
                                value={editData.model_name || ''}
                                onChange={(e) => setEditData({ ...editData, model_name: e.target.value })} />
                            </td>
                            <td>
                              <input className="adm-search" style={{ width: '100%', height: 30 }}
                                value={editData.model_version || ''}
                                onChange={(e) => setEditData({ ...editData, model_version: e.target.value })} />
                            </td>
                            <td>
                              <input className="adm-search" style={{ width: '100%', height: 30 }}
                                value={editData.display_name || ''}
                                onChange={(e) => setEditData({ ...editData, display_name: e.target.value })} />
                            </td>
                            <td>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                                <input type="checkbox" checked={editData.is_available || false}
                                  onChange={(e) => setEditData({ ...editData, is_available: e.target.checked })} />
                                {editData.is_available ? '可用' : '禁用'}
                              </label>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={() => handleSaveEdit(m.id)}>
                                  保存
                                </button>
                                <button className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => setEditingId(null)}>
                                  取消
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td>
                              <span style={{
                                display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                                background: 'var(--color-neutral-100)', fontSize: 12, fontWeight: 500,
                              }}>
                                {PROVIDER_LABELS[m.provider_key] || m.provider_key}
                              </span>
                            </td>
                            <td style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 500 }}>{m.model_name}</td>
                            <td style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>{m.model_version}</td>
                            <td style={{ fontSize: 13 }}>{m.display_name || '-'}</td>
                            <td>
                              <button
                                onClick={() => handleToggleAvailable(m)}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  padding: '2px 10px', borderRadius: 12, border: 'none', cursor: 'pointer',
                                  fontSize: 11, fontWeight: 600,
                                  background: m.is_available ? '#E8F5E9' : '#FFEBEE',
                                  color: m.is_available ? '#2E7D32' : '#C62828',
                                }}
                              >
                                <span style={{
                                  width: 6, height: 6, borderRadius: '50%',
                                  background: m.is_available ? '#2E7D32' : '#C62828',
                                  display: 'inline-block',
                                }} />
                                {m.is_available ? '可用' : '禁用'}
                              </button>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button className="adm-btn adm-btn--outline adm-btn--sm"
                                  onClick={() => handleEditModel(m)}>
                                  <Icon icon="mingcute:edit-line" width={14} /> 编辑
                                </button>
                                {deletingModelId === m.id ? (
                                  <>
                                    <button className="adm-btn adm-btn--danger adm-btn--sm"
                                      onClick={() => handleDeleteModel(m.id)}>确认</button>
                                    <button className="adm-btn adm-btn--outline adm-btn--sm"
                                      onClick={() => setDeletingModelId(null)}>取消</button>
                                  </>
                                ) : (
                                  <button className="adm-btn adm-btn--danger adm-btn--sm"
                                    onClick={() => setDeletingModelId(m.id)}>
                                    <Icon icon="mingcute:delete-2-line" width={14} /> 删除
                                  </button>
                                )}
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════
          Tab 2: 模块模型绑定
          ══════════════════════════════════════ */}
      {activeTab === 'bindings' && (
        <>
          <div className="adm-panel">
            <div className="adm-panel__header">
              <span className="adm-panel__title">模块→模型绑定列表</span>
              <span style={{ fontSize: 12, color: 'var(--color-neutral-400)' }}>
                共 {bindings.filter(b => b.is_active).length} 个活跃绑定
              </span>
            </div>
            {loadingBindings ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-neutral-400)' }}>加载中...</div>
            ) : bindings.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-neutral-400)', fontSize: 13 }}>
                <Icon icon="mingcute:inbox-line" width={32} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.4 }} />
                暂无绑定数据，请先添加模型版本
              </div>
            ) : (
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th style={{ width: '16%' }}>模块</th>
                      <th style={{ width: '12%' }}>模块KEY</th>
                      <th style={{ width: '22%' }}>当前模型</th>
                      <th style={{ width: '12%' }}>提供商</th>
                      <th style={{ width: '10%' }}>版本</th>
                      <th style={{ width: '10%' }}>状态</th>
                      <th style={{ width: '18%' }}>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bindings.filter(b => b.is_active).map((b) => {
                      const info = MODULE_INFO[b.module_key]
                      return (
                        <tr key={b.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {info && (
                                <Icon icon={info.icon} width={16} style={{ color: info.color }} />
                              )}
                              <span style={{ fontWeight: 500, fontSize: 13 }}>
                                {b.module_display_name || info?.name || b.module_key}
                              </span>
                            </div>
                          </td>
                          <td style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--color-neutral-500)' }}>
                            {b.module_key}
                          </td>
                          <td style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 500 }}>
                            {b.display_name || b.model_name}
                          </td>
                          <td>
                            <span style={{
                              display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                              background: 'var(--color-neutral-100)', fontSize: 11,
                            }}>
                              {PROVIDER_LABELS[b.provider_key || ''] || b.provider_key}
                            </span>
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>{b.model_version}</td>
                          <td>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                              fontSize: 11, fontWeight: 600,
                              color: b.is_active ? '#2E7D32' : '#999',
                            }}>
                              <span style={{
                                width: 6, height: 6, borderRadius: '50%',
                                background: b.is_active ? '#2E7D32' : '#999',
                                display: 'inline-block',
                              }} />
                              {b.is_active ? '活跃' : '停用'}
                            </span>
                          </td>
                          <td>
                            <button
                              className="adm-btn adm-btn--primary adm-btn--sm"
                              onClick={() => handleDegrade(b)}
                              title="切换到其他模型版本"
                            >
                              <Icon icon="mingcute:arrow-down-line" width={14} /> 降级
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════
          降级对话框（模态）
          ══════════════════════════════════════ */}
      {degradeTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999,
        }} onClick={() => setDegradeTarget(null)}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 24, width: 480, maxWidth: '90vw',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <Icon icon="mingcute:arrow-down-line" width={24} style={{ color: 'var(--color-warning, #E67E22)' }} />
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>模型降级</h3>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-neutral-500)' }}>
                  将模块切换到另一个模型版本
                </p>
              </div>
            </div>

            {/* 当前信息 */}
            <div style={{
              background: 'var(--color-neutral-50, #f8f8f8)', borderRadius: 8, padding: 12, marginBottom: 16,
            }}>
              <div style={{ fontSize: 12, color: 'var(--color-neutral-400)', marginBottom: 4 }}>当前绑定</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {degradeTarget.module_display_name || degradeTarget.module_key}
                <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-neutral-500)', marginLeft: 8 }}>
                  → {degradeTarget.display_name || degradeTarget.model_name}
                  （{PROVIDER_LABELS[degradeTarget.provider_key || ''] || degradeTarget.provider_key}）
                </span>
              </div>
            </div>

            {/* 选择目标模型 */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
                降级到（选择目标模型版本）
              </label>
              {availableForDegrade.length === 0 ? (
                <div style={{ color: 'var(--color-neutral-400)', fontSize: 13, padding: 12, textAlign: 'center' }}>
                  暂无可用的其他模型版本，请先在「模型版本管理」中添加
                </div>
              ) : (
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--color-neutral-200)', borderRadius: 8 }}>
                  {availableForDegrade.map((m) => (
                    <label
                      key={m.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                        cursor: 'pointer', borderBottom: '1px solid var(--color-neutral-100)',
                        background: degradeModelId === m.id ? 'var(--color-primary-light, #FDF0E0)' : '#fff',
                      }}
                    >
                      <input
                        type="radio"
                        name="degradeModel"
                        value={m.id}
                        checked={degradeModelId === m.id}
                        onChange={() => setDegradeModelId(m.id)}
                      />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>
                          {m.display_name || m.model_name}
                          <span style={{ fontSize: 11, color: 'var(--color-neutral-400)', marginLeft: 6 }}>
                            v{m.model_version}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--color-neutral-400)' }}>
                          {PROVIDER_LABELS[m.provider_key] || m.provider_key}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* 操作按钮 */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="adm-btn adm-btn--outline" onClick={() => setDegradeTarget(null)}>
                取消
              </button>
              <button
                className="adm-btn adm-btn--primary"
                disabled={!degradeModelId || degrading}
                onClick={handleConfirmDegrade}
              >
                {degrading ? '降级中...' : '确认降级'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
