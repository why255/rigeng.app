/**
 * 语音模式选择器 — "按住说话" vs "点击说话"。
 * 对齐 m3p5-mobile.html 原型，移动端和 PC 端共用。
 */
import { Icon } from '@iconify/react';

export type VoiceMode = 'hold' | 'click';

interface VoiceModeSelectorProps {
  value: VoiceMode;
  onChange: (mode: VoiceMode) => void;
}

export function VoiceModeSelector({ value, onChange }: VoiceModeSelectorProps) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: '20px 16px',
      marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      border: '1px solid #f0ede8',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Icon icon="mingcute:mic-line" width={24} color="#D4A574" />
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#333', margin: 0 }}>语音输入方式</h2>
      </div>
      <p style={{ fontSize: 12, color: '#999', margin: '0 0 16px', paddingLeft: 32 }}>
        选择适合您的录音交互方式
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <ModeButton
          active={value === 'hold'}
          onClick={() => onChange('hold')}
          icon="mingcute:mic-fill"
          label="按住说话"
          sub="适合碎片时间"
        />
        <ModeButton
          active={value === 'click'}
          onClick={() => onChange('click')}
          icon="mingcute:play-circle-line"
          label="点击说话"
          sub="适合专注时间"
        />
      </div>
    </div>
  );
}

function ModeButton({ active, onClick, icon, label, sub }: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
  sub: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '12px 8px', borderRadius: 8,
        border: active ? '1px solid #C03A39' : '1px solid #E8E0D6',
        background: active ? '#FFF5F5' : '#fff',
        color: active ? '#C03A39' : '#666',
        fontWeight: active ? 600 : 400,
        cursor: 'pointer', textAlign: 'center' as const,
        transition: 'all 0.2s', fontFamily: 'inherit', fontSize: 14,
      }}
    >
      <Icon icon={icon} width={24} style={{ display: 'block', margin: '0 auto 4px' }} />
      {label}
      <div style={{
        fontSize: 11, color: active ? '#C03A39' : '#999',
        fontWeight: 400, marginTop: 2,
      }}>
        {sub}
      </div>
    </button>
  );
}
