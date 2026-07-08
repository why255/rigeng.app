/**
 * 暮有复盘 · 昨日复盘摘要卡片。
 * 移动端和 PC 端共用。
 */
import type { YesterdayReviewSummary } from '../../../api/reviews';

interface YesterdaySummaryCardProps {
  yesterday: YesterdayReviewSummary | null;
  loading?: boolean;
  /** 点击查看报告的回调 */
  onViewReport?: () => void;
  /** 是否显示"查看报告"按钮 */
  showViewReport?: boolean;
}

export function YesterdaySummaryCard({
  yesterday,
  loading = false,
  onViewReport,
  showViewReport = true,
}: YesterdaySummaryCardProps) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: 20, marginBottom: 16,
      border: '1px solid #E8E0D6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
      }}>
        <span style={{ fontSize: 20, color: '#999' }}>📄</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#999' }}>昨日复盘摘要</span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '16px 0', color: '#999', fontSize: 14 }}>
          加载中…
        </div>
      ) : yesterday && yesterday.archived ? (
        <div style={{ padding: '4px 0' }}>
          <p style={{ fontSize: 14, color: '#333', margin: '0 0 4px', lineHeight: 1.5 }}>
            {yesterday.sop_title || '完成复盘'}
          </p>
          <p style={{ fontSize: 12, color: '#999', margin: 0 }}>
            完成率 {yesterday.completion_rate} · 勇气值 {yesterday.courage_value}
            {yesterday.date ? ` · ${yesterday.date}` : ''}
          </p>
          {showViewReport && onViewReport && (
            <button
              onClick={onViewReport}
              style={{
                marginTop: 12, padding: '6px 16px', fontSize: 12, fontWeight: 500,
                color: '#C03A39', background: 'transparent', border: '1px solid #C03A39',
                borderRadius: 8, cursor: 'pointer',
              }}
            >
              查看报告
            </button>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <span style={{ fontSize: 32, color: '#ccc', marginBottom: 8, display: 'block' }}>📋</span>
          <p style={{ fontSize: 14, color: '#999', margin: 0 }}>暂无复盘记录</p>
        </div>
      )}
    </div>
  );
}
