/**
 * 成长记录条目 — 左侧彩色边框 + 日期 + 分类标签 + 内容 + 元数据。
 * 对齐 m3p3-mobile.html 原型，移动端和 PC 端共用。
 */
import { Icon } from '@iconify/react';
import type { GrowthRecord } from '../../../api/emotions';

const CATEGORY_CONFIG: Record<string, { borderCls: string; tagBg: string; tagColor: string; tagBorder: string }> = {
  '自我成长': { borderCls: '#FFCC80', tagBg: '#FFF3E0', tagColor: '#E65100', tagBorder: '#FFE0B2' },
  '情绪调节': { borderCls: '#C03A39', tagBg: '#FFEBEE', tagColor: '#C62828', tagBorder: '#FFCDD2' },
  '认知转化': { borderCls: '#9E9E9E', tagBg: '#F5F5F5', tagColor: '#616161', tagBorder: '#E0E0E0' },
};

interface GrowthEntryProps {
  record: GrowthRecord;
}

export function GrowthEntry({ record }: GrowthEntryProps) {
  const cat = CATEGORY_CONFIG[record.category] ?? CATEGORY_CONFIG['认知转化'];

  return (
    <div style={{
      background: '#fff', border: '1px solid #E8E0D6', borderRadius: 16,
      padding: 24, marginBottom: 16, position: 'relative', overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      {/* 左侧彩色边框 */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: 4, height: '100%',
        background: cat.borderCls,
      }} />

      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#999', fontWeight: 500 }}>
          <Icon icon="mingcute:time-line" width={14} color="#999" />
          {record.date}
        </div>
        <span style={{
          fontSize: 10, padding: '2px 8px', borderRadius: 4,
          background: cat.tagBg, color: cat.tagColor,
          border: `1px solid ${cat.tagBorder}`,
          fontWeight: 500, textTransform: 'uppercase' as const,
        }}>
          {record.category}
        </span>
      </div>

      <p style={{ fontSize: 14, color: '#555', lineHeight: 1.8, marginBottom: 12 }}>
        {record.content}
      </p>

      {record.tags && record.tags.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: '#999' }}>
          {record.tags.map((tag, idx) => (
            <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {tag.includes('勇气') ? <Icon icon="mingcute:fire-line" width={14} /> :
               tag.includes('小耕') ? <Icon icon="mingcute:message-line" width={14} /> :
               <Icon icon="mingcute:star-line" width={14} />}
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
