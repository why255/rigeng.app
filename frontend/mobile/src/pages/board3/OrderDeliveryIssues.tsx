import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { getIssues, createIssue, updateIssueStatus, getIssueRecommendations, getDocuments, archiveProject } from '@/api/order-delivery'
import '../pages.css'
import './order-delivery.css'

/** 文档阶段 */
type DocStage = 'all' | '需求' | '方案' | '实施' | '验收'

/** 文档条目 */
interface Document {
  id: number
  name: string
  stage: DocStage | 'all'
  size: string
  date: string
  icon: string
  iconColor: string
}

/** 问题条目 */
interface Issue {
  id: number
  title: string
  status: 'pending' | 'active' | 'resolved'
  priority: 'high' | 'mid' | 'low'
  relatedNode?: string
  assignee?: string
  createdAt?: string
  hasRecommendation?: boolean
}

/** M11-P3 文档与问题追踪页 */
export function OrderDeliveryIssues() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('projectId') || '1'

  const [project] = useState({ id: 1, name: '人力资源数字化转型交付项目', client: '某科技公司' })

  // ===== Mock数据（API失败时fallback） =====
  const mockDocuments: Document[] = [
    { id: 1, name: '某科技公司调研访谈录.pdf', stage: '需求', size: '1.2 MB', date: '2026-06-15', icon: '📄', iconColor: '#C03A39' },
    { id: 2, name: '人力资源数字化转型方案-V2.docx', stage: '方案', size: '4.5 MB', date: '2026-06-18', icon: '📝', iconColor: '#6B8FBF' },
    { id: 3, name: '岗位套改明细表.xlsx', stage: '方案', size: '856 KB', date: '2026-06-20', icon: '📊', iconColor: '#6B8E23' },
  ]

  const mockIssues: Issue[] = [
    {
      id: 1, title: '销售部对提成套改方案有异议', status: 'pending', priority: 'high',
      relatedNode: '套改方案确认', hasRecommendation: true,
    },
    {
      id: 2, title: '历史数据导入格式不统一', status: 'pending', priority: 'mid',
      relatedNode: '数据导入',
    },
    {
      id: 3, title: '系统权限分配逻辑调整', status: 'active', priority: 'mid',
      assignee: '安老师', createdAt: '昨天',
    },
    {
      id: 4, title: '调研名单缺失补充', status: 'resolved', priority: 'low',
    },
  ]

  const [documents, setDocuments] = useState<Document[]>(mockDocuments)
  const [issues, setIssues] = useState<Issue[]>(mockIssues)
  const [, setLoading] = useState(false)

  // ===== 加载真实API数据 =====
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      // 加载文档
      getDocuments(projectId).then((data) => {
        if (cancelled) return
        const docs = data.documents || []
        if (docs.length > 0) {
          const stageMapIcons: Record<string, { icon: string; color: string }> = {
            '需求': { icon: '📄', color: '#C03A39' },
            '方案': { icon: '📝', color: '#6B8FBF' },
            '实施': { icon: '📊', color: '#6B8E23' },
            '验收': { icon: '📋', color: '#C03A39' },
          }
          setDocuments(docs.map((d: any) => {
            const style = stageMapIcons[d.stage || ''] || { icon: '📄', color: '#D7CCC8' }
            return {
              id: d.doc_id || d.id,
              name: d.filename || d.name || '',
              stage: d.stage || 'all',
              size: d.size || '',
              date: d.uploaded_at || d.date || '',
              icon: style.icon,
              iconColor: style.color,
            }
          }))
        }
      }).catch(() => {}),
      // 加载问题
      getIssues(projectId).then((data) => {
        if (cancelled) return
        const allIssues: Issue[] = [
          ...(data.todo || []).map((i: any) => ({ id: i.issue_id, title: i.title, status: 'pending' as const, priority: i.priority || 'mid', relatedNode: i.related_node, hasRecommendation: i.has_recommendation })),
          ...(data.in_progress || []).map((i: any) => ({ id: i.issue_id, title: i.title, status: 'active' as const, priority: i.priority || 'mid', assignee: i.assignee, relatedNode: i.related_node })),
          ...(data.resolved || []).map((i: any) => ({ id: i.issue_id, title: i.title, status: 'resolved' as const, priority: i.priority || 'low' })),
        ]
        if (allIssues.length > 0) setIssues(allIssues)
      }).catch(() => {}),
    ]).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [projectId])

  // ===== 状态 =====
  const [docFilter, setDocFilter] = useState<DocStage>('all')
  const [showIssueModal, setShowIssueModal] = useState(false)
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [shareBrand, setShareBrand] = useState(true)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const [newIssue, setNewIssue] = useState({
    title: '', description: '', priority: '中', relatedNode: '',
  })

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3000)
  }

  const handleCreateIssue = async () => {
    if (!newIssue.title.trim()) {
      showToast('请输入问题标题')
      return
    }
    setLoading(true)
    try {
      const priorityMap: Record<string, string> = { '高': 'high', '中': 'mid', '低': 'low' }
      await createIssue(projectId, {
        title: newIssue.title.trim(),
        description: newIssue.description || undefined,
        priority: priorityMap[newIssue.priority] || 'mid',
      })
      setShowIssueModal(false)
      setNewIssue({ title: '', description: '', priority: '中', relatedNode: '' })
      showToast('问题已创建')
      // 刷新问题列表
      getIssues(projectId).then((data) => {
        const allIssues: Issue[] = [
          ...(data.todo || []).map((i: any) => ({ id: i.issue_id, title: i.title, status: 'pending' as const, priority: i.priority || 'mid', relatedNode: i.related_node, hasRecommendation: i.has_recommendation })),
          ...(data.in_progress || []).map((i: any) => ({ id: i.issue_id, title: i.title, status: 'active' as const, priority: i.priority || 'mid', assignee: i.assignee, relatedNode: i.related_node })),
          ...(data.resolved || []).map((i: any) => ({ id: i.issue_id, title: i.title, status: 'resolved' as const, priority: i.priority || 'low' })),
        ]
        if (allIssues.length > 0) setIssues(allIssues)
      }).catch(() => {})
    } catch {
      showToast('创建失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleArchive = async () => {
    setLoading(true)
    try {
      await archiveProject(projectId)
      setShowArchiveModal(false)
      showToast('项目已归档 ✨')
      setTimeout(() => navigate('/m/deliver-order'), 2000)
    } catch {
      setShowArchiveModal(false)
      showToast('归档失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteIssue = async (issueId: number) => {
    try {
      await updateIssueStatus(projectId, String(issueId), { status: 'resolved' })
      setIssues(prev => prev.map(i => i.id === issueId ? { ...i, status: 'resolved' as const } : i))
      showToast('问题已归档')
    } catch {
      showToast('操作失败')
    }
  }

  const [recommendations, setRecommendations] = useState<string[]>([])
  const [showRecommendationModal, setShowRecommendationModal] = useState(false)

  const handleShowRecommendations = async () => {
    try {
      const data: any = await getIssueRecommendations(projectId)
      const recs = data.recommendations || data.suggestions || []
      setRecommendations(typeof recs === 'string' ? [recs] : recs)
      setShowRecommendationModal(true)
    } catch {
      showToast('获取推荐方案失败')
    }
  }

  // 筛选文档
  const filteredDocs = docFilter === 'all' ? documents : documents.filter(d => d.stage === docFilter)
  const stages: DocStage[] = ['all', '需求', '方案', '实施', '验收']
  const stageLabels: Record<DocStage, string> = { all: '全部', '需求': '需求', '方案': '方案', '实施': '实施', '验收': '验收' }

  // 筛选问题
  const pendingIssues = issues.filter(i => i.status === 'pending')
  const activeIssues = issues.filter(i => i.status === 'active')
  const resolvedIssues = issues.filter(i => i.status === 'resolved')

  // 按阶段分组文档
  const groupedDocs = new Map<string, Document[]>()
  for (const doc of filteredDocs) {
    const key = doc.stage
    if (!groupedDocs.has(key)) groupedDocs.set(key, [])
    groupedDocs.get(key)!.push(doc)
  }

  return (
    <PageContainer width="dashboard">
      <div data-module="order-delivery">
        {/* 面包屑 */}
        <div className="od-breadcrumb">
          <span>转型升级</span> /{' '}
          <a href="/m/deliver-order" onClick={(e) => { e.preventDefault(); navigate('/m/deliver-order') }}>交付一笔订单</a> /{' '}
          <span className="od-breadcrumb--current">文档与问题追踪</span> /{' '}
          <span className="od-breadcrumb--current">{project.client}</span>
        </div>

        {/* 品牌标语 */}
        <p className="od-slogan">日耕朝夕，耕愈工作，耕暖生活</p>
        <h1 className="od-slogan" style={{ marginBottom: 4 }}>事事做到位，信任扎下根</h1>
        <h2 className="od-page-title">文档与问题追踪</h2>

        {/* 双栏布局 */}
        <div className="od-docs-layout" style={{ marginTop: 24 }}>
          {/* 左侧：文档管理 */}
          <div className="od-docs-panel">
            <div className="od-panel-header">
              <h3 className="od-panel-header__title">📁 交付文档库</h3>
              <button className="od-panel-header__action" onClick={() => showToast('文档上传功能开发中')}>
                ⬆ 上传文档
              </button>
            </div>
            {/* 阶段筛选Tabs */}
            <div className="od-tabs">
              {stages.map((stage) => (
                <button
                  key={stage}
                  className={`od-tab ${docFilter === stage ? 'od-tab--active' : ''}`}
                  onClick={() => setDocFilter(stage)}
                >
                  {stageLabels[stage]}
                </button>
              ))}
            </div>
            {/* 文档列表 */}
            <div>
              {filteredDocs.length === 0 ? (
                <div className="od-doc-empty">
                  <div className="od-doc-empty__icon">📋</div>
                  <div className="od-doc-empty__text">暂无文档，上传第一份交付物吧</div>
                </div>
              ) : (
                <>
                  {Array.from(groupedDocs.entries()).map(([stage, docs]) => (
                    <div key={stage}>
                      <div className="od-doc-stage-label">{stage}阶段</div>
                      {docs.map((doc) => (
                        <div key={doc.id} className="od-doc-item">
                          <div className="od-doc-item__info">
                            <span className="od-doc-item__icon" style={{ color: doc.iconColor }}>{doc.icon}</span>
                            <div>
                              <div className="od-doc-item__name">{doc.name}</div>
                              <div className="od-doc-item__meta">{doc.size} · {doc.date} 上传</div>
                            </div>
                          </div>
                          <div className="od-doc-item__actions">
                            <button className="od-doc-item__action-btn" title="预览">👁</button>
                            <button className="od-doc-item__action-btn" title="下载">⬇</button>
                            <button className="od-doc-item__action-btn od-doc-item__action-btn--disabled" title="版本历史">🔒</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                  {/* 实施阶段空态 */}
                  {!filteredDocs.some(d => d.stage === '实施') && docFilter === 'all' && (
                    <div>
                      <div className="od-doc-stage-label">实施阶段</div>
                      <div className="od-doc-empty">
                        <div className="od-doc-empty__icon">📋</div>
                        <div className="od-doc-empty__text">暂无文档，上传第一份交付物吧</div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 右侧：问题追踪 */}
          <div className="od-issues-panel">
            <div className="od-panel-header">
              <h3 className="od-panel-header__title">🐛 问题追踪看板</h3>
              <button
                className="od-panel-header__action"
                onClick={() => setShowIssueModal(true)}
                style={{ width: 28, height: 28, borderRadius: '50%', background: '#C03A39', color: 'white', justifyContent: 'center', fontSize: 16, textDecoration: 'none' }}
              >
                ＋
              </button>
            </div>
            <div className="od-issues-body">
              {/* 待解决 */}
              <div className="od-issue-group">
                <div className="od-issue-group__header">
                  <div className="od-issue-group__dot od-issue-group__dot--pending" />
                  <span className="od-issue-group__label">待解决 ({pendingIssues.length})</span>
                </div>
                {pendingIssues.map((issue) => (
                  <div key={issue.id} className="od-issue-card">
                    <div className="od-issue-card__header">
                      <span className={`od-issue-badge ${issue.priority === 'high' ? 'od-issue-badge--high' : 'od-issue-badge--mid'}`}>
                        {issue.priority === 'high' ? '高优先级' : '中优先级'}
                      </span>
                      <button className="od-issue-card__delete-btn" onClick={(e) => { e.stopPropagation(); handleDeleteIssue(issue.id) }}>🗑</button>
                    </div>
                    <div className="od-issue-card__title">{issue.title}</div>
                    <div className="od-issue-card__meta">
                      <span>关联：{issue.relatedNode}</span>
                      {issue.hasRecommendation && (
                        <a className="od-issue-card__link" href="#" onClick={(e) => { e.preventDefault(); handleShowRecommendations() }}>
                          💡 查看推荐方案
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* 处理中 */}
              <div className="od-issue-group">
                <div className="od-issue-group__header">
                  <div className="od-issue-group__dot od-issue-group__dot--active" />
                  <span className="od-issue-group__label">处理中 ({activeIssues.length})</span>
                </div>
                {activeIssues.map((issue) => (
                  <div key={issue.id} className="od-issue-card od-issue-card--active">
                    <div className="od-issue-card__title">{issue.title}</div>
                    <div className="od-issue-card__meta">
                      <span>负责人：{issue.assignee} · {issue.createdAt}创建</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* 已解决 */}
              <div className="od-issue-group">
                <div className="od-issue-group__header">
                  <div className="od-issue-group__dot od-issue-group__dot--resolved" />
                  <span className="od-issue-group__label">已解决 ({resolvedIssues.length})</span>
                </div>
                {resolvedIssues.map((issue) => (
                  <div key={issue.id} className="od-issue-card od-issue-card--resolved">
                    <div className="od-issue-card__title od-issue-card__title--resolved">{issue.title}</div>
                    <div className="od-issue-card__meta">
                      <span>已归档至私有库</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 底部操作 */}
        <div className="od-bottom-nav">
          <a
            className="od-bottom-nav__left"
            href={`/m/deliver-order/gantt?projectId=${projectId}`}
            onClick={(e) => { e.preventDefault(); navigate(`/m/deliver-order/gantt?projectId=${projectId}`) }}
          >
            ← 返回甘特图
          </a>
          <div className="od-bottom-nav__right">
            <button className="od-btn-secondary" onClick={() => setShowIssueModal(true)}>
              ＋ 创建新问题
            </button>
            <button className="od-btn-success" onClick={() => setShowArchiveModal(true)}>
              完成项目 🎉
            </button>
          </div>
        </div>
      </div>

      {/* 小耕IP */}
      <div className="od-ip-fab">耕</div>

      {/* 创建问题弹窗 */}
      {showIssueModal && (
        <div className="od-modal-overlay">
          <div className="od-modal-backdrop" onClick={() => setShowIssueModal(false)} />
          <div className="od-modal">
            <div className="od-modal__header">
              <h3 className="od-modal__title">创建新问题</h3>
              <button className="od-modal__close" onClick={() => setShowIssueModal(false)}>✕</button>
            </div>
            <div className="od-modal__body">
              <div className="od-form-group">
                <label className="od-form-label">问题标题</label>
                <input
                  className="od-form-input" type="text" placeholder="简述遇到的问题"
                  value={newIssue.title}
                  onChange={(e) => setNewIssue({ ...newIssue, title: e.target.value })}
                />
              </div>
              <div className="od-form-group">
                <label className="od-form-label">详细描述</label>
                <textarea
                  className="od-form-textarea" placeholder="补充更多细节..." rows={3}
                  value={newIssue.description}
                  onChange={(e) => setNewIssue({ ...newIssue, description: e.target.value })}
                />
              </div>
              <div className="od-form-row">
                <div className="od-form-group">
                  <label className="od-form-label">优先级</label>
                  <select
                    className="od-form-select"
                    value={newIssue.priority}
                    onChange={(e) => setNewIssue({ ...newIssue, priority: e.target.value })}
                  >
                    <option>高</option>
                    <option>中</option>
                    <option>低</option>
                  </select>
                </div>
                <div className="od-form-group">
                  <label className="od-form-label">关联节点</label>
                  <select
                    className="od-form-select"
                    value={newIssue.relatedNode}
                    onChange={(e) => setNewIssue({ ...newIssue, relatedNode: e.target.value })}
                  >
                    <option value="">选择关联节点</option>
                    <option>系统诊断</option>
                    <option>套改方案确认</option>
                    <option>数据导入</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="od-modal__footer">
              <button className="od-btn-ghost" onClick={() => setShowIssueModal(false)}>取消</button>
              <button className="od-btn-primary" onClick={handleCreateIssue}>创建</button>
            </div>
          </div>
        </div>
      )}

      {/* 归档确认弹窗 */}
      {showArchiveModal && (
        <div className="od-modal-overlay">
          <div className="od-modal-backdrop" onClick={() => setShowArchiveModal(false)} />
          <div className="od-modal" style={{ maxWidth: 440 }}>
            <div className="od-modal__body" style={{ textAlign: 'center' }}>
              <div className="od-archive-icon">🎉</div>
              <h3 className="od-archive-title">归档确认</h3>
              <p className="od-archive-desc">归档后项目将移至完成列表，相关文档将同步进入您的智库（M12）。</p>
              <div className="od-archive-option">
                <label className="od-checkbox-label">
                  <input
                    type="checkbox" className="od-checkbox"
                    checked={shareBrand}
                    onChange={(e) => setShareBrand(e.target.checked)}
                  />
                  <div>
                    <div className="od-checkbox-label__title">同步分享至品牌案例</div>
                    <div className="od-checkbox-label__desc">勾选后，该项目将作为优秀案例反哺至"品牌打造中心"</div>
                  </div>
                </label>
              </div>
              <div className="od-archive-actions">
                <button className="od-archive-actions__cancel" onClick={() => setShowArchiveModal(false)}>
                  再等一下
                </button>
                <button className="od-archive-actions__confirm" onClick={handleArchive}>
                  确认归档
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 推荐方案弹窗 */}
      {showRecommendationModal && (
        <div className="od-modal-overlay">
          <div className="od-modal-backdrop" onClick={() => setShowRecommendationModal(false)} />
          <div className="od-modal" style={{ maxWidth: 440 }}>
            <div className="od-modal__header">
              <h3 className="od-modal__title">💡 AI 推荐方案</h3>
              <button className="od-modal__close" onClick={() => setShowRecommendationModal(false)}>✕</button>
            </div>
            <div className="od-modal__body">
              {recommendations.length === 0 ? (
                <p style={{ color: '#999', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>暂无推荐方案</p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {recommendations.map((rec, i) => (
                    <li key={i} style={{ padding: '12px 0', borderBottom: '1px solid #eee', fontSize: 14, lineHeight: 1.6 }}>
                      {typeof rec === 'string' ? rec : JSON.stringify(rec)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="od-modal__footer">
              <button className="od-btn-primary" onClick={() => setShowRecommendationModal(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMsg && (
        <div className="od-toast">
          <span className="od-toast__icon">✓</span>
          <span>{toastMsg}</span>
        </div>
      )}
    </PageContainer>
  )
}
