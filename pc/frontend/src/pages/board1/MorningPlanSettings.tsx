/**
 * P6 设置页 — 关怀模式开关等偏好设置。
 * Route: /m/morning-plan/settings
 * 对齐 m1-p6.html 设计。
 * 共享组件 PlanBrandHero, PlanSwitch 从 shared 引用。
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as plansApi from '@/shared/api/plans';
import { PlanBrandHero, PlanSwitch } from '@/shared/components/features/morning-plan';
import './morning-plan.css';

export function MorningPlanSettings() {
  const navigate = useNavigate();
  const [careMode, setCareMode] = useState<'active' | 'passive'>('active');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    plansApi.fetchCurrentUser().then((user) => {
      if (user.care_mode) setCareMode(user.care_mode as 'active' | 'passive');
    }).catch(() => {
      const savedMode = localStorage.getItem('rg_care_mode');
      if (savedMode) setCareMode(savedMode as 'active' | 'passive');
    });
  }, []);

  const handleSave = async () => {
    setSaving(true); setSaved(false);
    try { await plansApi.updateCareMode(careMode); } catch { localStorage.setItem('rg_care_mode', careMode); }
    setSaved(true); setSaving(false);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div data-module="morning-plan">
      <div className="mp-page">
        <PlanBrandHero />

        <h2 style={{ fontSize: 18, fontFamily: "'ZCOOL XiaoWei', 'Noto Sans SC', serif", fontWeight: 700, color: '#333', marginBottom: 32 }}>
          小耕对话·设置
        </h2>

        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E8E0D6', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <PlanSwitch
            label="关怀模式"
            desc={`当前状态：${careMode === 'active' ? '主动' : '被动'}`}
            checked={careMode === 'active'}
            onChange={(v) => setCareMode(v ? 'active' : 'passive')}
          />
        </div>

        <div style={{ marginTop: 24, opacity: 0.7 }}>
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E8E0D6', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: 16 }}>
            <div className="mp-setting-row">
              <div className="mp-setting-row__info">
                <div className="mp-setting-row__title">暮有复盘 · 复盘提醒时间</div>
                <div className="mp-setting-row__state">每日提醒时间</div>
              </div>
              <span className="mp-setting-row__badge">即将开放</span>
            </div>
          </div>
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E8E0D6', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div className="mp-setting-row">
              <div className="mp-setting-row__info">
                <div className="mp-setting-row__title">情绪树洞 · 暗色模式开关</div>
                <div className="mp-setting-row__state">暗色模式</div>
              </div>
              <span className="mp-setting-row__badge">即将开放</span>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 32 }}>
          <button className="mp-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中…' : saved ? '✅ 已保存' : '保存设置'}
          </button>
        </div>

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <button onClick={() => navigate('/m/morning-plan')} style={{ fontSize: 14, color: '#666', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>← 返回入口</button>
        </div>
      </div>
    </div>
  );
}
