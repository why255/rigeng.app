/**
 * PlanQuadrantGrid — 四象限任务网格（可拖拽）。
 * 纯 BEM 类名 + 内联 style，无 Tailwind。
 */
import { useMorningPlan, type PlanItem } from '@rigeng/shared/context/MorningPlanContext';
import type { Quadrant } from '@rigeng/shared/api/plans';
import {
  QUADRANT_SHORT_LABELS,
  QUADRANT_COLORS,
} from '@rigeng/shared/utils/quadrantMapping';

const QUADRANTS: { key: Quadrant; label: string; colorClass: string }[] = [
  { key: 'urgent_important', label: '重要且紧急', colorClass: 'mp-quadrant-card__header--red' },
  { key: 'not_urgent_important', label: '重要不紧急', colorClass: 'mp-quadrant-card__header--gold' },
  { key: 'urgent_not_important', label: '紧急不重要', colorClass: 'mp-quadrant-card__header--blue' },
  { key: 'not_urgent_not_important', label: '不重要不紧急', colorClass: 'mp-quadrant-card__header--gray' },
];

export function PlanQuadrantGrid() {
  const { plans, updateQuadrant, deletePlan } = useMorningPlan();

  const grouped: Record<Quadrant, PlanItem[]> = {
    urgent_important: [],
    not_urgent_important: [],
    urgent_not_important: [],
    not_urgent_not_important: [],
  };
  for (const p of plans) {
    if (grouped[p.quadrant]) grouped[p.quadrant].push(p);
  }

  return (
    <div className="mp-quadrant-grid">
      {QUADRANTS.map(({ key, label, colorClass }) => {
        const items = grouped[key];
        return (
          <div key={key} className={`mp-quadrant-card ${items.length > 0 ? 'has-items' : ''}`}>
            <div className={`mp-quadrant-card__header ${colorClass}`}>{label} ({items.length})</div>
            {items.length === 0 ? (
              <div className="mp-quadrant-card__empty">拖拽任务到这里</div>
            ) : (
              items.map((p) => (
                <div
                  key={p.id}
                  className="mp-task-item"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', p.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); updateQuadrant(p.id, key); }}
                >
                  <span>{p.text}</span>
                  <button className="mp-task-item__delete" onClick={() => deletePlan(p.id)}>×</button>
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}
