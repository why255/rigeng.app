import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'
import './admin.css'

function getMyRole(): string {
  try { return JSON.parse(localStorage.getItem('rg_user') || '{}').role || '' } catch { return '' }
}

export function AdminSettingsParams() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    trial_days: 7,
    vip_primary_price: 29,
    vip_primary_storage: 1,
    vip_primary_record_hours: 5,
    vip_medium_price: 99,
    vip_medium_storage: 5,
    vip_medium_record_hours: 20,
    coach_session_limit: 10,
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (getMyRole() !== 'superadmin') { navigate('/', { replace: true }); return }
  }, [navigate])

  const update = (f: string, v: any) => setForm((p) => ({ ...p, [f]: v }))

  return (
          <div className="adm-page">
        <h2>参数配置</h2>

        <div className="adm-panel" style={{ maxWidth: 640 }}>
          <div className="adm-panel__header"><span className="adm-panel__title">全局参数</span></div>
          <div className="adm-panel__body">
            <div className="adm-form-group">
              <label>新用户试用期（天）</label>
              <input type="number" value={form.trial_days} onChange={(e) => update('trial_days', Number(e.target.value))} />
            </div>
            <div className="adm-form-group">
              <label>初级VIP 月费（元）</label>
              <input type="number" value={form.vip_primary_price} onChange={(e) => update('vip_primary_price', Number(e.target.value))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="adm-form-group">
                <label>初级VIP 存储空间（GB）</label>
                <input type="number" value={form.vip_primary_storage} onChange={(e) => update('vip_primary_storage', Number(e.target.value))} />
              </div>
              <div className="adm-form-group">
                <label>初级VIP 录音时长（h/月）</label>
                <input type="number" value={form.vip_primary_record_hours} onChange={(e) => update('vip_primary_record_hours', Number(e.target.value))} />
              </div>
            </div>
            <div className="adm-form-group">
              <label>中级VIP 月费（元）</label>
              <input type="number" value={form.vip_medium_price} onChange={(e) => update('vip_medium_price', Number(e.target.value))} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="adm-form-group">
                <label>中级VIP 存储空间（GB）</label>
                <input type="number" value={form.vip_medium_storage} onChange={(e) => update('vip_medium_storage', Number(e.target.value))} />
              </div>
              <div className="adm-form-group">
                <label>中级VIP 录音时长（h/月）</label>
                <input type="number" value={form.vip_medium_record_hours} onChange={(e) => update('vip_medium_record_hours', Number(e.target.value))} />
              </div>
            </div>
            <div className="adm-form-group">
              <label>老师辅导次数上限</label>
              <input type="number" value={form.coach_session_limit} onChange={(e) => update('coach_session_limit', Number(e.target.value))} />
            </div>
          </div>
        </div>

        <button className="adm-btn adm-btn--primary" onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000) }}>
          <Icon icon="mingcute:check-line" width={16} /> {saved ? '已保存' : '保存配置'}
        </button>
      </div>
  )
}
