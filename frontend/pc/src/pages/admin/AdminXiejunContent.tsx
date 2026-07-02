import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'
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

const MOCK: ContentItem[] = Array.from({ length: 20 }, (_, i) => ({
  id: `xj-${i + 1}`,
  title: `${HR_MODULES[i % 8]} - ${['实操指南', '案例分析', '模板工具', '政策解读', '行业报告'][i % 5]} #${i + 1}`,
  category: HR_MODULES[i % 8],
  author: '安老师',
  status: (['published', 'published', 'draft', 'archived'] as const)[i % 4],
  updated_at: new Date(2026, 5, 20 - i).toISOString().split('T')[0],
  views: Math.floor(Math.random() * 5000),
}))

function getMyRole(): string {
  try { return JSON.parse(localStorage.getItem('rg_user') || '{}').role || '' } catch { return '' }
}

export function AdminXiejunContent() {
  const navigate = useNavigate()
  const [items] = useState<ContentItem[]>(MOCK)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    if (!['superadmin', 'operator'].includes(getMyRole())) { navigate('/', { replace: true }); return }
  }, [navigate])

  const filtered = items.filter((i) => {
    if (categoryFilter && i.category !== categoryFilter) return false
    if (statusFilter && i.status !== statusFilter) return false
    return true
  })

  const STATUS_TAG: Record<string, string> = {
    published: 'adm-tag--active',
    draft: 'adm-tag--pending',
    archived: 'adm-tag--inactive',
  }

  return (
          <div className="adm-page">
        <h2>携君库内容管理</h2>

        <div className="adm-stats">
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">总文档数</div>
            <div className="adm-stat-card__value">{items.length}</div>
          </div>
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">已发布</div>
            <div className="adm-stat-card__value" style={{ color: 'var(--color-success)' }}>{items.filter((i) => i.status === 'published').length}</div>
          </div>
          <div className="adm-stat-card">
            <div className="adm-stat-card__label">总阅读量</div>
            <div className="adm-stat-card__value">{items.reduce((a, b) => a + b.views, 0)}</div>
          </div>
        </div>

        {/* 筛选 */}
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
            <option value="archived">已下架</option>
          </select>
          <div style={{ flex: 1 }} />
          <button className="adm-btn adm-btn--primary adm-btn--sm">
            <Icon icon="mingcute:add-line" width={14} /> 上传文档
          </button>
        </div>

        {/* 表格 */}
        <div className="adm-panel" style={{ overflow: 'hidden' }}>
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
                {filtered.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 500 }}>{item.title}</td>
                    <td><span className="adm-tag adm-tag--primary">{item.category}</span></td>
                    <td>{item.author}</td>
                    <td><span className={`adm-tag ${STATUS_TAG[item.status]}`}>
                      {{ published: '已发布', draft: '草稿', archived: '已下架' }[item.status]}
                    </span></td>
                    <td>{item.views}</td>
                    <td>{item.updated_at}</td>
                    <td>
                      <div className="adm-actions">
                        <button className="adm-btn adm-btn--outline adm-btn--sm">编辑</button>
                        <button className="adm-btn adm-btn--danger adm-btn--sm">下架</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 水印配置面板 */}
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
