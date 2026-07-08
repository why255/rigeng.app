/**
 * 暮有复盘 · 情绪滑块组件。
 * 移动端和 PC 端共用 — 在"萃取"阶段显示。
 */
import { BRAND_COLOR } from './review-constants';

interface EmotionSliderProps {
  value: number;
  onChange: (value: number) => void;
}

export function EmotionSlider({ value, onChange }: EmotionSliderProps) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 20, marginTop: 16, marginBottom: 16,
      border: '1px solid #E8E0D6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 20, color: BRAND_COLOR }}>💗</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#333' }}>今天情绪状态如何？</span>
      </div>
      <input
        type="range"
        min={-10}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: '100%', height: 8, WebkitAppearance: 'none', appearance: 'none',
          background: '#E8E0D6', borderRadius: 99, outline: 'none', cursor: 'pointer',
        }}
      />
      <div style={{
        display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#999', marginTop: 8,
      }}>
        <span>-10 低落</span>
        <span>+10 开心</span>
      </div>
      <div style={{
        textAlign: 'center', fontSize: 20, fontWeight: 700, color: BRAND_COLOR, marginTop: 8,
      }}>
        {value > 0 ? '+' : ''}{value}
      </div>
    </div>
  );
}
