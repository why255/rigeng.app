/**
 * P3 四象限拖拽规划 — 跨容器拖拽 + 确认今日计划。
 * Route: /m/morning-plan/list
 * 对齐 m1p3 设计，使用 @dnd-kit/core 实现拖拽。
 * 共享组件 PlanBrandHero, PlanProgressBar, QuadrantBadge 从 shared 引用。
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useMorningPlan, type PlanItem } from '@/shared/context/MorningPlanContext';
import type { Quadrant } from '@/shared/api/plans';
import {
  QUADRANT_SHORT_LABELS,
  QUADRANT_COLORS,
} from '@/shared/utils/quadrantMapping';
import { PlanBrandHero, PlanProgressBar } from '@/shared/components/features/morning-plan';
import './morning-plan.css';

// ── Quadrant definitions ──────────────────────────────

const QUADRANTS: { key: Quadrant; label: string; colorClass: string; headerStyle: React.CSSProperties }[] = [
  { key: 'urgent_important', label: QUADRANT_SHORT_LABELS.urgent_important, colorClass: 'mp-quadrant-card__header--red', headerStyle: { color: QUADRANT_COLORS.urgent_important } },
  { key: 'not_urgent_important', label: QUADRANT_SHORT_LABELS.not_urgent_important, colorClass: 'mp-quadrant-card__header--gold', headerStyle: { color: QUADRANT_COLORS.not_urgent_important } },
  { key: 'urgent_not_important', label: QUADRANT_SHORT_LABELS.urgent_not_important, colorClass: 'mp-quadrant-card__header--blue', headerStyle: { color: QUADRANT_COLORS.urgent_not_important } },
  { key: 'not_urgent_not_important', label: QUADRANT_SHORT_LABELS.not_urgent_not_important, colorClass: 'mp-quadrant-card__header--gray', headerStyle: { color: QUADRANT_COLORS.not_urgent_not_important } },
];

// ── Draggable Task Card ──────────────────────────────

function DraggableTask({ plan }: { plan: PlanItem }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: plan.id, data: { plan } });

  return (
    <div
      ref={setNodeRef}
      className={`mp-task-item ${isDragging ? 'mp-task-item--dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), opacity: isDragging ? 0.5 : 1, cursor: isDragging ? 'grabbing' : 'grab' }}
      {...listeners} {...attributes}
    >
      <span>{plan.text}</span>
    </div>
  );
}

// ── Droppable Quadrant ────────────────────────────────

function DroppableQuadrant({ quadrant, label, colorClass, headerStyle, plans }: {
  quadrant: Quadrant; label: string; colorClass: string; headerStyle: React.CSSProperties; plans: PlanItem[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: quadrant });

  return (
    <div ref={setNodeRef} className={`mp-quadrant-card ${plans.length > 0 ? 'has-items' : ''} ${isOver ? 'mp-quadrant-card--over' : ''}`}>
      <div className={`mp-quadrant-card__header ${colorClass}`} style={headerStyle}>
        {label} ({plans.length})
      </div>
      {plans.length === 0 ? (
        <div className="mp-quadrant-card__empty">拖拽任务到这里</div>
      ) : (
        plans.map((p) => <DraggableTask key={p.id} plan={p} />)
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────

export function MorningPlanList() {
  const navigate = useNavigate();
  const { plans, updateQuadrant, confirmAll, getStats } = useMorningPlan();
  const stats = getStats();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const grouped = useMemo(() => {
    const result: Record<Quadrant, PlanItem[]> = {
      urgent_important: [], not_urgent_important: [], urgent_not_important: [], not_urgent_not_important: [],
    };
    for (const p of plans) { if (result[p.quadrant]) result[p.quadrant].push(p); }
    return result;
  }, [plans]);

  const handleDragStart = (event: DragStartEvent) => { setActiveId(event.active.id as string); };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const planId = active.id as string;
    const targetQuadrant = over.id as Quadrant;
    const plan = plans.find((p) => p.id === planId);
    if (plan && plan.quadrant !== targetQuadrant) updateQuadrant(planId, targetQuadrant);
  };

  const handleConfirm = () => { if (plans.length > 0) { confirmAll(); navigate('/m/morning-plan/home'); } };

  // ── Empty state ──
  if (plans.length === 0) {
    return (
      <div className="mp-mobile-page">
        <header className="mp-mobile-page__header" style={{ height: 48 }}>
          <button className="mp-header-btn" onClick={() => navigate(-1)}><Icon icon="mingcute:arrow-left-fill" style={{ fontSize: '24px' }} /></button>
          <span className="font-zcool" style={{ fontSize: '18px', fontWeight: 700, color: '#C03A39' }}>四象限规划</span>
          <div className="mp-header-spacer" />
        </header>
        <main className="mp-main-scroll">
          <div className="mp-main-padding" style={{ textAlign: 'center' }}>
            <div style={{ padding: '48px 0' }}>
              <Icon icon="mingcute:layout-line" style={{ fontSize: '40px', color: '#D4A574', opacity: 0.6, marginBottom: 16 }} />
              <p style={{ color: '#999', marginBottom: 24, fontSize: 15 }}>暂无计划任务</p>
              <button className="mp-btn-primary" style={{ width: 'auto', display: 'inline-block', padding: '12px 48px' }} onClick={() => navigate('/m/morning-plan/chat')}>去规划</button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="mp-mobile-page">
      <header className="mp-mobile-page__header" style={{ height: 48 }}>
        <button className="mp-header-btn" onClick={() => navigate(-1)}><Icon icon="mingcute:arrow-left-fill" style={{ fontSize: '24px' }} /></button>
        <span className="font-zcool" style={{ fontSize: '18px', fontWeight: 700, color: '#C03A39' }}>四象限规划</span>
        <div className="mp-header-spacer" />
      </header>

      <main className="mp-main-scroll">
        <div className="mp-main-padding">
          {/* Brand + Progress */}
          <PlanBrandHero />

          <div style={{ marginBottom: 24 }}>
            <div className="mp-quadrant-header">
              <h3 className="mp-quadrant-header__title">
                <Icon icon="mingcute:layout-line" style={{ fontSize: '16px', color: '#D4A574', marginRight: 6 }} />
                计划四象限
              </h3>
              <span className="mp-quadrant-header__hint">拖拽调整优先级</span>
            </div>
            <PlanProgressBar completed={stats.completed} total={stats.total} />
            <p style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
              共 {stats.total} 项计划，已完成 {stats.completed} 项
            </p>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="mp-quadrant-grid" style={{ marginBottom: 40 }}>
              {QUADRANTS.map(({ key, label, colorClass, headerStyle }) => (
                <DroppableQuadrant key={key} quadrant={key} label={label} colorClass={colorClass} headerStyle={headerStyle} plans={grouped[key]} />
              ))}
            </div>
          </DndContext>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button className="mp-btn-outline" onClick={() => navigate(-1)}>
              <Icon icon="mingcute:arrow-left-fill" style={{ fontSize: '14px', verticalAlign: 'middle', marginRight: 4 }} />继续规划
            </button>
            <button className="mp-btn-primary" onClick={handleConfirm}>
              <Icon icon="mingcute:check-fill" style={{ fontSize: '16px', verticalAlign: 'middle', marginRight: 4 }} />确认今日计划
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
