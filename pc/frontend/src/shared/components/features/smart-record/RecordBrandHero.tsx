/**
 * 智能记录 · 品牌标语 Hero 区。
 * 移动端和 PC 端共用。
 */
import { BRAND_SLOGAN, BRAND_TITLE } from './record-constants';

interface RecordBrandHeroProps {
  /** 是否紧凑模式（移动端） */
  compact?: boolean;
}

export function RecordBrandHero({ compact = false }: RecordBrandHeroProps) {
  return (
    <div style={{ marginBottom: compact ? 16 : 24, textAlign: 'center' }}>
      <p style={{
        fontSize: compact ? 15 : 17, fontWeight: 700,
        color: '#333',
      }}>
        {BRAND_SLOGAN}
      </p>
      <p style={{
        fontSize: compact ? 15 : 17, fontWeight: 700,
        color: '#333',
      }}>
        {BRAND_TITLE}
      </p>
    </div>
  );
}
