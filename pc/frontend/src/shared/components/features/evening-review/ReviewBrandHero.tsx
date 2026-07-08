/**
 * 暮有复盘 · 品牌标语 Hero 区。
 * 移动端和 PC 端共用。
 */
import type { ReactNode } from 'react';
import { BRAND_SLOGAN, BRAND_TITLE } from './review-constants';

interface ReviewBrandHeroProps {
  /** 主标题（默认使用 BRAND_TITLE） */
  title?: string;
  /** 副标题 */
  subtitle?: string;
  /** 是否显示分割线 */
  divider?: boolean;
  /** 标题字号 */
  titleSize?: number;
  /** 额外内容 */
  children?: ReactNode;
}

export function ReviewBrandHero({
  title = BRAND_TITLE,
  subtitle,
  divider = false,
  titleSize = 17,
  children,
}: ReviewBrandHeroProps) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 8 }}>
      <p style={{
        fontSize: 15, fontWeight: 700, color: '#333', marginBottom: 4,
        fontFamily: "'ZCOOL XiaoWei', '华文楷体', 'KaiTi', serif",
      }}>
        {BRAND_SLOGAN}
      </p>
      {divider && (
        <div style={{
          width: 40, height: 2, background: '#D4C5B0',
          margin: '8px auto 12px',
        }} />
      )}
      {title && (
        <p style={{
          fontSize: titleSize, fontWeight: 700, color: '#333',
          marginBottom: subtitle ? 4 : 0,
          fontFamily: "'ZCOOL XiaoWei', '华文楷体', 'KaiTi', serif",
        }}>
          {title}
        </p>
      )}
      {subtitle && (
        <p style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{subtitle}</p>
      )}
      {children}
    </div>
  );
}
