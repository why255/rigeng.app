/**
 * P6 设置页 — 语音模式 + 关怀模式 + 离线模式。
 * Route: /m/morning-plan/settings
 * 共享组件 PlanBrandHero, PlanSwitch 从 shared 引用。
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { updateCareMode } from '@/shared/api/plans';
import { PlanBrandHero, PlanSwitch } from '@/shared/components/features/morning-plan';
import './morning-plan.css';

export function MorningPlanSettings() {
  const navigate = useNavigate();

  const [careMode, setCareMode] = useState<boolean>(() =>
    (localStorage.getItem('rg_care_mode') as 'active' | 'passive') !== 'passive',
  );
  const [voiceMode, setVoiceMode] = useState<'hold' | 'click'>(() =>
    (localStorage.getItem('rg_voice_mode') as 'hold' | 'click') || 'hold',
  );
  const [offlineMode, setOfflineMode] = useState<boolean>(() =>
    localStorage.getItem('rg_offline_mode') === 'true',
  );
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    localStorage.setItem('rg_voice_mode', voiceMode);
    localStorage.setItem('rg_care_mode', careMode ? 'active' : 'passive');
    localStorage.setItem('rg_offline_mode', String(offlineMode));
    try { await updateCareMode(careMode ? 'active' : 'passive'); } catch { /* ignore */ }
    setSaved(true);
    setTimeout(() => navigate(-1), 800);
  };

  return (
    <div className="mp-mobile-page">
      <header className="mp-mobile-page__header" style={{ height: 48 }}>
        <button className="mp-header-btn" onClick={() => navigate(-1)}>
          <Icon icon="mingcute:arrow-left-fill" style={{ fontSize: '24px' }} />
        </button>
        <span className="font-zcool" style={{ fontSize: '18px', fontWeight: 700, color: '#C03A39' }}>
          朝有规划 · 设置
        </span>
        <div className="mp-header-spacer" />
      </header>

      <main className="mp-main-scroll">
        <div className="mp-main-padding">
          <PlanBrandHero title="对话设置" divider />

          {/* 语音输入方式 */}
          <div className="mp-card">
            <div className="mp-card__header">
              <Icon icon="mingcute:mic-line" style={{ fontSize: '24px', color: '#D4A574' }} />
              <h2 className="mp-card__header-title">语音输入方式</h2>
            </div>
            <p style={{ fontSize: 12, color: '#999', marginTop: 0, marginBottom: 12 }}>选择适合您的录音交互方式</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <VoiceBtn active={voiceMode === 'hold'} onClick={() => setVoiceMode('hold')} icon="mingcute:mic-fill" label="按住说话" sub="适合碎片时间" />
              <VoiceBtn active={voiceMode === 'click'} onClick={() => setVoiceMode('click')} icon="mingcute:play-circle-line" label="点击说话" sub="适合专注时间" />
            </div>
          </div>

          {/* 关怀模式 */}
          <div className="mp-card">
            <PlanSwitch label="关怀模式" desc="加大字号与触控区域" checked={careMode} onChange={setCareMode} />
          </div>

          {/* 离线模式 */}
          <div className="mp-card">
            <PlanSwitch label="离线模式" desc="弱网时自动切换到本地录制" checked={offlineMode} onChange={setOfflineMode} />
          </div>

          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <button className="mp-btn-primary" onClick={handleSave} style={{ minWidth: 200 }}>
              {saved ? '设置已保存' : '保存设置'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function VoiceBtn({ active, onClick, icon, label, sub }: { active: boolean; onClick: () => void; icon: string; label: string; sub: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '12px 8px', borderRadius: 8,
        border: active ? '2px solid #C03A39' : '1px solid #E8E0D6',
        background: active ? '#FFF5F5' : '#fff',
        color: active ? '#C03A39' : '#666',
        fontWeight: active ? 600 : 400,
        cursor: 'pointer', fontSize: 14,
      }}
    >
      <Icon icon={icon} style={{ fontSize: '24px', display: 'block', margin: '0 auto 4px' }} />
      {label}
      <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{sub}</div>
    </button>
  );
}
