/**
 * 暮有复盘 · 历史复盘记录卡片。
 * 移动端和 PC 端共用。
 */
import type { ReviewHistoryItem } from '../../../api/reviews';

interface HistoryCardProps {
  item: ReviewHistoryItem;
  onClick?: (item: ReviewHistoryItem) => void;
}

export function HistoryCard({ item, onClick }: HistoryCardProps) {
  return (
    <div
      onClick={() => onClick?.(item)}
      style={{
        background: '#fff', borderRadius: 12, padding: 20, marginBottom: 12,
        border: '1px solid #E8E0D6', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {/* 日期 + 状态 */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8,
      }}>
        <span style={{ fontSize: 14, color: '#666' }}>{item.date} {item.day_of_week}</span>
        <span style={{
          fontSize: 14, fontWeight: 500,
          color: item.status === 'completed' ? '#22C55E' : '#F87171',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {item.status === 'completed' ? (
            <><span style={{ fontSize: 16 }}>✓</span>已完成</>
          ) : (
            <><span style={{ fontSize: 16 }}>✗</span>未复盘</>
          )}
        </span>
      </div>

      {/* SOP 标题 + 质量评分 */}
      {item.status === 'completed' && item.sop_title ? (
        <>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#333', marginBottom: 8 }}>
            {item.sop_title}
          </div>
          {item.quality_score !== undefined && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 14 }}>
              {Array.from({ length: 5 }, (_, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 14,
                    color: i < item.quality_score! ? '#FFB74D' : '#E8E0D6',
                  }}
                >
                  {i < item.quality_score! ? '★' : '☆'}
                </span>
              ))}
              <span style={{ fontSize: 12, color: '#999', marginLeft: 8 }}>复盘质量</span>
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 14, color: '#999', fontStyle: 'italic' }}>当天未完成复盘</div>
      )}
    </div>
  );
}
