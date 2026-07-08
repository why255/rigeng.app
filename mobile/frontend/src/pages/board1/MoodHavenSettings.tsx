/**
 * P5 对话设置页 — 语音模式 + 关怀模式 + 暗色模式。
 * Route: /m/mood-haven/settings
 * 严格对齐 m3p5-mobile.html 原型设计。
 *
 * 使用 mh-* BEM 类名（来自 mood-haven.css）+ 内联 style。无 Tailwind CSS。
 * 图标使用 @iconify/react <Icon> 组件。返回按钮使用 navigate(-1)。
 * 共享业务组件 VoiceModeSelector, SettingsToggle 从 @/shared/components/features/emotion 引用。
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { VoiceModeSelector, SettingsToggle } from '@/shared/components/features/emotion';
import type { VoiceMode } from '@/shared/components/features/emotion';
import './mood-haven.css';

export function MoodHavenSettings() {
  const navigate = useNavigate();

  const [voiceMode, setVoiceMode] = useState<VoiceMode>(() => {
    return (localStorage.getItem('mh_voiceMode') as VoiceMode) || 'hold';
  });
  const [careMode, setCareMode] = useState(() => {
    return localStorage.getItem('mh_careMode') !== 'false';
  });
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('mh_darkMode');
    return stored === null ? true : stored === 'true';
  });
  const [saved, setSaved] = useState(false);

  const handleDarkModeChange = (enabled: boolean) => {
    setDarkMode(enabled);
    if (enabled) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('mh_darkMode', String(enabled));
    setSaved(false);
  };

  const handleSave = () => {
    localStorage.setItem('mh_voiceMode', voiceMode);
    localStorage.setItem('mh_careMode', String(careMode));
    localStorage.setItem('mh_darkMode', String(darkMode));
    setSaved(true);
    setTimeout(() => navigate(-1), 800);
  };

  return (
    <div data-module="mood-haven">
      <div className="mh-page">

        {/* ═══ 顶部导航 ═══ */}
        <header className="mh-page-header" style={{ marginBottom: 12 }}>
          <button className="mh-page-header__back" onClick={() => navigate(-1)}>
            <Icon icon="mingcute:left-line" width={20} />
          </button>
          <span style={{
            fontFamily: "'ZCOOL XiaoWei', '华文楷体', 'KaiTi', serif",
            fontSize: 18, fontWeight: 700, color: '#C03A39',
          }}>
            情绪树洞
          </span>
          <div className="mh-page-header__spacer" />
        </header>

        {/* ═══ 品牌区 ═══ */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#333', marginBottom: 8 }}>
            日耕朝夕，耕愈工作，耕暖生活
          </p>
          <div style={{
            width: 40, height: 2, background: '#D4C5B0',
            margin: '8px auto 12px',
          }} />
          <h1 style={{ fontSize: 17, fontWeight: 700, color: '#333', margin: 0 }}>
            对话设置
          </h1>
        </div>

        {/* ═══ 语音输入方式 ═══ */}
        <VoiceModeSelector
          value={voiceMode}
          onChange={(mode) => { setVoiceMode(mode); setSaved(false); }}
        />

        {/* ═══ 主动关怀模式 ═══ */}
        <SettingsToggle
          icon="mingcute:heart-line"
          label="主动关怀模式"
          desc="当检测到情绪低落时，小耕会主动关心"
          checked={careMode}
          onChange={(v) => { setCareMode(v); setSaved(false); }}
        />

        {/* ═══ 暗色模式 ═══ */}
        <SettingsToggle
          icon="mingcute:moon-line"
          label="暗色模式"
          desc="切换深色/浅色主题"
          checked={darkMode}
          onChange={handleDarkModeChange}
        />

        {/* ═══ 保存按钮 ═══ */}
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <button
            onClick={handleSave}
            disabled={saved}
            style={{
              background: saved ? '#ccc' : '#C03A39',
              color: '#fff', border: 'none',
              padding: '12px 32px', borderRadius: 30,
              fontWeight: 600, fontSize: 16, cursor: saved ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s', boxShadow: saved ? 'none' : '0 4px 12px rgba(192,58,57,0.2)',
              fontFamily: 'inherit', minWidth: 200, opacity: saved ? 0.6 : 1,
            }}
          >
            {saved ? '设置已保存' : '保存设置'}
          </button>
        </div>

      </div>
    </div>
  );
}
