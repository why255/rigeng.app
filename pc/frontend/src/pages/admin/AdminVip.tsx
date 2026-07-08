import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'
import { getVipPlans, updateVipPlan, type VipPlan } from '@/api/admin'
import './admin.css'

const LEVEL_LABELS: Record<string, string> = {
  trial: '试用期',
  primary: '初级VIP',
  medium: '中级VIP',
  advanced: '高级VIP',
}

const LEVEL_ORDER = ['trial', 'primary', 'medium', 'advanced']

function getMyRole(): string {
  try { return JSON.parse(localStorage.getItem('rg_user') || '{}').role || '' } catch { return '' }
}

export function AdminVip() {
  const navigate = useNavigate()
  const [plans, setPlans] = useState<VipPlan[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<VipPlan>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    getVipPlans()
      .then((data) => setPlans(data.sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level))))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (getMyRole() !== 'superadmin') { navigate('/', { replace: true }); return }
    load()
  }, [load, navigate])

  const startEdit = (plan: VipPlan) => {
    setEditingId(plan.id)
    setEditData({ ...plan })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditData({})
  }

  const saveEdit = async () => {
    if (!editingId || !editData) return
    setSaving(true)
    await updateVipPlan(editingId, editData).catch((e) => alert(e.message))
    setSaving(false)
    setEditingId(null)
    load()
  }

  const updateField = (field: keyof VipPlan, value: any) => {
    setEditData((prev) => ({ ...prev, [field]: value }))
  }

  if (loading) return <div className="adm-page"><div className="adm-page"><h2>VIP 套餐管理</h2><p className="adm-empty">加载中...</p></div></div>

  return (
          <div className="adm-page">
        <h2>VIP 套餐管理</h2>

        <div className="adm-dashboard" style={{ gap: 'var(--spacing-lg)' }}>
          {plans.map((plan) => {
            const isEditing = editingId === plan.id
            return (
              <div key={plan.id} className="adm-panel">
                <div className="adm-panel__header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span className={`adm-tag adm-tag--${plan.level === 'trial' ? 'trial' : plan.level === 'primary' ? 'primary' : plan.level === 'medium' ? 'advance' : 'pro'}`}>
                      {LEVEL_LABELS[plan.level]}
                    </span>
                    <span className="adm-panel__title">{plan.name}</span>
                    {!plan.is_active && (
                      <span className="adm-tag adm-tag--inactive">已停用</span>
                    )}
                  </div>
                  {!isEditing ? (
                    <button className="adm-btn adm-btn--outline adm-btn--sm" onClick={() => startEdit(plan)}>
                      <Icon icon="mingcute:edit-line" width={14} /> 编辑
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="adm-btn adm-btn--primary adm-btn--sm" onClick={saveEdit} disabled={saving}>
                        <Icon icon="mingcute:check-line" width={14} /> 保存
                      </button>
                      <button className="adm-btn adm-btn--outline adm-btn--sm" onClick={cancelEdit}>取消</button>
                    </div>
                  )}
                </div>

                <div className="adm-panel__body">
                  {isEditing ? (
                    /* 编辑模式 */
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                      <div className="adm-form-group">
                        <label>套餐名称</label>
                        <input value={editData.name || ''} onChange={(e) => updateField('name', e.target.value)} />
                      </div>
                      <div className="adm-form-group">
                        <label>月费（元）{plan.level === 'advanced' && ' — 一人一价设为 0'}</label>
                        <input type="number" value={editData.price ?? ''} onChange={(e) => updateField('price', Number(e.target.value))} />
                      </div>
                      <div className="adm-form-group">
                        <label>存储空间（GB）</label>
                        <input type="number" value={editData.storage_gb ?? ''} onChange={(e) => updateField('storage_gb', Number(e.target.value))} />
                      </div>
                      <div className="adm-form-group">
                        <label>录音时长（小时/月）</label>
                        <input type="number" value={editData.record_hours ?? ''} onChange={(e) => updateField('record_hours', Number(e.target.value))} />
                      </div>
                      <div className="adm-form-group">
                        <label>视频辅导时长（小时/月）</label>
                        <input type="number" value={editData.video_hours ?? ''} onChange={(e) => updateField('video_hours', Number(e.target.value))} />
                      </div>
                      <div className="adm-form-group">
                        <label>启用状态</label>
                        <select value={editData.is_active ? '1' : '0'} onChange={(e) => updateField('is_active', e.target.value === '1')}>
                          <option value="1">启用</option>
                          <option value="0">停用</option>
                        </select>
                      </div>
                    </div>
                  ) : (
                    /* 查看模式 */
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <span style={{ color: 'var(--color-neutral-500)', fontSize: 13 }}>月费</span>
                        <p style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-brand-primary)', margin: '4px 0' }}>
                          {plan.price > 0 ? `¥${plan.price}` : '一人一价'}
                        </p>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-neutral-500)', fontSize: 13 }}>存储空间</span>
                        <p style={{ fontSize: 18, fontWeight: 600, margin: '4px 0' }}>{plan.storage_gb} GB</p>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-neutral-500)', fontSize: 13 }}>录音时长</span>
                        <p style={{ fontSize: 18, fontWeight: 600, margin: '4px 0' }}>{plan.record_hours} 小时/月</p>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-neutral-500)', fontSize: 13 }}>视频辅导</span>
                        <p style={{ fontSize: 18, fontWeight: 600, margin: '4px 0' }}>{plan.video_hours} 小时/月</p>
                      </div>
                    </div>
                  )}

                  {/* 功能特性 */}
                  {!isEditing && plan.features && plan.features.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <span style={{ color: 'var(--color-neutral-500)', fontSize: 13 }}>功能特性</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        {plan.features.map((f, i) => (
                          <span key={i} className="adm-tag adm-tag--primary">{f}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {isEditing && (
                    <div className="adm-form-group" style={{ marginTop: 16 }}>
                      <label>功能特性（逗号分隔）</label>
                      <input
                        value={(editData.features || []).join(', ')}
                        onChange={(e) => updateField('features', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
                        placeholder="输入特性，逗号分隔"
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
  )
}
