/**
 * 暮有复盘 · 今日复盘统计卡片。
 * 移动端和 PC 端共用。
 */
import type { ReviewStats } from '../../../api/reviews';
import { BRAND_COLOR, WARN_COLOR } from './review-constants';

const ACCENT_COLOR = '#D4A574';

interface ReviewStatsCardProps {
  stats: ReviewStats | null;
  loading?: boolean;
  /** 点击开始/继续复盘的回调 */
  onStartReview?: () => void;
  /** 按钮文案（默认自动判断） */
  buttonLabel?: string;
}

export function ReviewStatsCard({
  stats,
  loading = false,
  onStartReview,
  buttonLabel,
}: ReviewStatsCardProps) {
  const completionRate = stats ? Math.round(stats.completion_rate) : 0;
  const couragePercent = stats ? Math.round((stats.courage_value / 100) * 100) : 0;
  const hasData = stats && stats.total_tasks > 0;

  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 20, marginBottom: 16,
      border: '1px solid #E8E0D6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
        paddingBottom: 12, borderBottom: '1px solid #F5F3EF',
      }}>
        <span style={{ fontSize: 24, color: ACCENT_COLOR }}>📋</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#333' }}>今日复盘</span>
      </div>

      {/* 完成事项 + 进度条 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 14, color: '#666' }}>今日完成事项</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>
            {loading ? '—' : `${stats?.completed_tasks ?? 0}/${stats?.total_tasks ?? 0}`}
          </span>
        </div>
        <div style={{ width: '100%', height: 10, background: '#E8E0D6', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            width: `${completionRate}%`, height: '100%', borderRadius: 99,
            background: WARN_COLOR,
            transition: 'width 0.8s ease-out',
          }} />
        </div>
      </div>

      {/* 萃取SOP */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 0', borderTop: '1px solid #F5F3EF',
      }}>
        <span style={{ fontSize: 14, color: '#666' }}>萃取SOP</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: WARN_COLOR }}>
          {loading ? '—' : `${stats?.sop_count ?? 0}条`}
        </span>
      </div>

      {/* 勇气值 */}
      <div style={{ padding: '8px 0', borderTop: '1px solid #F5F3EF' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 14, color: '#666' }}>今日勇气值</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>
            {loading ? '—' : `${stats?.courage_value ?? 0}/100`}
          </span>
        </div>
        <div style={{ width: '100%', height: 10, background: '#E8E0D6', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            width: `${couragePercent}%`, height: '100%', borderRadius: 99,
            background: BRAND_COLOR,
            transition: 'width 0.8s ease-out',
          }} />
        </div>
      </div>

      {/* 开始复盘按钮 */}
      {onStartReview && (
        <button
          onClick={onStartReview}
          style={{
            marginTop: 12, width: '100%', padding: '12px 0', fontSize: 15, fontWeight: 600,
            color: '#fff', background: BRAND_COLOR, border: 'none', borderRadius: 10,
            cursor: 'pointer', boxShadow: '0 2px 8px rgba(192,58,57,0.2)',
          }}
        >
          {buttonLabel ?? (hasData ? '继续复盘' : '开始复盘')}
        </button>
      )}
    </div>
  );
}
