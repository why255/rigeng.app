import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'
import { apiGet, apiPatch, apiDelete } from '../../shared/api/api'
import './admin.css'

const HR_MODULES = [
  '人力资源规划', '招聘与配置', '培训与开发', '绩效管理',
  '薪酬福利管理', '劳动关系管理', '组织发展', '员工关系',
]

interface ContentItem {
  id: string
  title: string
  category: string
  author: string
  status: 'published' | 'draft' | 'archived'
  updated_at: string
  views: number
}

interface Stats {
  total: number
  published: number
  draft: number
  archived: number
  by_category: Record<string, number>
}

function getMyRole(): string {
  try { return JSON.parse(localStorage.getItem('rg_user') || '{}').role || '' } catch { return '' }
}

function getToken(): string | null {
  try { return localStorage.getItem('rg_token') } catch { return null }
}

async function uploadFile(file: File, title?: string): Promise<ContentItem> {
  const formData = new FormData()
  formData.append('file', file)
  if (title) formData.append('title', title)

  const token = getToken()
  const res = await fetch('/api/v1/admin/xiejun/documents/upload', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })

  if (res.status === 401) {
    localStorage.removeItem('rg_token')
    localStorage.removeItem('rg_user')
    window.location.href = '/login'
    throw new Error('未登录')
  }

  const json = await res.json()
  if (json.code !== 0) {
    throw new Error(json.message || '上传失败')
  }
  return json.data as ContentItem
}

