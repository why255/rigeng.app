/**
 * 朝有规划 · Toggle 开关行。
 * 对齐 MorningPlan settings 页，移动端和 PC 端共用。
 */

interface PlanSwitchProps {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

export function PlanSwitch({ label, desc, checked, onChange }: PlanSwitchProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '16px 0', borderBottom: '1px solid rgba(0,0,0,0.04)',
    }}>
      <div>
        <div style={{ fontSize: 15, color: '#333', fontWeight: 500 }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{desc}</div>}
      </div>
      <label style={{
        position: 'relative', display: 'inline-block', width: 44, height: 24,
        cursor: 'pointer', flexShrink: 0,
      }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          style={{ opacity: 0, width: 0, height: 0 }}
        />
        <span style={{
          position: 'absolute', inset: 0, borderRadius: 24,
          background: checked ? '#C03A39' : '#E0E0E0', transition: '0.3s',
        }} />
        <span style={{
          position: 'absolute', height: 18, width: 18, left: checked ? 23 : 3,
          bottom: 3, borderRadius: '50%', background: '#fff',
          transition: '0.3s',
        }} />
      </label>
    </div>
  );
}
