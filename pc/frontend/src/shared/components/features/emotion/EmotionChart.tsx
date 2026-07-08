/**
 * 本周情绪曲线柱状图 — 7天情绪趋势可视化。
 * 对齐 m3p4-mobile.html 原型，移动端和 PC 端共用。
 */
import type { WeeklyEmotion } from '../../../api/emotions';

interface EmotionChartProps {
  weekly: WeeklyEmotion | null;
  loading?: boolean;
}

export function EmotionChart({ weekly, loading = false }: EmotionChartProps) {
  const scoreToHeight = (score: number) => {
    const pct = ((score + 10) / 20) * 100;
    return Math.max(4, Math.min(100, pct));
  };

  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: 16,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)', marginBottom: 16,
    }}>
      <h2 style={{
        fontSize: 12, fontWeight: 700, color: '#9ca3af',
        textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 24,
      }}>
        本周情绪曲线
      </h2>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>加载中…</div>
      ) : weekly ? (
        <div style={{
          height: 128, display: 'flex', alignItems: 'flex-end',
          justifyContent: 'space-between', padding: '0 8px',
        }}>
          {weekly.days.map((day) => (
            <div key={day.day_index} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            }}>
              <div style={{
                width: 16,
                height: `${Math.max(4, scoreToHeight(day.score))}%`,
                background: day.score >= 0 ? '#FFCC80' : '#C03A39',
                borderRadius: '4px 4px 0 0',
                transition: 'height 0.7s ease',
              }} />
              <span style={{ fontSize: 8, color: '#9ca3af' }}>{day.day}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>暂无数据</div>
      )}
    </div>
  );
}
