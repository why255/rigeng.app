/**
 * 安全承诺语气泡 — 小耕 avatar + 对话框。
 * 对齐 m3p1-mobile.html 原型，移动端和 PC 端共用。
 */
import type { ReactNode } from 'react';
import { Icon } from '@iconify/react';

interface SafetyBubbleProps {
  /** 头像显示名 */
  name?: string;
  /** 气泡内文字 */
  children: ReactNode;
  /** 头像图标 */
  avatarIcon?: string;
  /** 是否深色主题 */
  dark?: boolean;
}

export function SafetyBubble({
  name = '小耕',
  children,
  avatarIcon = 'mingcute:face-line',
  dark = false,
}: SafetyBubbleProps) {
  const bg = dark
    ? { avatar: '#3a3a5c', bubble: '#2d2d44', border: '#3a3a5c', text: '#B0B0B0', strong: '#E0E0E0' }
    : { avatar: '#FFF0E5', bubble: '#FFF0E5', border: '#FFE0D0', text: '#555', strong: '#333' };

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 24 }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%', background: bg.avatar,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon icon={avatarIcon} width={20} color={dark ? '#B0B0B0' : '#C03A39'} />
      </div>
      <div style={{
        background: bg.bubble, border: `1px solid ${bg.border}`,
        borderRadius: '16px 16px 16px 0', padding: 20, maxWidth: '80%',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
        }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: dark ? 'rgba(255,204,128,0.15)' : '#FFCC80',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon icon={avatarIcon} width={14} color={dark ? '#FFCC80' : '#333'} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: bg.strong }}>{name}</span>
        </div>
        <div style={{ color: bg.text, lineHeight: 1.7, fontSize: 14 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
