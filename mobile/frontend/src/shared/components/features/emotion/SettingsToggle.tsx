/**
 * 设置开关行 — 图标 + 标题 + 描述 + toggle 开关。
 * 对齐 m3p5-mobile.html 原型，移动端和 PC 端共用。
 */
import { Icon } from '@iconify/react';

interface SettingsToggleProps {
  icon: string;
  iconColor?: string;
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  /** 外层卡片包裹，如果 false 则只输出行 */
  card?: boolean;
}

export function SettingsToggle({
  icon,
  iconColor = '#C03A39',
  label,
  desc,
  checked,
  onChange,
  card = true,
}: SettingsToggleProps) {
  const row = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 15, fontWeight: 500, color: '#333' }}>
          <Icon icon={icon} width={18} color={iconColor} style={{ marginRight: 6 }} />
          {label}
        </div>
        <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{desc}</div>
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} />
    </div>
  );

  if (!card) return row;

  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: '20px 16px',
      marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      border: '1px solid #f0ede8',
    }}>
      {row}
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{
      position: 'relative', display: 'inline-block', width: 48, height: 28,
      cursor: 'pointer', flexShrink: 0,
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ opacity: 0, width: 0, height: 0 }}
      />
      <span style={{
        position: 'absolute', inset: 0, borderRadius: 34,
        background: checked ? '#C03A39' : '#ccc', transition: '0.3s',
      }} />
      <span style={{
        position: 'absolute', height: 22, width: 22,
        left: checked ? 23 : 3, bottom: 3,
        borderRadius: '50%', background: '#fff',
        transition: '0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
      }} />
    </label>
  );
}