export function AdminXiejunContent() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [items, setItems] = useState<ContentItem[]>([])
  const [stats, setStats] = useState<Stats>({ total: 0, published: 0, draft: 0, archived: 0, by_category: {} })
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  // 拉取文档列表
  const fetchDocuments = useCallback(async () => {
    try {
      const params: Record<string, string> = {}
      if (categoryFilter) params.category = categoryFilter
      if (statusFilter) params.status = statusFilter
      const data = await apiGet<{ items: ContentItem[]; total: number }>('/admin/xiejun/documents', params)
      setItems(data.items || [])
    } catch (e: any) {
      setError(e.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [categoryFilter, statusFilter])

  // 拉取统计
  const fetchStats = useCallback(async () => {
    try {
      const data = await apiGet<Stats>('/admin/xiejun/stats')
      setStats(data)
    } catch {
      // 统计加载失败不阻塞
    }
  }, [])

  useEffect(() => {
    if (!['superadmin', 'operator'].includes(getMyRole())) { navigate('/', { replace: true }); return }
  }, [navigate])

  useEffect(() => {
    fetchDocuments()
    fetchStats()
  }, [fetchDocuments, fetchStats])

  // 处理文件上传
  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 校验文件大小 (50MB)
    if (file.size > 50 * 1024 * 1024) {
      setError('文件大小不能超过 50MB')
      return
    }

    setUploading(true)
    setError('')
    try {
      const doc = await uploadFile(file)
      setUploading(false)
      // 重置 input 以便可以重新选择同一文件
      if (fileInputRef.current) fileInputRef.current.value = ''
      // 刷新列表和统计
      await fetchDocuments()
      await fetchStats()
    } catch (e: any) {
      setError(e.message || '上传失败')
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // 更新文档状态
  const handleStatusChange = async (docId: string, newStatus: string) => {
    try {
      await apiPatch(`/admin/xiejun/documents/${docId}`, { status: newStatus })
      fetchDocuments()
      fetchStats()
    } catch (e: any) {
      setError(e.message || '操作失败')
    }
  }

  // 删除文档
  const handleDelete = async (docId: string) => {
    if (!confirm('确定要删除该文档吗？')) return
    try {
      await apiDelete(`/admin/xiejun/documents/${docId}`)
      fetchDocuments()
      fetchStats()
    } catch (e: any) {
      setError(e.message || '删除失败')
    }
  }

  const STATUS_TAG: Record<string, string> = {
    published: 'adm-tag--active',
    draft: 'adm-tag--pending',
    recycled: 'adm-tag--inactive',
    archived: 'adm-tag--inactive',
  }

  const STATUS_LABEL: Record<string, string> = {
    published: '已发布',
    draft: '草稿',
    recycled: '已下架',
    archived: '已下架',
  }

  return (
    <div className="adm-page">
      <h2>携君库内容管理</h2>

      {/* 统计卡片 */}
      <div className="adm-stats">
        <div className="adm-stat-card">
          <div className="adm-stat-card__label">总文档数</div>
          <div className="adm-stat-card__value">{stats.total}</div>
        </div>
        <div className="adm-stat-card">
          <div className="adm-stat-card__label">已发布</div>
          <div className="adm-stat-card__value" style={{ color: 'var(--color-success)' }}>{stats.published}</div>
        </div>
        <div className="adm-stat-card">
          <div className="adm-stat-card__label">草稿</div>
          <div className="adm-stat-card__value" style={{ color: 'var(--color-warning)' }}>{stats.draft}</div>
        </div>
        <div className="adm-stat-card">
          <div className="adm-stat-card__label">已下架</div>
          <div className="adm-stat-card__value" style={{ color: 'var(--color-error)' }}>{stats.archived}</div>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="adm-panel" style={{ marginBottom: 16, background: '#FFF3F3', border: '1px solid #FFCDD2' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#D32F2F', fontSize: 14 }}>
            <Icon icon="mingcute:alert-line" width={16} />
            <span style={{ flex: 1 }}>{error}</span>
            <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#D32F2F' }}>
              <Icon icon="mingcute:close-line" width={16} />
            </button>
          </div>
        </div>
      )}

      {/* 筛选 + 上传 */}
      <div className="adm-toolbar">
        <select className="adm-search" style={{ width: 150 }} value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">全部分类</option>
          {HR_MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select className="adm-search" style={{ width: 120 }} value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">全部状态</option>
          <option value="published">已发布</option>
          <option value="draft">草稿</option>
          <option value="recycled">已下架</option>
        </select>
        <div style={{ flex: 1 }} />

        {/* 隐藏的文件选择器 */}
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.csv,.png,.jpg,.jpeg,.gif"
          onChange={handleFileChange}
        />

        <button
          className="adm-btn adm-btn--primary adm-btn--sm"
          onClick={handleUploadClick}
          disabled={uploading}
        >
          <Icon icon={uploading ? 'mingcute:loading-line' : 'mingcute:add-line'} width={14} />
          {uploading ? ' 上传中...' : ' 上传文档'}
        </button>
      </div>

      {/* 文档表格 */}
      <div className="adm-panel" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-secondary)' }}>
            <Icon icon="mingcute:loading-line" width={24} style={{ animation: 'spin 1s linear infinite' }} />
            <p>加载中...</p>
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-secondary)' }}>
            <Icon icon="mingcute:inbox-line" width={48} style={{ opacity: 0.3 }} />
            <p>暂无文档，点击右上角"上传文档"添加</p>
          </div>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>标题</th>
                  <th>分类</th>
                  <th>作者</th>
                  <th>状态</th>
                  <th>阅读量</th>
                  <th>更新时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 500 }}>{item.title}</td>
                    <td><span className="adm-tag adm-tag--primary">{item.category}</span></td>
                    <td>{item.author || '安老师'}</td>
                    <td><span className={`adm-tag ${STATUS_TAG[item.status] || 'adm-tag--pending'}`}>
                      {STATUS_LABEL[item.status] || item.status}
                    </span></td>
                    <td>{item.views}</td>
                    <td>{item.updated_at ? item.updated_at.slice(0, 10) : '-'}</td>
                    <td>
                      <div className="adm-actions">
                        {item.status === 'published' ? (
                          <button
                            className="adm-btn adm-btn--danger adm-btn--sm"
                            onClick={() => handleStatusChange(item.id, 'recycled')}
                          >
                            下架
                          </button>
                        ) : item.status === 'recycled' || item.status === 'archived' ? (
                          <button
                            className="adm-btn adm-btn--outline adm-btn--sm"
                            onClick={() => handleStatusChange(item.id, 'published')}
                          >
                            重新发布
                          </button>
                        ) : (
                          <button
                            className="adm-btn adm-btn--outline adm-btn--sm"
                            onClick={() => handleStatusChange(item.id, 'published')}
                          >
                            发布
                          </button>
                        )}
                        <button
                          className="adm-btn adm-btn--danger adm-btn--sm"
                          onClick={() => handleDelete(item.id)}
                          style={{ marginLeft: 4 }}
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 携君库保护配置 */}
      <div className="adm-panel">
        <div className="adm-panel__header">
          <span className="adm-panel__title">携君库保护配置</span>
        </div>
        <div className="adm-panel__body">
          <div className="adm-form-group">
            <label>水印配置</label>
            <select defaultValue="enabled">
              <option value="enabled">开启水印</option>
              <option value="disabled">关闭水印</option>
            </select>
            <div className="adm-form-hint">文档自动添加用户ID水印</div>
          </div>
          <div className="adm-form-group">
            <label>溯源标记</label>
            <select defaultValue="enabled">
              <option value="enabled">开启溯源标记</option>
              <option value="disabled">关闭溯源标记</option>
            </select>
            <div className="adm-form-hint">下载文档嵌入不可见溯源标记</div>
          </div>
          <div className="adm-form-group">
            <label>复制限制</label>
            <select defaultValue="500">
              <option value="500">单次最多复制 500 字</option>
              <option value="1000">单次最多复制 1000 字</option>
              <option value="0">禁止复制</option>
            </select>
            <div className="adm-form-hint">限制用户单次复制字数</div>
          </div>
          <button className="adm-btn adm-btn--primary">保存配置</button>
        </div>
      </div>
    </div>
  )
}
