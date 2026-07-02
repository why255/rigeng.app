import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@iconify/react'
import './admin.css'

function getMyRole(): string {
  try { return JSON.parse(localStorage.getItem('rg_user') || '{}').role || '' } catch { return '' }
}

export function AdminPushQuota() {
  const navigate = useNavigate()
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    weekly_limit: 5,
    time_start: '09:00',
    time_end: '21:00',
    night_block: true,
    sms_block: true,
    new_user_protect_days: 7,
  })

  useEffect(() => {
    if (getMyRole() !== 'superadmin') { navigate('/', { replace: true }); return }
  }, [navigate])

  const update = (field: string, value: any) => setForm((p) => ({ ...p, [field]: value }))

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
          <div className="adm-page">
        <h2>频控配置</h2>

        <div className="adm-panel" style={{ maxWidth: 600 }}>
          <div className="adm-panel__header">
            <span className="adm-panel__title">推送频率与限制</span>
          </div>
          <div className="adm-panel__body">
            <div className="adm-form-group">
              <label>每周推送上限（次/用户）</label>
              <input type="number" value={form.weekly_limit}
                onChange={(e) => update('weekly_limit', Number(e.target.value))} />
              <div className="adm-form-hint">默认 5 次/周/用户</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="adm-form-group">
                <label>推送开始时间</label>
                <input type="time" value={form.time_start}
                  onChange={(e) => update('time_start', e.target.value)} />
              </div>
              <div className="adm-form-group">
                <label>推送结束时间</label>
                <input type="time" value={form.time_end}
                  onChange={(e) => update('time_end', e.target.value)} />
              </div>
            </div>
            <div className="adm-form-hint">默认 9:00-21:00</div>

            <div className="adm-form-group" style={{ marginTop: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={form.night_block}
                  onChange={(e) => update('night_block', e.target.checked)}
                  style={{ width: 'auto' }} />
                夜间拦截（21:00-9:00 绝对不推送）
              </label>
              <div className="adm-form-hint" style={{ marginLeft: 24 }}>系统级硬限制，不可绕过</div>
            </div>

            <div className="adm-form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={form.sms_block}
                  onChange={(e) => update('sms_block', e.target.checked)}
                  style={{ width: 'auto' }} />
                短信拦截（任何场景不触发短信推送）
              </label>
              <div className="adm-form-hint" style={{ marginLeft: 24 }}>系统级硬限制，不可绕过</div>
            </div>

            <div className="adm-form-group">
              <label>新用户保护期（天）</label>
              <input type="number" value={form.new_user_protect_days}
                onChange={(e) => update('new_user_protect_days', Number(e.target.value))} />
              <div className="adm-form-hint">前 N 天仅推送正向激励，不触发反向关怀。默认 7 天</div>
            </div>
          </div>
        </div>

        <button className="adm-btn adm-btn--primary" onClick={handleSave}>
          <Icon icon="mingcute:check-line" width={16} />
          {saved ? '已保存' : '保存配置'}
        </button>
      </div>
  )
}
