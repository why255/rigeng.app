/**
 * 今日情绪概览卡片 — 情绪评分进度条 + 勇气值进度条。
 * 对齐 m3p1-mobile.html 原型，移动端和 PC 端共用。
 */
import type { TodayEmotion } from '../../../api/emotions';

interface EmotionOverviewProps {
  /** 今日情绪数据，null/undefined 表示无记录 */
  emotion: TodayEmotion | null;
  /** 是否加载中 */
  loading?: boolean;
}

export function EmotionOverview({ emotion, loading = false }: EmotionOverviewProps) {
  const score = emotion?.score ?? 0;
  const courage = emotion?.courage_value ?? 0;
  const scoreWidth = ((score + 10) / 20) * 100; // -10→0%, 0→50%, 10→100%
  const courageWidth = Math.min(100, courage);

  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: 16,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f3f4f6',
      marginBottom: 16,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#2C1810' }}>今日情绪概览</span>
        {!loading && !emotion && (
          <span style={{
            fontSize: 10, color: '#9ca3af', background: '#f9fafb',
            padding: '2px 8px', borderRadius: 20, border: '1px solid #e5e7eb',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            待记录
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>加载中…</div>
      ) : (
        <div>
          {/* 情绪评分进度条 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 10, color: '#9ca3af', marginBottom: 4,
            }}>
              <span>情绪评分</span>
              <span style={{ color: '#FFCC80', fontWeight: 700 }}>
                {score > 0 ? '+' : ''}{score}
              </span>
            </div>
            <div style={{
              width: '100%', height: 6, background: '#f3f4f6',
              borderRadius: 3, overflow: 'hidden',
            }}>
              <div style={{
                width: `${scoreWidth}%`, height: '100%', background: '#FFCC80',
                borderRadius: 3, transition: 'width 0.3s',
              }} />
            </div>
          </div>

          {/* 勇气值进度条 */}
          <div>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 10, color: '#9ca3af', marginBottom: 4,
            }}>
              <span>勇气值</span>
              <span style={{ fontWeight: 700, color: '#2C1810' }}>{courage}/100</span>
            </div>
            <div style={{
              width: '100%', height: 6, background: '#f3f4f6',
              borderRadius: 3, overflow: 'hidden',
            }}>
              <div style={{
                width: `${courageWidth}%`, height: '100%', background: '#C03A39',
                borderRadius: 3, transition: 'width 0.3s',
              }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
