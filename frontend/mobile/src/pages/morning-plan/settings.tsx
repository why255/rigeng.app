/**
 * P6 设置页 — 关怀模式 / 语音输入模式 / 离线模式。
 * Route: /m/morning-plan/settings
 * 对齐 m1p6 设计。
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { updateCareMode } from '@rigeng/shared/api/plans';
import './morning-plan.css';

export function MorningPlanSettings() {
  const navigate = useNavigate();

  const [careMode, setCareMode] = useState<'active' | 'passive'>(() =>
    (localStorage.getItem('rg_care_mode') as 'active' | 'passive') || 'active',
  );

  const [voiceMode, setVoiceMode] = useState<'hold' | 'click'>(() =>
    (localStorage.getItem('rg_voice_mode') as 'hold' | 'click') || 'hold',
  );

  const [offlineMode, setOfflineMode] = useState(() =>
    localStorage.getItem('rg_offline_mode') === 'true',
  );

  const handleCareModeToggle = async () => {
    const newMode = careMode === 'active' ? 'passive' : 'active';
    setCareMode(newMode);
    localStorage.setItem('rg_care_mode', newMode);
    try {
      await updateCareMode(newMode);
    } catch { /* ignore API errors */ }
  };

  const handleVoiceModeToggle = (mode: 'hold' | 'click') => {
    setVoiceMode(mode);
    localStorage.setItem('rg_voice_mode', mode);
  };

  const handleOfflineModeToggle = () => {
    const next = !offlineMode;
    setOfflineMode(next);
    localStorage.setItem('rg_offline_mode', String(next));
  };

  return (
    <div className="mp-mobile-page">
      {/* ===== Header ===== */}
      <header className="mp-mobile-page__header" style={{ height: 48 }}>
        <button className="mp-header-btn" onClick={() => navigate(-1)}>
          <Icon icon="mingcute:arrow-left-fill" style={{ fontSize: '24px' }} />
        </button>
        <span className="font-zcool" style={{ fontSize: '18px', fontWeight: 700, color: '#C03A39' }}>
          设置
        </span>
        <div className="mp-header-spacer" />
      </header>

      {/* ===== Content ===== */}
      <main className="mp-main-scroll">
        <div className="mp-main-padding">
          {/* Settings Card */}
          <div className="mp-card" style={{ padding: '16px 20px' }}>
            {/* Care mode */}
            <div className="mp-setting-row">
              <div>
                <div className="mp-setting-label">关怀模式</div>
                <div className="mp-setting-desc">加大字号与触控区域</div>
              </div>
              <label className="mp-switch">
                <input
                  type="checkbox"
                  checked={careMode === 'passive'}
                  onChange={handleCareModeToggle}
                />
                <span className="mp-switch__slider" />
              </label>
            </div>

            {/* Voice mode */}
            <div className="mp-setting-row">
              <div>
                <div className="mp-setting-label">语音输入模式</div>
                <div className="mp-setting-desc">按住说话 / 点击切换</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className={`mp-voice-mode-option ${voiceMode === 'hold' ? 'active' : ''}`}
                  onClick={() => handleVoiceModeToggle('hold')}
                >
                  按住说话
                </button>
                <button
                  className={`mp-voice-mode-option ${voiceMode === 'click' ? 'active' : ''}`}
                  onClick={() => handleVoiceModeToggle('click')}
                >
                  点击说话
                </button>
              </div>
            </div>

            {/* Offline mode */}
            <div className="mp-setting-row" style={{ borderBottom: 'none' }}>
              <div>
                <div className="mp-setting-label">离线模式</div>
                <div className="mp-setting-desc">弱网时自动切换到本地录制</div>
              </div>
              <label className="mp-switch">
                <input
                  type="checkbox"
                  checked={offlineMode}
                  onChange={handleOfflineModeToggle}
                />
                <span className="mp-switch__slider" />
              </label>
            </div>
          </div>

          {/* Version info */}
          <p style={{ textAlign: 'center', fontSize: 12, color: '#ccc', marginTop: 24 }}>
            日耕 v0.1.0
          </p>
        </div>
      </main>
    </div>
  );
}
