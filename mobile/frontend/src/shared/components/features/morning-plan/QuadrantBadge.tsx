/**
 * 朝有规划 · 象限标签 Badge。
 * 移动端和 PC 端共用。
 */

export type PlanQuadrant = 'urgent_important' | 'not_urgent_important' | 'urgent_not_important' | 'not_urgent_not_important';

const LABELS: Record<PlanQuadrant, string> = {
  urgent_important: '重要紧急',
  not_urgent_important: '重要不紧急',
  urgent_not_important: '紧急不重要',
  not_urgent_not_important: '不重要不紧急',
};

const SHORT_LABELS: Record<PlanQuadrant, string> = {
  urgent_important: '重要紧急',
  not_urgent_important: '重要不紧急',
  urgent_not_important: '紧急不重要',
  not_urgent_not_important: '不重要不紧急',
};

const COLORS: Record<PlanQuadrant, string> = {
  urgent_important: '#C03A39',
  not_urgent_important: '#D4A574',
  urgent_not_important: '#6B8FBF',
  not_urgent_not_important: '#999',
};

interface QuadrantBadgeProps {
  quadrant: PlanQuadrant;
  /** 使用短标签 */
  short?: boolean;
}

export function QuadrantBadge({ quadrant, short = true }: QuadrantBadgeProps) {
  const label = short ? SHORT_LABELS[quadrant] : LABELS[quadrant];
  const color = COLORS[quadrant];
  return (
    <span style={{
      fontSize: 10, padding: '2px 8px', borderRadius: 10,
      background: `${color}15`, color, fontWeight: 500,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}

export { LABELS as QUADRANT_LABELS, SHORT_LABELS as QUADRANT_SHORT_LABELS, COLORS as QUADRANT_COLORS };
