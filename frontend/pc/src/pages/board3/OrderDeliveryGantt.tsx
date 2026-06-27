import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { PageContainer } from '@/components/layout/AppShell'
import { getGanttNodes, confirmNode, getProgress, getProject } from '@/api/order-delivery'
import '../pages.css'
import './order-delivery.css'

/** 甘特图节点 */
interface GanttNode {
  id: number
  name: string
  status: 'done' | 'overdue' | 'active' | 'pending'
  startDay: number   // 从时间轴起始日偏移的天数
  duration: number
  assignee: string
  assigneeAvatar: string
  deadline: string
  isOverdue: boolean
  deliverables: { name: string; done: boolean }[]
  userConfirmed: boolean
  teacherConfirmed: boolean
}

/** M11-P2 甘特图页 */
export function OrderDeliveryGantt() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('projectId') || '1'

  // ===== Mock数据（API失败时fallback） =====
  const mockNodes: GanttNode[] = [
    {
      id: 1, name: '需求调研', status: 'done', startDay: 0, duration: 5,
      assignee: '苏东坡', assigneeAvatar: 'https://modao.cc/agent-py/media/generated_images/2026-06-22/dcc0ddf85b3d4e42b4489c7acf87c734.jpg',
      deadline: '2026-06-19', isOverdue: false,
      deliverables: [{ name: '1. 需求调研报告.pdf', done: true }, { name: '2. 访谈记录汇总.docx', done: true }],
      userConfirmed: true, teacherConfirmed: true,
    },
    {
      id: 2, name: '系统诊断', status: 'done', startDay: 5, duration: 8,
      assignee: '苏东坡', assigneeAvatar: 'https://modao.cc/agent-py/media/generated_images/2026-06-22/dcc0ddf85b3d4e42b4489c7acf87c734.jpg',
      deadline: '2026-06-14', isOverdue: false,
      deliverables: [{ name: '1. 系统诊断报告.pdf', done: true }, { name: '2. 数据盘点表.xlsx', done: true }],
      userConfirmed: true, teacherConfirmed: true,
    },
    {
      id: 3, name: '套改方案确认', status: 'overdue', startDay: 13, duration: 10,
      assignee: '苏东坡', assigneeAvatar: 'https://modao.cc/agent-py/media/generated_images/2026-06-22/dcc0ddf85b3d4e42b4489c7acf87c734.jpg',
      deadline: '2026-06-19', isOverdue: true,
      deliverables: [
        { name: '1. 岗位套改明细表.xlsx', done: true },
        { name: '2. 薪酬测算模型.pdf', done: true },
      ],
      userConfirmed: true, teacherConfirmed: false,
    },
    {
      id: 4, name: '数据导入', status: 'active', startDay: 17, duration: 7,
      assignee: '安老师', assigneeAvatar: 'https://modao.cc/agent-py/media/generated_images/2026-06-22/ff578e5dba3646e0b2dc1a16bde52727.jpg',
      deadline: '2026-07-02', isOverdue: false,
      deliverables: [{ name: '1. 历史数据导入脚本.sql', done: false }, { name: '2. 数据校验报告.pdf', done: false }],
      userConfirmed: false, teacherConfirmed: false,
    },
    {
      id: 5, name: '灰度测试', status: 'pending', startDay: 24, duration: 8,
      assignee: '项目负责人', assigneeAvatar: 'https://modao.cc/agent-py/media/generated_images/2026-06-22/ff578e5dba3646e0b2dc1a16bde52727.jpg',
      deadline: '2026-07-10', isOverdue: false,
      deliverables: [{ name: '1. 测试计划.docx', done: false }, { name: '2. 测试报告.pdf', done: false }],
      userConfirmed: false, teacherConfirmed: false,
    },
  ]

  const [project, setProject] = useState({ id: 1, name: '人力资源数字化转型交付项目', client: '某科技公司' })
  const [nodes, setNodes] = useState<GanttNode[]>(mockNodes)
  const [, setLoading] = useState(false)
  const [apiProgress, setApiProgress] = useState<{ done_nodes?: number; total_nodes?: number; percent?: number }>({})

  // ===== 加载真实API数据 =====
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    // 并行加载项目信息、甘特图节点、进度
    Promise.all([
      getProject(projectId).then((p: any) => {
        if (!cancelled && p) setProject({ id: p.id || projectId, name: p.name || project.name, client: p.client_name || project.client })
      }).catch(() => {}),
      getGanttNodes(projectId).then((data) => {
        if (cancelled) return
        const apiNodes = data.nodes || []
        if (apiNodes.length > 0) {
          const mapped: any[] = apiNodes.map((n: any, i: number) => ({
            id: n.node_id || i + 1,
            name: n.task_name || '',
            status: n.status === 'completed' ? 'done' : n.status === 'overdue' ? 'overdue' : n.status === 'in_progress' ? 'active' : 'pending',
            startDay: i * 5, duration: n.duration || 5,
            assignee: n.assignee || '',
            assigneeAvatar: n.assignee_avatar || '',
            deadline: n.planned_end || '',
            isOverdue: n.status === 'overdue',
            deliverables: (n.deliverables || []).map((d: any) => ({ name: d.name || d, done: d.done || false })),
            userConfirmed: n.user_confirmed || false,
            teacherConfirmed: n.teacher_confirmed || false,
          }))
          setNodes(mapped)
        }
      }).catch(() => {}),
      getProgress(projectId).then((data: any) => {
        if (!cancelled && data) setApiProgress(data)
      }).catch(() => {}),
    ]).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [projectId])

  // 时间轴日期：2026-06-15 起始
  const timelineStart = useMemo(() => new Date('2026-06-15'), [])
  const totalDays = 21 // 6月15日 ~ 7月5日

  const timelineDays = useMemo(() => {
    const days: { label: string; isToday: boolean; isMonthStart: boolean }[] = []
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(timelineStart)
      d.setDate(d.getDate() + i)
      const label = i === 0 || d.getDate() === 1
        ? `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
        : String(d.getDate())
      const isToday = d.getDate() === 22 && d.getMonth() === 5 // June 22
      const isMonthStart = d.getDate() === 1
      days.push({ label, isToday, isMonthStart: isMonthStart && i !== 0 })
    }
    return days
  }, [timelineStart, totalDays])

  // ===== 状态 =====
  const [selectedNode, setSelectedNode] = useState<GanttNode | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3000)
  }

  // 统计 — 优先使用API数据
  const doneNodes = apiProgress.done_nodes ?? nodes.filter(n => n.status === 'done').length
  const totalNodes = apiProgress.total_nodes ?? nodes.length
  const progress = apiProgress.percent ?? Math.round((doneNodes / totalNodes) * 100)
  const daysUntilDeadline = 15

  return (
    <PageContainer width="dashboard">
      <div data-module="order-delivery">
        {/* 面包屑 */}
        <div className="od-breadcrumb">
          <span>转型升级</span> /{' '}
          <a href="/m/deliver-order" onClick={(e) => { e.preventDefault(); navigate('/m/deliver-order') }}>交付一笔订单</a> /{' '}
          <span className="od-breadcrumb--current">甘特图</span> /{' '}
          <span className="od-breadcrumb--current">{project.client}</span>
        </div>

        {/* 品牌标语 + 项目名 */}
        <p className="od-slogan">日耕朝夕，耕愈工作，耕暖生活</p>
        <h1 className="od-slogan" style={{ marginBottom: 4 }}>事事做到位，信任扎下根</h1>
        <h2 className="od-project-title">{project.name}</h2>

        {/* 逾期横幅 */}
        {nodes.some(n => n.isOverdue) && (
          <div className="od-overdue-banner" style={{ marginTop: 24 }}>
            <div className="od-overdue-banner__info">
              <span className="od-overdue-banner__icon">⚠</span>
              <span>
                节点 <strong>[{nodes.find(n => n.isOverdue)?.name}]</strong> 已逾期 3 天，提醒已发送至：苏东坡、安老师、项目负责人
              </span>
            </div>
            <button className="od-overdue-banner__btn" onClick={() => {
              const overdue = nodes.find(n => n.isOverdue)
              if (overdue) setSelectedNode(overdue)
            }}>
              立即处理
            </button>
          </div>
        )}

        {/* 进度概览 */}
        <div className="od-progress-grid">
          <div className="od-progress-card">
            <div className="od-progress-card__label">整体进度</div>
            <div className="od-progress-card__value">
              {progress}% <span style={{ fontSize: 12, color: '#999', fontWeight: 400 }}>({doneNodes}/{totalNodes} 节点)</span>
            </div>
          </div>
          <div className="od-progress-card">
            <div className="od-progress-card__label">距交付日期</div>
            <div className="od-progress-card__value od-progress-card__value--brand">{daysUntilDeadline} 天</div>
          </div>
          <div className="od-progress-card">
            <div className="od-progress-card__label">项目团队</div>
            <div className="od-progress-card__value">3 人</div>
          </div>
          <div className="od-progress-card od-progress-card--disabled">
            <div className="od-progress-card__label">实际 vs 计划</div>
            <div className="od-progress-card__value">对比分析</div>
            <div className="od-progress-card__badge">即将上线</div>
          </div>
        </div>

        {/* 甘特图 */}
        <div className="od-gantt-container">
          <div className="od-gantt-header">
            <div className="od-gantt-header__name">节点名称</div>
            <div className="od-gantt-header__timeline">
              <div className="od-gantt-header__days">
                {timelineDays.map((day, i) => (
                  <div
                    key={i}
                    className={`od-gantt-header__day${day.isToday ? ' od-gantt-header__day--today' : ''}${day.isMonthStart ? ' od-gantt-header__day--month' : ''}`}
                  >
                    {day.label}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="od-gantt-body">
            {nodes.map((node) => {
              const statusIcon = node.status === 'done' ? '✓' : node.status === 'overdue' ? '⏱' : node.status === 'active' ? '▶' : '○'
              const statusColor = node.status === 'done' ? '#6B8E23' : node.status === 'overdue' ? '#E8A94D' : node.status === 'active' ? '#6B8FBF' : '#D7CCC8'

              return (
                <div key={node.id} className="od-gantt-row">
                  <div className="od-gantt-row__name" style={{ opacity: node.status === 'pending' ? 0.5 : 1 }}>
                    <span style={{ color: statusColor }}>{statusIcon}</span>
                    <span style={{ fontWeight: node.status === 'overdue' ? 700 : 400 }}>{node.name}</span>
                  </div>
                  <div className="od-gantt-row__timeline">
                    <div
                      className={`od-gantt-bar od-gantt-bar--${node.status}`}
                      style={{
                        left: `${node.startDay * 40}px`,
                        width: `${node.duration * 40 - 4}px`,
                      }}
                      onClick={() => node.status === 'overdue' && setSelectedNode(node)}
                    >
                      {node.status === 'done' ? '完成' : node.status === 'overdue' ? '逾期中 - 点击查看' : node.status === 'active' ? '进行中' : '未开始'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 底部导航 */}
        <div className="od-bottom-nav">
          <a
            className="od-bottom-nav__left"
            href="/m/deliver-order"
            onClick={(e) => { e.preventDefault(); navigate('/m/deliver-order') }}
          >
            ← 返回项目列表
          </a>
          <div className="od-bottom-nav__right">
            <button className="od-btn-secondary" onClick={() => showToast('进度报告已导出')}>
              导出进度报告
            </button>
            <a
              className="od-btn-primary"
              href={`/m/deliver-order/issues?projectId=${projectId}`}
              onClick={(e) => { e.preventDefault(); navigate(`/m/deliver-order/issues?projectId=${projectId}`) }}
              style={{ textDecoration: 'none' }}
            >
              查看文档与问题 →
            </a>
          </div>
        </div>
      </div>

      {/* 小耕IP */}
      <div className="od-ip-fab">耕</div>

      {/* 节点详情弹窗 */}
      {selectedNode && (
        <div className="od-modal-overlay">
          <div className="od-modal-backdrop" onClick={() => setSelectedNode(null)} />
          <div className="od-modal">
            <div className="od-modal__header">
              <h3 className="od-modal__title">节点详情</h3>
              <button className="od-modal__close" onClick={() => setSelectedNode(null)}>✕</button>
            </div>
            <div className="od-modal__body">
              <div className="od-node-detail__section">
                <div className="od-node-detail__label">节点名称</div>
                <div className="od-node-detail__value">{selectedNode.name}</div>
              </div>
              <div className="od-node-detail__row">
                <div>
                  <div className="od-node-detail__label">负责人</div>
                  <div className="od-node-detail__person">
                    <img className="od-node-detail__avatar" src={selectedNode.assigneeAvatar} alt="" />
                    <span style={{ fontSize: 14 }}>{selectedNode.assignee}</span>
                  </div>
                </div>
                <div>
                  <div className="od-node-detail__label">截止日期</div>
                  <div className={`od-node-detail__value--overdue`} style={{ fontSize: 14, fontWeight: 700 }}>
                    {selectedNode.deadline} {selectedNode.isOverdue ? '(逾期)' : ''}
                  </div>
                </div>
              </div>
              <div className="od-node-detail__section">
                <div className="od-node-detail__label">交付物状态</div>
                {selectedNode.deliverables.map((d, i) => (
                  <div key={i} className="od-node-detail__deliverable">
                    <span style={{ fontSize: 14 }}>{d.name}</span>
                    <span style={{ color: d.done ? '#6B8E23' : '#D7CCC8' }}>{d.done ? '✓' : '○'}</span>
                  </div>
                ))}
              </div>
              <div className="od-node-detail__confirm">
                <div className={`od-node-detail__confirm-item ${selectedNode.userConfirmed ? 'od-node-detail__confirm-item--done' : 'od-node-detail__confirm-item--pending'}`}>
                  {selectedNode.userConfirmed ? '✓' : '□'} 用户已确认
                </div>
                <div className={`od-node-detail__confirm-item ${selectedNode.teacherConfirmed ? 'od-node-detail__confirm-item--done' : 'od-node-detail__confirm-item--pending'}`}>
                  {selectedNode.teacherConfirmed ? '✓' : '□'} 待老师确认
                </div>
              </div>
            </div>
            <div className="od-modal__footer">
              <button className="od-btn-ghost" onClick={() => {
                if (!selectedNode) return
                confirmNode(projectId, String(selectedNode.id)).then(() => {
                  setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, userConfirmed: true } : n))
                  setSelectedNode(prev => prev ? { ...prev, userConfirmed: true } : null)
                  showToast('节点已确认')
                }).catch(() => showToast('确认失败'))
              }}>确认完成</button>
              <button className="od-btn-primary" onClick={() => setSelectedNode(null)}>关闭</button>
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
