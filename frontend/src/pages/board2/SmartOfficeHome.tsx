import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { getDrafts } from '@/api/smart-office'
import type { DraftItem } from '@/api/smart-office'
import { recentDocs } from '@/data/mock'
import { MAIN_SLOGAN } from '@/data/modules'
import '../pages.css'
import './smart-office.css'

/** M6-P1 智能办公首页 — 双库入口卡片 + 最近文档列表 */
export function SmartOfficeHome() {
  const navigate = useNavigate()
  const [drafts, setDrafts] = useState<DraftItem[]>([])
  const [docs] = useState(recentDocs)

  useEffect(() => {
    getDrafts().then((d) => { if (d?.drafts) setDrafts(d.drafts) }).catch(() => {})
  }, [])

  return (
    <PageContainer width="dashboard">
      <div data-module="smart-office">
        {/* 品牌标语 */}
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 17, fontWeight: 700, color: '#333' }}>{MAIN_SLOGAN}</span>
        </div>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#333' }}>告别碎片化，高效又专业</h1>
        </div>

        {/* 双库入口卡片 */}
        <div className="so-entry-cards" style={{ marginBottom: 32 }}>
          <div className="so-entry-card">
            <div className="so-entry-card__header">
              <div className="so-entry-card__icon" style={{ backgroundColor: 'rgba(192,58,57,0.1)' }}>
                🔧
              </div>
              <div>
                <h2 className="so-entry-card__title">工具库</h2>
                <p className="so-entry-card__subtitle">按需生成文档，即用即走</p>
              </div>
            </div>
            <p className="so-entry-card__desc">
              包含招聘、培训、薪酬等八大HR模块常用文档模板，智能引导填充，一键生成专业方案。
            </p>
            <a className="so-entry-card__btn so-entry-card__btn--primary" onClick={() => navigate('/m/smart-office/work')}>
              进入工具库
            </a>
          </div>

          <div className="so-entry-card">
            <div className="so-entry-card__header">
              <div className="so-entry-card__icon" style={{ backgroundColor: 'rgba(232,169,77,0.1)' }}>
                🔀
              </div>
              <div>
                <h2 className="so-entry-card__title">体系库</h2>
                <p className="so-entry-card__subtitle">战略解码→模块搭建，六步闭环</p>
              </div>
            </div>
            <p className="so-entry-card__desc">
              从公司战略出发，通过六步法构建完整的人力资源管理体系，确保组织目标达成与人才发展。
            </p>
            <a className="so-entry-card__btn so-entry-card__btn--secondary" onClick={() => navigate('/m/smart-office/system')}>
              进入体系库
            </a>
          </div>
        </div>

        {/* 最近文档列表 */}
        <div>
          <div className="so-section-title">
            <h3 className="so-section-title__label">最近文档</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span className="so-draft-badge">📝 {drafts.length > 0 ? drafts.length : 3} 篇草稿</span>
              <a style={{ fontSize: 14, color: 'var(--color-neutral-500)', cursor: 'pointer' }}>查看全部</a>
            </div>
          </div>
          <div className="so-doc-list">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="so-doc-item"
                onClick={() => navigate(`/m/smart-office/editor?id=${doc.id}`)}
              >
                <div className="so-doc-item__left">
                  <span className="so-doc-item__icon" style={{ color: doc.type === 'pdf' ? '#F44336' : '#2196F3' }}>
                    {doc.type === 'pdf' ? '📕' : '📄'}
                  </span>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="so-doc-item__title">{doc.title}</span>
                      <span className="so-doc-item__tag">{doc.categoryLabel}</span>
                    </div>
                    <span className="so-doc-item__meta">更新于 {doc.updated}</span>
                  </div>
                </div>
                <div className="so-doc-item__right">
                  {doc.status === 'draft' ? (
                    <span className="so-status-draft">草稿</span>
                  ) : (
                    <span className="so-status-done">✅</span>
                  )}
                  <span style={{ color: 'var(--color-neutral-300)' }}>›</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
