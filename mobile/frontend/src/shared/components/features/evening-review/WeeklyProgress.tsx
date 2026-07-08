/**
 * 暮有复盘 · 本周复盘进度展示。
 * 移动端和 PC 端共用。
 *
 * 移动端：显示圆点指示器（小圆圈 + 星期标签）。
 * PC 端：显示甘特图风格（星期标签 + 进度条 + 状态文字）。
 */
import type { WeeklyProgress as WeeklyProgressType } from '../../../api/reviews';

interface WeeklyProgressProps {
  weekly: WeeklyProgressType | null;
  loading?: boolean;
  /** PC 端为 true（甘特图），移动端为 false（圆点） */
  compact?: boolean;
  /** 连续复盘天数（移动端用） */
  consecutiveDays?: number;
}

export function WeeklyProgress({
  weekly,
  loading = false,
  compact = false,
  consecutiveDays,
}: WeeklyProgressProps) {
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
        <span style={{ fontSize: 24, color: '#D4A574' }}>📅</span>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#333' }}>本周复盘进度</span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: '#999', fontSize: 14 }}>
          加载中…
        </div>
      ) : weekly ? (
        compact ? (
          /* 移动端：圆点指示器 */
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {weekly.days.map((d) => (
              <div key={d.day} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 16, height: 16, borderRadius: '50%',
                  background: d.status === 'completed' ? '#C03A39'
                    : d.status === 'in_progress' ? '#FFB74D'
                    : '#E8E0D6',
                }} />
                <span style={{ fontSize: 10, color: '#999' }}>{d.day}</span>
              </div>
            ))}
          </div>
        ) : (
          /* PC 端：甘特图 */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {weekly.days.map((d) => (
              <div key={d.day} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '6px 0',
              }}>
                <span style={{ fontSize: 13, color: '#666', width: 36, flexShrink: 0 }}>{d.day}</span>
                <div style={{
                  flex: 1, height: 8, background: '#E8E0D6', borderRadius: 99, overflow: 'hidden',
                }}>
                  {(d.status === 'completed' || d.status === 'in_progress') && d.completion_rate ? (
                    <div style={{
                      width: `${d.completion_rate}%`, height: '100%', borderRadius: 99,
                      background: d.status === 'completed' ? '#C03A39' : '#FFB74D',
                      transition: 'width 0.5s ease-out',
                    }} />
                  ) : null}
                </div>
                <span style={{
                  fontSize: 12, flexShrink: 0,
                  color: d.status === 'completed' ? '#22C55E'
                    : d.status === 'in_progress' ? '#FFB74D'
                    : '#999',
                }}>
                  {d.status === 'completed' ? '✓' : d.status === 'in_progress' ? '进行中' : '待复盘'}
                </span>
              </div>
            ))}
          </div>
        )
      ) : (
        <div style={{ textAlign: 'center', color: '#999', fontSize: 14, padding: '16px 0' }}>
          暂无本周数据
        </div>
      )}

      {/* 连续天数提示（移动端） */}
      {compact && consecutiveDays !== undefined && consecutiveDays > 0 && (
        <div style={{
          textAlign: 'center', marginTop: 16,
          background: '#FFF8F0', borderRadius: 8, padding: '10px 0',
        }}>
          <span style={{ fontSize: 14, color: '#333' }}>已连续复盘：</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#FFB74D' }}>{consecutiveDays}天</span>
        </div>
      )}
    </div>
  );
}
