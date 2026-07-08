import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'
import './admin.css'

function getMyRole(): string {
  try { return JSON.parse(localStorage.getItem('rg_user') || '{}').role || '' } catch { return '' }
}

type TemplateCategory = 'positive' | 'negative' | 'greeting' | 'system'

interface Template {
  id: string
  category: TemplateCategory
  title: string
  content: string
  trigger_condition: string
  is_active: boolean
}

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  positive: '正向激励',
  negative: '反向关怀',
  greeting: '问候语',
  system: '系统通知',
}

const MOCK_TEMPLATES: Template[] = [
  { id: 'p1', category: 'positive', title: '计划完成率≥80%', content: '恭喜！今日计划完成率达到 {rate}%，保持这个好状态，每一步都在为你的未来铺路。', trigger_condition: '日计划完成率≥80%', is_active: true },
  { id: 'p2', category: 'positive', title: '首单签约', content: '太厉害了！你刚刚签下了第一笔订单 {order_name}，这是你转型路上的一座里程碑！', trigger_condition: '首次订单签约', is_active: true },
  { id: 'p3', category: 'positive', title: '项目完美交付', content: '项目 {project_name} 已完美交付，客户满意度 {satisfaction}%。深耕专业，收获信任。', trigger_condition: '项目交付+满意度≥90%', is_active: true },
  { id: 'p4', category: 'positive', title: '朋友圈50+赞', content: '你的朋友圈内容获得了 {likes} 个赞！高质量的内容就是你的名片。', trigger_condition: '朋友圈点赞≥50', is_active: false },
  { id: 'n1', category: 'negative', title: '连续3天完成率<60%', content: '最近3天的计划完成率有所下降，是不是遇到了什么阻碍？小耕随时在这里听你聊聊。', trigger_condition: '连续3天<60%', is_active: true },
  { id: 'n2', category: 'negative', title: '连续2周完成率<60%', content: '两周了，如果你愿意的话，可以找运营官聊聊，说不定能帮你理清思路。', trigger_condition: '连续2周<60%', is_active: true },
  { id: 'n3', category: 'negative', title: '情绪持续下降', content: '最近你的情绪指数有些波动，生活总有起落，给自己一点空间也没关系的。', trigger_condition: '情绪指数连降3分', is_active: true },
  { id: 'g1', category: 'greeting', title: '朝有规划问候', content: '早安！新的一天开始了，花几分钟规划一下今天的重点，整日都不慌忙。', trigger_condition: '早8:00-9:00', is_active: true },
  { id: 'g2', category: 'greeting', title: '暮有复盘问候', content: '一天的工作结束了，回顾一下今天的成就和收获，经验会变成你的方法。', trigger_condition: '晚18:00-20:00', is_active: true },
  { id: 's1', category: 'system', title: '节点提醒', content: '项目 {project_name} 节点 {node_name} 即将到期，请及时处理。', trigger_condition: '节点到期前24h', is_active: true },
  { id: 's2', category: 'system', title: '逾期通知', content: '项目 {project_name} 节点 {node_name} 已逾期 {days} 天，请尽快处理。', trigger_condition: '节点逾期', is_active: true },
]

export function AdminPushTemplates() {
  const navigate = useNavigate()
  const [templates] = useState<Template[]>(MOCK_TEMPLATES)
  const [activeCategory, setActiveCategory] = useState<TemplateCategory>('positive')
  const [editId, setEditId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  useEffect(() => {
    if (getMyRole() !== 'superadmin') { navigate('/', { replace: true }); return }
  }, [navigate])

  const filtered = templates.filter((t) => t.category === activeCategory)

  const startEdit = (t: Template) => { setEditId(t.id); setEditContent(t.content) }
  const saveEdit = () => { setEditId(null) /* TODO: API */ }

  return (
          <div className="adm-page">
        <h2>推送规则模板配置</h2>

        <div className="adm-toolbar">
          {(['positive', 'negative', 'greeting', 'system'] as TemplateCategory[]).map((cat) => (
            <button key={cat}
              className={`adm-tab ${activeCategory === cat ? 'adm-tab--active' : ''}`}
              onClick={() => setActiveCategory(cat)}>
              {CATEGORY_LABELS[cat]}
              <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 4 }}>
                ({templates.filter((t) => t.category === cat).length})
              </span>
            </button>
          ))}
        </div>

        <div className="adm-dashboard" style={{ gap: 'var(--spacing-lg)' }}>
          {filtered.map((t) => (
            <div key={t.id} className="adm-panel">
              <div className="adm-panel__header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="adm-panel__title">{t.title}</span>
                  <span className={`adm-tag ${t.is_active ? 'adm-tag--active' : 'adm-tag--inactive'}`}>
                    {t.is_active ? '启用' : '停用'}
                  </span>
                </div>
                <button className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => startEdit(t)}>
                  <Icon icon="mingcute:edit-line" width={14} /> 编辑
                </button>
              </div>
              <div className="adm-panel__body">
                <p style={{ fontSize: 14, color: 'var(--color-neutral-500)', marginBottom: 8 }}>
                  <Icon icon="mingcute:lightning-line" width={14} style={{ verticalAlign: -2, marginRight: 4 }} />
                  触发条件：{t.trigger_condition}
                </p>
                {editId === t.id ? (
                  <div>
                    <textarea className="adm-search" style={{ width: '100%', height: 80, padding: 8 }}
                      value={editContent} onChange={(e) => setEditContent(e.target.value)} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={saveEdit}>保存</button>
                      <button className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => setEditId(null)}>取消</button>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: 14, background: 'var(--color-brand-primary-light)', padding: 12, borderRadius: 8, color: 'var(--color-neutral-700)' }}>
                    {t.content}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
  )
}
