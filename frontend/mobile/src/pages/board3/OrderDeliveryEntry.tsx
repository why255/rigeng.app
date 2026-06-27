import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { getProjects, createProject } from '@/api/order-delivery'
import '../pages.css'
import './order-delivery.css'

/** 概览卡片数据 */
interface ProjectStats {
  active: number
  completed: number
  overdue: number
  deliveryRate: number
}

/** 进行中项目 */
interface ActiveProject {
  id: number
  client: string
  name: string
  progress: number
  nodeDots: ('done' | 'active' | 'pending')[]
  currentNode: string
  deadline: string
  teamAvatars: string[]
  teamExtra: number
}

/** 已完成项目 */
interface CompletedProject {
  id: number
  name: string
  date: string
  stars: number
}

/** 待导入方案 */
interface PendingImport {
  id: number
  name: string
  source: string
}

/** M11-P1 交付一笔订单入口 — 概览卡片 + 项目列表 */
export function OrderDeliveryEntry() {
  const navigate = useNavigate()

  // ===== Mock数据（API失败时fallback） =====
  const mockStats: ProjectStats = { active: 2, completed: 1, overdue: 0, deliveryRate: 85 }
  const mockActiveProjects: ActiveProject[] = [
    {
      id: 1, client: '某科技公司', name: '人力资源数字化转型交付项目',
      progress: 85, nodeDots: ['done', 'done', 'done', 'done', 'active', 'pending', 'pending', 'pending', 'pending', 'pending'],
      currentNode: '套改方案确认', deadline: '2026-07-05',
      teamAvatars: ['https://modao.cc/agent-py/media/generated_images/2026-06-22/ff578e5dba3646e0b2dc1a16bde52727.jpg',
        'https://modao.cc/agent-py/media/generated_images/2026-06-22/ff578e5dba3646e0b2dc1a16bde52727.jpg',
        'https://modao.cc/agent-py/media/generated_images/2026-06-22/ff578e5dba3646e0b2dc1a16bde52727.jpg'],
      teamExtra: 2,
    },
    {
      id: 2, client: '华东商贸', name: '薪酬体系优化与落地咨询',
      progress: 30, nodeDots: ['done', 'done', 'active', 'pending', 'pending', 'pending', 'pending', 'pending', 'pending', 'pending'],
      currentNode: '现状调研报告', deadline: '2026-06-30',
      teamAvatars: ['https://modao.cc/agent-py/media/generated_images/2026-06-22/ff578e5dba3646e0b2dc1a16bde52727.jpg',
        'https://modao.cc/agent-py/media/generated_images/2026-06-22/ff578e5dba3646e0b2dc1a16bde52727.jpg'],
      teamExtra: 1,
    },
  ]
  const mockCompletedProjects: CompletedProject[] = [
    { id: 3, name: '某电商企业绩效管理体系搭建', date: '2026-05-20', stars: 5 },
  ]
  const mockPendingImports: PendingImport[] = [
    { id: 1, name: '某科技公司 - A版保守方案', source: '打磨一套产品' },
  ]

  const [stats, setStats] = useState<ProjectStats>(mockStats)
  const [activeProjects, setActiveProjects] = useState<ActiveProject[]>(mockActiveProjects)
  const [completedProjects, setCompletedProjects] = useState<CompletedProject[]>(mockCompletedProjects)
  const [pendingImports, setPendingImports] = useState<PendingImport[]>(mockPendingImports)
  const [, setLoading] = useState(false)

  // ===== 加载真实API数据 =====
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getProjects()
      .then((data) => {
        if (cancelled) return
        const projects = data.projects || []
        const active = projects.filter((p: any) => p.status !== 'completed' && p.status !== 'archived')
        const completed = projects.filter((p: any) => p.status === 'completed' || p.status === 'archived')
        setStats({
          active: active.length,
          completed: completed.length,
          overdue: active.filter((p: any) => p.status === 'overdue').length,
          deliveryRate: projects.length > 0 ? Math.round((completed.length / projects.length) * 100) : 0,
        })
        setActiveProjects(active.map((p: any) => ({
          id: p.id, client: p.client_name || '', name: p.name || p.client_name || '',
          progress: p.progress || 0, nodeDots: (p.node_dots || []),
          currentNode: p.current_node || '', deadline: p.deadline || p.signed_at || '',
          teamAvatars: (p.team_avatars || []).slice(0, 3),
          teamExtra: Math.max(0, (p.team_count || 0) - 3),
        })))
        setCompletedProjects(completed.map((p: any) => ({
          id: p.id, name: p.name || p.client_name || '', date: p.completed_at || p.signed_at || '', stars: p.stars || 0,
        })))
        setPendingImports([])
      })
      .catch(() => {
        // API失败，保持mock数据
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  // ===== 状态 =====
  const [completedOpen, setCompletedOpen] = useState(false)
  const [showNewProjectModal, setShowNewProjectModal] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  // 新建项目表单
  const [newProject, setNewProject] = useState({
    clientName: '', signDate: '', deadline: '', planId: '',
  })

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3000)
  }, [])

  const handleCreateProject = useCallback(async () => {
    if (!newProject.clientName.trim()) {
      showToast('请输入客户名称')
      return
    }
    setLoading(true)
    try {
      await createProject({
        client_name: newProject.clientName.trim(),
        signed_at: newProject.signDate || undefined,
        solution_ref: newProject.planId || undefined,
      })
      setShowNewProjectModal(false)
      setNewProject({ clientName: '', signDate: '', deadline: '', planId: '' })
      showToast('项目创建成功')
      // 刷新列表
      getProjects().then((data) => {
        const projects = data.projects || []
        const active = projects.filter((p: any) => p.status !== 'completed' && p.status !== 'archived')
        const completed = projects.filter((p: any) => p.status === 'completed' || p.status === 'archived')
        setStats({
          active: active.length,
          completed: completed.length,
          overdue: active.filter((p: any) => p.status === 'overdue').length,
          deliveryRate: projects.length > 0 ? Math.round((completed.length / projects.length) * 100) : 0,
        })
        setActiveProjects(active.map((p: any) => ({
          id: p.id, client: p.client_name || '', name: p.name || p.client_name || '',
          progress: p.progress || 0, nodeDots: (p.node_dots || []),
          currentNode: p.current_node || '', deadline: p.deadline || p.signed_at || '',
          teamAvatars: (p.team_avatars || []).slice(0, 3),
          teamExtra: Math.max(0, (p.team_count || 0) - 3),
        })))
        setCompletedProjects(completed.map((p: any) => ({
          id: p.id, name: p.name || p.client_name || '', date: p.completed_at || p.signed_at || '', stars: p.stars || 0,
        })))
      }).catch(() => {})
    } catch {
      showToast('创建失败，请重试')
    } finally {
      setLoading(false)
    }
  }, [newProject, showToast])

  const handleImportPlan = useCallback(async () => {
    const plan = pendingImports[0]
    if (!plan) return
    setLoading(true)
    try {
      await createProject({
        client_name: plan.name,
        solution_ref: String(plan.id),
      })
      showToast('方案已导入，项目已创建')
      // 刷新列表
      getProjects().then((data) => {
        const projects = data.projects || []
        const active = projects.filter((p: any) => p.status !== 'completed' && p.status !== 'archived')
        const completed = projects.filter((p: any) => p.status === 'completed' || p.status === 'archived')
        setStats({
          active: active.length,
          completed: completed.length,
          overdue: active.filter((p: any) => p.status === 'overdue').length,
          deliveryRate: projects.length > 0 ? Math.round((completed.length / projects.length) * 100) : 0,
        })
        setActiveProjects(active.map((p: any) => ({
          id: p.id, client: p.client_name || '', name: p.name || p.client_name || '',
          progress: p.progress || 0, nodeDots: (p.node_dots || []),
          currentNode: p.current_node || '', deadline: p.deadline || p.signed_at || '',
          teamAvatars: (p.team_avatars || []).slice(0, 3),
          teamExtra: Math.max(0, (p.team_count || 0) - 3),
        })))
        setCompletedProjects(completed.map((p: any) => ({
          id: p.id, name: p.name || p.client_name || '', date: p.completed_at || p.signed_at || '', stars: p.stars || 0,
        })))
        setPendingImports([])
      }).catch(() => {})
    } catch {
      showToast('导入失败，请重试')
    } finally {
      setLoading(false)
    }
  }, [pendingImports, showToast])

  return (
    <PageContainer width="dashboard">
      <div data-module="order-delivery">
        {/* 品牌标语 */}
        <p className="od-slogan">日耕朝夕，耕愈工作，耕暖生活</p>
        <h1 className="od-brand-title">事事做到位，信任扎下根</h1>

        {/* 概览卡片 */}
        <div className="od-stat-grid">
          <div className="od-stat-card">
            <div className="od-stat-card__label">进行中</div>
            <div className="od-stat-card__number">{stats.active}</div>
          </div>
          <div className="od-stat-card">
            <div className="od-stat-card__label">已完成</div>
            <div className="od-stat-card__number">{stats.completed}</div>
          </div>
          <div className="od-stat-card od-stat-card--warn">
            <div className="od-stat-card__label">逾期中</div>
            <div className="od-stat-card__number">{stats.overdue}</div>
          </div>
          <div className="od-stat-card od-stat-card--brand">
            <div className="od-stat-card__label">交付率</div>
            <div className="od-stat-card__number">{stats.deliveryRate}%</div>
          </div>
        </div>

        {/* 待导入方案提示 */}
        {pendingImports.length > 0 && (
          <div className="od-import-banner">
            <div className="od-import-banner__info">
              <div className="od-import-banner__icon">💡</div>
              <div>
                <div className="od-import-banner__title">有 {pendingImports.length} 份待导入方案</div>
                <div className="od-import-banner__desc">
                  {pendingImports[0].name} (来自{pendingImports[0].source})
                </div>
              </div>
            </div>
            <button className="od-btn-primary" onClick={handleImportPlan}>
              导入并创建项目
            </button>
          </div>
        )}

        {/* 新建项目按钮 */}
        <div className="od-top-bar" style={{ marginTop: 0, marginBottom: 24 }}>
          <div />
          <button className="od-btn-primary" onClick={() => setShowNewProjectModal(true)}>
            ＋ 新建项目
          </button>
        </div>

        {/* 进行中项目列表 */}
        <div className="od-project-list">
          <div className="od-section-header">
            <div className="od-section-header__dot" />
            <h3 className="od-section-header__title">进行中项目 ({activeProjects.length})</h3>
          </div>

          {activeProjects.map((project) => (
            <div
              key={project.id}
              className="od-project-card"
              onClick={() => navigate(`/m/deliver-order/gantt?projectId=${project.id}`)}
            >
              <div className="od-project-card__header">
                <div>
                  <div className="od-project-card__client">{project.client}</div>
                  <h4 className="od-project-card__name">{project.name}</h4>
                </div>
                <div className="od-project-card__avatars">
                  {project.teamAvatars.map((url, i) => (
                    <img key={i} className="od-project-card__avatar" src={url} alt="" />
                  ))}
                  {project.teamExtra > 0 && (
                    <div className="od-project-card__avatar-more">+{project.teamExtra}</div>
                  )}
                </div>
              </div>

              <div className="od-project-card__progress-row">
                <div className="od-project-card__progress-info">
                  <div className="od-project-card__progress-text">
                    <span className="od-project-card__progress-label">整体进度</span>
                    <span className="od-project-card__progress-pct">{project.progress}%</span>
                  </div>
                  <div className="od-project-card__progress-bar">
                    <div
                      className="od-project-card__progress-fill"
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                </div>
                <div className="od-project-card__mini-gantt">
                  {project.nodeDots.map((status, i) => (
                    <div key={i} className={`od-mini-dot od-mini-dot--${status}`} />
                  ))}
                </div>
              </div>

              <div className="od-project-card__footer">
                <div className="od-project-card__meta">
                  <div className="od-project-card__meta-item">
                    ⏱ 当前节点：<span style={{ color: '#333', fontWeight: 600 }}>{project.currentNode}</span>
                  </div>
                  <span className="od-project-card__meta-label">截止：{project.deadline}</span>
                </div>
                <a
                  className="od-project-card__link"
                  href={`/m/deliver-order/gantt?projectId=${project.id}`}
                  onClick={(e) => { e.stopPropagation(); navigate(`/m/deliver-order/gantt?projectId=${project.id}`) }}
                >
                  进入甘特图 →
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* 已完成项目 */}
        <div>
          <button
            className="od-completed-toggle"
            onClick={() => setCompletedOpen(!completedOpen)}
          >
            <span className={`od-completed-toggle__arrow ${completedOpen ? 'od-completed-toggle__arrow--open' : ''}`}>
              ▶
            </span>
            <span>已完成项目 ({completedProjects.length})</span>
          </button>

          <div className={`od-completed-list ${completedOpen ? '' : 'od-completed-list--hidden'}`}>
            {completedProjects.map((project) => (
              <div key={project.id} className="od-completed-item">
                <div className="od-completed-item__info">
                  <div className="od-completed-item__date">{project.date} 结项</div>
                  <div className="od-completed-item__name">{project.name}</div>
                </div>
                <div className="od-completed-item__stars">
                  {Array.from({ length: project.stars }, (_, i) => (
                    <span key={i}>⭐</span>
                  ))}
                </div>
                <button
                  className="od-btn-outline"
                  onClick={() => navigate('/m/brand-building')}
                >
                  分享至品牌打造
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 小耕IP */}
      <div className="od-ip-fab">耕</div>

      {/* 新建项目弹窗 */}
      {showNewProjectModal && (
        <div className="od-modal-overlay">
          <div className="od-modal-backdrop" onClick={() => setShowNewProjectModal(false)} />
          <div className="od-modal">
            <div className="od-modal__header">
              <h3 className="od-modal__title">新建交付项目</h3>
              <button className="od-modal__close" onClick={() => setShowNewProjectModal(false)}>✕</button>
            </div>
            <div className="od-modal__body">
              <div className="od-form-group">
                <label className="od-form-label">客户名称</label>
                <input
                  className="od-form-input" type="text" placeholder="输入客户名称"
                  value={newProject.clientName}
                  onChange={(e) => setNewProject({ ...newProject, clientName: e.target.value })}
                />
              </div>
              <div className="od-form-row">
                <div className="od-form-group">
                  <label className="od-form-label">签约日期</label>
                  <input
                    className="od-form-input" type="date"
                    value={newProject.signDate}
                    onChange={(e) => setNewProject({ ...newProject, signDate: e.target.value })}
                  />
                </div>
                <div className="od-form-group">
                  <label className="od-form-label">交付期限</label>
                  <input
                    className="od-form-input" type="date"
                    value={newProject.deadline}
                    onChange={(e) => setNewProject({ ...newProject, deadline: e.target.value })}
                  />
                </div>
              </div>
              <div className="od-form-group">
                <label className="od-form-label">关联合同</label>
                <div className="od-form-hint">
                  🔗 点击关联从"拿下一个客户"生成的合同
                </div>
              </div>
              <div className="od-form-group">
                <label className="od-form-label">关联方案</label>
                <select
                  className="od-form-select"
                  value={newProject.planId}
                  onChange={(e) => setNewProject({ ...newProject, planId: e.target.value })}
                >
                  <option value="">选择从"打磨一套产品"导入的方案</option>
                  {pendingImports.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="od-modal__footer">
              <button className="od-btn-ghost" onClick={() => setShowNewProjectModal(false)}>取消</button>
              <button className="od-btn-primary" onClick={handleCreateProject}>创建项目</button>
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
