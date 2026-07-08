/**
 * 暮有复盘 · 勇气值展示组件。
 * 移动端和 PC 端共用 — 在"改进"阶段显示。
 */
import { BRAND_COLOR } from './review-constants';

interface CourageDisplayProps {
  value: number;
  message: string;
}

export function CourageDisplay({ value, message }: CourageDisplayProps) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 20, marginTop: 16, marginBottom: 16,
      border: '1px solid #E8E0D6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 20, color: BRAND_COLOR }}>🔥</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#333' }}>今日勇气值</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          flex: 1, height: 12, background: '#E8E0D6', borderRadius: 99, overflow: 'hidden',
        }}>
          <div style={{
            width: `${value}%`, height: '100%', borderRadius: 99,
            background: 'linear-gradient(90deg, #C03A39, #FF6B6B)',
            transition: 'width 0.5s ease-out',
          }} />
        </div>
        <span style={{
          fontSize: 14, fontWeight: 700, color: BRAND_COLOR, whiteSpace: 'nowrap',
        }}>
          {value}%
        </span>
      </div>
      <p style={{ fontSize: 12, color: '#999', marginTop: 8, marginBottom: 0 }}>{message}</p>
    </div>
  );
}
