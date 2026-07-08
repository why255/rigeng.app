/**
 * 智能记录 · 今日统计卡片。
 * 移动端和 PC 端共用。
 */
import { Icon } from '@iconify/react'

interface RecordStatsCardProps {
  todayCount: number;
  totalMinutes: number;
  compact?: boolean;
}

export function RecordStatsCard({ todayCount, totalMinutes, compact = false }: RecordStatsCardProps) {
  return (
    <div style={{
      display: 'flex',
      gap: 12,
      marginBottom: compact ? 12 : 16,
    }}>
      <div style={{
        flex: 1,
        background: '#FFFFFF',
        borderRadius: 12,
        padding: compact ? 12 : 16,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: compact ? 6 : 8 }}>
          <Icon icon="mingcute:mic-line" style={{ fontSize: 18, color: '#C03A39' }} />
          <span style={{ fontSize: 12, color: '#999' }}>今日录音数</span>
        </div>
        <p style={{ fontSize: compact ? 22 : 24, fontWeight: 700, color: '#333', margin: 0 }}>
          {todayCount} <span style={{ fontSize: 12, fontWeight: 400, color: '#999' }}>段</span>
        </p>
      </div>
      <div style={{
        flex: 1,
        background: '#FFFFFF',
        borderRadius: 12,
        padding: compact ? 12 : 16,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: compact ? 6 : 8 }}>
          <Icon icon="mingcute:time-line" style={{ fontSize: 18, color: '#D4A574' }} />
          <span style={{ fontSize: 12, color: '#999' }}>总时长</span>
        </div>
        <p style={{ fontSize: compact ? 22 : 24, fontWeight: 700, color: '#333', margin: 0 }}>
          {totalMinutes} <span style={{ fontSize: 12, fontWeight: 400, color: '#999' }}>分钟</span>
        </p>
      </div>
    </div>
  );
}
