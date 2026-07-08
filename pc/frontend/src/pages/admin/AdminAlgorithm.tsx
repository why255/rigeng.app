/**
 * 算法管理 — 管理员上传/管理各模块算法文件
 * Route: /admin/settings/algorithm
 *
 * 管理员可为每个模块上传算法文件（txt/md/py/json等），
 * AI调用时自动检索这些文件并优先遵循其内容。
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'
import {
  getAlgorithmModules,
  getAlgorithms,
  uploadAlgorithm,
  deleteAlgorithm,
  type AlgorithmModule,
  type AlgorithmFileItem,
} from '../../api/admin'
import './admin.css'

const MODULE_INFO: Record<string, { name: string; icon: string; color: string }> = {
  morning_plan: { name: '朝有规划', icon: 'mingcute:sun-line', color: '#E8A94D' },
  evening_review: { name: '暮有复盘', icon: 'mingcute:moon-line', color: '#6B8FBF' },
  emotion_treehole: { name: '情绪树洞', icon: 'mingcute:heart-line', color: '#D46B6B' },
  smart_qa: { name: '智能问答', icon: 'mingcute:comment-line', color: '#6BA4B8' },
  smart_office: { name: '智能办公', icon: 'mingcute:briefcase-line', color: '#C03A39' },
  smart_job: { name: '智能求职', icon: 'mingcute:search-line', color: '#27AE60' },
}

function getMyRole(): string {
  try { return JSON.parse(localStorage.getItem('rg_user') || '{}').role || '' } catch { return '' }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function AdminAlgorithm() {
  const navigate = useNavigate()
  const [modules, setModules] = useState<AlgorithmModule[]>([])
  const [selectedModule, setSelectedModule] = useState<string>('')
  const [files, setFiles] = useState<AlgorithmFileItem[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  // 上传表单
  const [showUpload, setShowUpload] = useState(false)
  const [uploadFilename, setUploadFilename] = useState('')
  const [uploadContent, setUploadContent] = useState('')
  const [uploadError, setUploadError] = useState('')

  // 删除确认
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (getMyRole() !== 'superadmin') { navigate('/', { replace: true }); return }
    loadModules()
  }, [navigate])

  const loadModules = async () => {
    try {
      const data = await getAlgorithmModules()
      setModules(data)
      if (data.length > 0 && !selectedModule) {
        setSelectedModule(data[0].key)
      }
    } catch (e) {
      console.error('加载模块列表失败', e)
    }
  }

  const loadFiles = useCallback(async (moduleKey: string) => {
    if (!moduleKey) return
    setLoading(true)
    try {
      const data = await getAlgorithms(moduleKey)
      setFiles(data)
    } catch (e) {
      console.error('加载算法文件失败', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedModule) loadFiles(selectedModule)
  }, [selectedModule, loadFiles])

  const handleUpload = async () => {
    setUploadError('')
    if (!uploadFilename.trim()) { setUploadError('请输入文件名'); return }
    if (!uploadContent.trim()) { setUploadError('请输入文件内容'); return }

    // 自动补全扩展名
    let filename = uploadFilename.trim()
    if (!filename.includes('.')) filename += '.txt'

    setUploading(true)
    try {
      const resp = await uploadAlgorithm(selectedModule, filename, uploadContent.trim())
      if (resp.code === 0) {
        setShowUpload(false)
        setUploadFilename('')
        setUploadContent('')
        loadFiles(selectedModule)
        loadModules() // 刷新计数
      } else {
        setUploadError(resp.message || '上传失败')
      }
    } catch (e: any) {
      setUploadError(e.message || '上传失败')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteAlgorithm(id)
      setDeletingId(null)
      loadFiles(selectedModule)
      loadModules()
    } catch (e) {
      console.error('删除失败', e)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      setUploadFilename(file.name)
      setUploadContent(ev.target?.result as string || '')
    }
    reader.onerror = () => setUploadError('文件读取失败')
    reader.readAsText(file)
  }

  const selectedInfo = MODULE_INFO[selectedModule] || { name: selectedModule, icon: 'mingcute:file-line', color: '#999' }

  return (
    <div className="adm-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <Icon icon="mingcute:code-line" width={28} style={{ color: 'var(--color-primary)' }} />
        <div>
          <h2 style={{ margin: 0 }}>算法文件管理</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--color-neutral-500)', fontSize: 'var(--font-size-l5)' }}>
            上传各模块的算法/规则文件，AI调用时自动检索并优先遵循
          </p>
        </div>
      </div>

      {/* 模块选择标签 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {modules.map((m) => {
          const info = MODULE_INFO[m.key] || { name: m.key, icon: 'mingcute:file-line', color: '#999' }
          const isActive = selectedModule === m.key
          return (
            <button
              key={m.key}
              onClick={() => { setSelectedModule(m.key); setShowUpload(false) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 10, border: isActive ? `2px solid ${info.color}` : '1px solid var(--color-neutral-200)',
                background: isActive ? `${info.color}12` : '#fff',
                cursor: 'pointer', fontWeight: isActive ? 600 : 400,
                color: isActive ? info.color : 'var(--color-neutral-600)',
                transition: 'all 0.2s',
              }}
            >
              <Icon icon={info.icon} width={16} />
              <span style={{ fontSize: 13 }}>{info.name}</span>
              <span style={{
                fontSize: 11, padding: '1px 6px', borderRadius: 10,
                background: isActive ? info.color : 'var(--color-neutral-200)',
                color: isActive ? '#fff' : 'var(--color-neutral-500)',
                minWidth: 18, textAlign: 'center',
              }}>
                {m.file_count}
              </span>
            </button>
          )
        })}
      </div>

      {/* 当前模块标题 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon icon={selectedInfo.icon} width={20} style={{ color: selectedInfo.color }} />
          <span style={{ fontWeight: 600, fontSize: 15 }}>{selectedInfo.name} · 算法文件</span>
          <span style={{ fontSize: 12, color: 'var(--color-neutral-400)' }}>（{files.length}/5）</span>
        </div>
        <button
          className="adm-btn adm-btn--primary adm-btn--sm"
          onClick={() => { setShowUpload(!showUpload); setUploadError('') }}
          disabled={files.length >= 5}
        >
          <Icon icon="mingcute:add-line" width={14} /> 上传文件
        </button>
      </div>

      {/* 上传表单 */}
      {showUpload && (
        <div className="adm-panel" style={{ marginBottom: 20 }}>
          <div className="adm-panel__header">
            <span className="adm-panel__title">上传算法文件到「{selectedInfo.name}」</span>
            <button className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => setShowUpload(false)}>取消</button>
          </div>
          <div style={{ padding: '0 20px 20px' }}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>选择文件（或手动输入内容）</label>
              <input type="file" accept=".txt,.md,.py,.yaml,.yml,.json,.csv,.cfg,.ini,.conf"
                onChange={handleFileSelect}
                style={{ marginBottom: 8 }} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>文件名 *</label>
              <input className="adm-search" style={{ width: '100%', height: 36 }}
                placeholder="如: recruitment-rules-v2.txt"
                value={uploadFilename}
                onChange={(e) => setUploadFilename(e.target.value)} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                文件内容 * <span style={{ color: 'var(--color-neutral-400)', fontWeight: 400 }}>（支持 Markdown / YAML / JSON / Python 等）</span>
              </label>
              <textarea
                className="adm-search"
                style={{ width: '100%', minHeight: 200, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 }}
                placeholder="在此粘贴或输入算法文件内容...&#10;&#10;AI 在回答该模块问题时将优先遵循此文件中的规则。"
                value={uploadContent}
                onChange={(e) => setUploadContent(e.target.value)}
              />
            </div>
            {uploadError && (
              <div style={{ color: 'var(--color-danger)', fontSize: 12, marginBottom: 12 }}>{uploadError}</div>
            )}
            <button className="adm-btn adm-btn--primary" onClick={handleUpload} disabled={uploading}>
              {uploading ? '上传中...' : '确认上传'}
            </button>
          </div>
        </div>
      )}

      {/* 文件列表 */}
      <div className="adm-panel">
        <div className="adm-panel__header">
          <span className="adm-panel__title">已上传文件</span>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-neutral-400)' }}>加载中...</div>
        ) : files.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-neutral-400)', fontSize: 13 }}>
            <Icon icon="mingcute:inbox-line" width={32} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.4 }} />
            暂无算法文件，点击「上传文件」添加
          </div>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>文件名</th>
                  <th style={{ width: '10%' }}>大小</th>
                  <th style={{ width: '30%' }}>内容预览</th>
                  <th style={{ width: '15%' }}>上传时间</th>
                  <th style={{ width: '15%' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 500, fontSize: 13 }}>{f.original_filename}</td>
                    <td style={{ fontSize: 12, color: 'var(--color-neutral-500)' }}>{formatSize(f.file_size)}</td>
                    <td style={{ fontSize: 11, color: 'var(--color-neutral-500)', fontFamily: 'monospace' }}>
                      {f.content_preview}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--color-neutral-400)' }}>{formatTime(f.created_at)}</td>
                    <td>
                      {deletingId === f.id ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="adm-btn adm-btn--danger adm-btn--sm" onClick={() => handleDelete(f.id)}>
                            确认删除
                          </button>
                          <button className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => setDeletingId(null)}>
                            取消
                          </button>
                        </div>
                      ) : (
                        <button className="adm-btn adm-btn--danger adm-btn--sm" onClick={() => setDeletingId(f.id)}>
                          <Icon icon="mingcute:delete-2-line" width={14} /> 删除
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
