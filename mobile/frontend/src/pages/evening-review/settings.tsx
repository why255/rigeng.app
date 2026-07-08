/**
 * P5 设置页 — 语音模式 + 关怀模式开关（对齐 m2-p5-mobile.html）。
 * Route: /m/evening-review/settings
 *
 * 使用 mp-* BEM 类名（来自 morning-plan.css）+ 内联 style。无 Tailwind CSS。
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import '../morning-plan/morning-plan.css';

export function EveningReviewSettings() {
  const navigate = useNavigate();
  const [voiceMode, setVoiceMode] = useState<'hold' | 'click'>(
    () => (localStorage.getItem('er_voiceMode') as 'hold' | 'click') || 'hold'
  );
  const [careMode, setCareMode] = useState<boolean>(
    () => localStorage.getItem('er_careMode') !== 'false'
  );
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem('er_voiceMode', voiceMode);
    localStorage.setItem('er_careMode', String(careMode));
    setSaved(true);
    setTimeout(() => navigate(-1), 800);
  };

  return (
    <div className="mp-mobile-page">
      {/* Header */}
      <header className="mp-mobile-page__header" style={{ height: 48 }}>
        <button className="mp-header-btn" onClick={() => navigate(-1)}>
          <Icon icon="mingcute:arrow-left-fill" style={{ fontSize: '24px' }} />
        </button>
        <span className="font-zcool" style={{ fontSize: '18px', fontWeight: 700, color: '#C03A39' }}>
          暮有复盘 · 设置
        </span>
        <div className="mp-header-spacer" />
      </header>

      {/* Content */}
      <main className="mp-main-scroll">
        <div className="mp-main-padding">
          {/* Brand */}
          <section className="mp-hero">
            <p className="mp-hero__slogan">日耕朝夕，耕愈工作，耕暖生活</p>
            <div className="mp-hero__divider" />
            <h1 className="mp-hero__title" style={{ fontSize: 17 }}>对话设置</h1>
          </section>

          {/* 语音输入方式 */}
          <div className="mp-card">
            <div className="mp-card__header">
              <Icon icon="mingcute:mic-line" style={{ fontSize: '24px', color: '#D4A574' }} />
              <h2 className="mp-card__header-title">语音输入方式</h2>
            </div>
            <p style={{ fontSize: 12, color: '#999', marginTop: 0, marginBottom: 12 }}>
              选择适合您的录音交互方式
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setVoiceMode('hold')}
                style={{
                  flex: 1, padding: '12px 8px',
                  borderRadius: 8,
                  border: voiceMode === 'hold' ? '2px solid #C03A39' : '1px solid #E8E0D6',
                  background: voiceMode === 'hold' ? '#FFF5F5' : '#fff',
                  color: voiceMode === 'hold' ? '#C03A39' : '#666',
                  fontWeight: voiceMode === 'hold' ? 600 : 400,
                  cursor: 'pointer', fontSize: 14,
                }}
              >
                <Icon
                  icon="mingcute:mic-fill"
                  style={{ fontSize: '24px', display: 'block', margin: '0 auto 4px' }}
                />
                按住说话
                <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>适合碎片时间</div>
              </button>
              <button
                onClick={() => setVoiceMode('click')}
                style={{
                  flex: 1, padding: '12px 8px',
                  borderRadius: 8,
                  border: voiceMode === 'click' ? '2px solid #C03A39' : '1px solid #E8E0D6',
                  background: voiceMode === 'click' ? '#FFF5F5' : '#fff',
                  color: voiceMode === 'click' ? '#C03A39' : '#666',
                  fontWeight: voiceMode === 'click' ? 600 : 400,
                  cursor: 'pointer', fontSize: 14,
                }}
              >
                <Icon
                  icon="mingcute:play-circle-line"
                  style={{ fontSize: '24px', display: 'block', margin: '0 auto 4px' }}
                />
                点击说话
                <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>适合专注时间</div>
              </button>
            </div>
          </div>

          {/* 主动关怀模式 */}
          <div className="mp-card">
            <div className="mp-setting-row" style={{ padding: '4px 0', borderBottom: 'none' }}>
              <div>
                <div className="mp-setting-label">
                  <Icon icon="mingcute:heart-line" style={{ fontSize: '18px', color: '#C03A39', marginRight: 6, verticalAlign: 'middle' }} />
                  主动关怀模式
                </div>
                <div className="mp-setting-desc">当检测到情绪低落时，小耕会主动关心</div>
              </div>
              <label className="mp-switch">
                <input
                  type="checkbox"
                  checked={careMode}
                  onChange={(e) => setCareMode(e.target.checked)}
                />
                <span className="mp-switch__slider" />
              </label>
            </div>
          </div>

          {/* Save button */}
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <button
              className="mp-btn-primary"
              onClick={handleSave}
              style={{ minWidth: 200 }}
            >
              {saved ? '设置已保存' : '保存设置'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
