/**
 * 成长手册预览卡片 — 显示记录数和最近记录摘要。
 * 对齐 m3p1-mobile.html 原型，移动端和 PC 端共用。
 */
import type { ReactNode } from 'react';
import { Icon } from '@iconify/react';

interface GrowthPreviewProps {
  /** 记录总数 */
  count: number;
  /** 最近一条记录的摘要文本 */
  snippet?: string;
  /** 点击回调 */
  onClick?: () => void;
  /** 右侧箭头 */
  rightIcon?: ReactNode;
}

export function GrowthPreview({
  count,
  snippet,
  onClick,
  rightIcon = <Icon icon="mingcute:right-line" width={20} color="#d1d5db" />,
}: GrowthPreviewProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', background: '#fff', padding: 16, borderRadius: 16,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)', border: '1px solid #f3f4f6',
        marginBottom: 16, cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, background: '#FFF0E5',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#C03A39',
        }}>
          <Icon icon="mingcute:book-6-line" width={24} />
        </div>
        <div style={{ textAlign: 'left' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#2C1810', margin: 0 }}>成长手册</p>
          <p style={{
            fontSize: 10, color: '#9ca3af', margin: 0,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span>已积累</span>
            <span style={{ fontWeight: 600, color: '#2C1810' }}>{count}</span>
            <span>条记录</span>
          </p>
        </div>
      </div>
      {rightIcon}
    </button>
  );
}
