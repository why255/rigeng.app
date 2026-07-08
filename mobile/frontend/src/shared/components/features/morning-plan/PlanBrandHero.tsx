/**
 * 朝有规划 · 品牌标语 Hero 区。
 * 对齐 m1p*.html 原型，移动端和 PC 端共用。
 */
import type { ReactNode } from 'react';

interface PlanBrandHeroProps {
  /** 主标题 */
  title?: string;
  /** 副标题 */
  subtitle?: string;
  /** 是否显示分割线 */
  divider?: boolean;
  /** 额外内容 */
  children?: ReactNode;
}

const BRAND_SLOGAN = '日耕朝夕，耕愈工作，耕暖生活';

export function PlanBrandHero({
  title = '晨起做规划，整日不慌忙',
  subtitle,
  divider = false,
  children,
}: PlanBrandHeroProps) {
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
          fontSize: 17, fontWeight: 700, color: '#333', marginBottom: subtitle ? 4 : 0,
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
