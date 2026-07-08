/**
 * 象限映射工具 — 标签、颜色、排序顺序。
 * 后端/共享代码使用 snake_case 象限键名。
 */
import type { Quadrant } from '@/api/plans';

// ── 显示标签 ──────────────────────────────────────────

/** 完整中文标签（EisenhowerMatrix 使用） */
export const QUADRANT_LABELS: Record<Quadrant, string> = {
  urgent_important: '重要且紧急',
  not_urgent_important: '重要不紧急',
  urgent_not_important: '紧急不重要',
  not_urgent_not_important: '不重要不紧急',
};

/** 简短中文标签（移动端象限卡片使用） */
export const QUADRANT_SHORT_LABELS: Record<Quadrant, string> = {
  urgent_important: '重要紧急',
  not_urgent_important: '重要不紧急',
  urgent_not_important: '紧急不重要',
  not_urgent_not_important: '不重要不紧急',
};

/** 紧急程度排序（P1 待办列表按此顺序排列） */
export const QUADRANT_URGENCY_ORDER: Quadrant[] = [
  'urgent_important',
  'not_urgent_important',
  'urgent_not_important',
  'not_urgent_not_important',
];

// ── 颜色映射 ──────────────────────────────────────────

export const QUADRANT_COLORS: Record<Quadrant, string> = {
  urgent_important: '#C03A39',
  not_urgent_important: '#D4A574',
  urgent_not_important: '#6B8FBF',
  not_urgent_not_important: '#999',
};

export const QUADRANT_BG_COLORS: Record<Quadrant, string> = {
  urgent_important: '#FFF0F0',
  not_urgent_important: '#FFF8F0',
  urgent_not_important: '#F0F5FF',
  not_urgent_not_important: '#F5F5F5',
};

// ── 排序辅助 ──────────────────────────────────────────

/** 按紧急程度排序：重要紧急 → 重要不紧急 → 紧急不重要 → 不重要不紧急 */
export function sortPlansByUrgency<T extends { quadrant: Quadrant }>(items: T[]): T[] {
  const orderMap: Record<string, number> = {
    urgent_important: 0,
    not_urgent_important: 1,
    urgent_not_important: 2,
    not_urgent_not_important: 3,
  };
  return [...items].sort((a, b) => (orderMap[a.quadrant] ?? 99) - (orderMap[b.quadrant] ?? 99));
}
