/**
 * 情绪历史记录列表 — 带情绪图标、日期、时长、成长记录数。
 * 对齐 m3p4-mobile.html 原型，移动端和 PC 端共用。
 */
import type { ReactNode } from 'react';
import { Icon } from '@iconify/react';
import type { EmotionDaySummary } from '../../../api/emotions';

const MOOD_ICON: Record<string, string> = {
  '开心': 'mingcute:emotion-happy-line', '喜悦': 'mingcute:emotion-happy-fill', '振奋': 'mingcute:fire-line',
  '平静': 'mingcute:emotion-2-line', '平和': 'mingcute:sun-line',
  '疲惫': 'mingcute:sleep-line', '累': 'mingcute:emotion-sad-line',
  '委屈': 'mingcute:emotion-sad-line', '难过': 'mingcute:cry-line', '焦虑': 'mingcute:alert-line', '沮丧': 'mingcute:emotion-sad-fill',
};

function getEmojiBg(mood: string): string {
  const negative = ['委屈', '难过', '焦虑', '沮丧', '悲伤', '愤怒'];
  const neutral = ['疲惫', '累'];
  if (negative.includes(mood)) return '#FFEBEE';
  if (neutral.includes(mood)) return '#FFF3E0';
  return '#E8F5E9';
}

interface HistoryListProps {
  items: EmotionDaySummary[];
  loading?: boolean;
  /** 空状态内容 */
  emptyState?: ReactNode;
  /** 点击某一项 */
  onItemClick?: (item: EmotionDaySummary, index: number) => void;
}

export function HistoryList({ items, loading = false, emptyState, onItemClick }: HistoryListProps) {
  if (loading) {
    return <div style={{ textAlign: 'center', padding: '24px 0', color: '#999' }}>加载中…</div>;
  }

  if (items.length === 0) {
    return <>{emptyState || <DefaultEmptyState />}</>;
  }

  return (
    <div style={{
      background: '#fff', border: '1px solid #E8E0D6', borderRadius: 16,
      overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {items.map((item, idx) => (
        <div
          key={idx}
          onClick={() => onItemClick?.(item, idx)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px', cursor: onItemClick ? 'pointer' : 'default',
            transition: 'background 0.2s',
            borderBottom: idx < items.length - 1 ? '1px solid #f5f5f5' : 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: getEmojiBg(item.mood),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {MOOD_ICON[item.mood]
                ? <Icon icon={MOOD_ICON[item.mood]} width={20} />
                : <Icon icon="mingcute:emotion-2-line" width={20} />}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{
                fontSize: 14, fontWeight: 700,
                color: ['委屈', '难过', '焦虑', '沮丧', '悲伤', '愤怒'].includes(item.mood) ? '#C03A39' : '#333',
              }}>
                {item.date} · {item.mood}
              </span>
              <span style={{ fontSize: 12, color: '#999' }}>
                倾诉时长：{item.duration_minutes}分钟
                {item.growth_record_count > 0
                  ? ` | 生成 ${item.growth_record_count} 条成长记录`
                  : ' | 暂无成长记录'}
              </span>
            </div>
          </div>
          <span style={{ color: '#ddd', fontSize: 18 }}>
            <Icon icon="mingcute:right-line" width={18} />
          </span>
        </div>
      ))}
    </div>
  );
}

function DefaultEmptyState() {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: 32,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)', textAlign: 'center',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', background: '#f9fafb',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon icon="mingcute:time-line" width={32} color="#d1d5db" />
        </div>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#333', margin: '0 0 4px' }}>暂无历史记录</p>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 0' }}>每一次倾诉都会被记录在这里</p>
        </div>
      </div>
    </div>
  );
}
