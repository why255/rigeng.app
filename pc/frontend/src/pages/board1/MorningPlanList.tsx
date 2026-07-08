/**
 * P3 计划列表页 — 四象限展示 + 拖拽调整。
 * Route: /m/morning-plan/list
 * 对齐 m1-p3.html 设计。
 */
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { useMorningPlan, type PlanItem } from './MorningPlanContext';
import type { Quadrant } from '@/shared/api/plans';
import './morning-plan.css';

interface QuadrantDef {
  key: Quadrant;
  label: string;
  labelColor: 'red' | 'gold' | 'blue' | 'gray';
}

const QUADRANTS: QuadrantDef[] = [
  { key: 'urgent_important',         label: '重要且紧急',   labelColor: 'red' },
  { key: 'not_urgent_important',     label: '重要不紧急',   labelColor: 'gold' },
  { key: 'urgent_not_important',     label: '紧急不重要',   labelColor: 'blue' },
  { key: 'not_urgent_not_important', label: '不重要不紧急', labelColor: 'gray' },
];

const QUADRANT_ID_MAP: Record<Quadrant, string> = {
  urgent_important: 'q1',
  not_urgent_important: 'q2',
  urgent_not_important: 'q3',
  not_urgent_not_important: 'q4',
};

export function MorningPlanList() {
  const navigate = useNavigate();
  const {
    plans, totalTasks, completedTasks, completionRate,
    deletePlan, updateQuadrant, toggleComplete, confirmAll,
  } = useMorningPlan();

  const [dragOverQuadrant, setDragOverQuadrant] = useState<Quadrant | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<number | null>(null);

  const getQuadrantTasks = (q: Quadrant) => plans.filter((p) => p.quadrant === q);

  // ── 拖拽处理 ──
  const handleDragStart = useCallback((_e: React.DragEvent, taskId: number) => {
    setDraggingTaskId(taskId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingTaskId(null);
    setDragOverQuadrant(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, quadrant: Quadrant) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverQuadrant(quadrant);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, quadrant: Quadrant) => {
      e.preventDefault();
      if (draggingTaskId !== null) {
        updateQuadrant(draggingTaskId, quadrant);
      }
      setDragOverQuadrant(null);
      setDraggingTaskId(null);
    },
    [draggingTaskId, updateQuadrant],
  );

  // ── 确认计划 → 完成页 ──
  const handleConfirm = () => {
    if (totalTasks === 0) {
      alert('还没有任何计划呢！先去对话页添加计划吧 📝');
      return;
    }
    const uncompleted = totalTasks - completedTasks;
    if (uncompleted > 0) {
      if (!window.confirm(`还有 ${uncompleted} 项计划未完成，确定要确认计划吗？`)) {
        return;
      }
    }
    confirmAll();
    navigate('/m/morning-plan/complete');
  };

  // ── 空状态 ──
  if (totalTasks === 0) {
    return (
      <div data-module="morning-plan">
        <div className="mp-page" style={{ textAlign: 'center' }}>
          <div className="mp-hero__slogan" style={{ marginBottom: 8 }}>日耕朝夕，耕愈工作，耕暖生活</div>
          <div className="mp-hero__divider" style={{ margin: '0 auto 24px' }} />
          <div style={{ padding: '48px 0' }}>
            <div style={{ color: '#D4A574', marginBottom: 16, opacity: 0.6 }}><Icon icon="mingcute:grid-line" width={40} /></div>
            <p style={{ color: '#999', marginBottom: 24, fontSize: 15 }}>暂无计划任务</p>
            <button
              className="mp-btn-primary"
              style={{ width: 'auto', padding: '12px 48px', display: 'inline-block' }}
              onClick={() => navigate('/m/morning-plan/chat')}
            >
              去规划
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-module="morning-plan">
      <div className="mp-page">
        {/* 品牌标语 */}
        <div style={{ marginBottom: 8 }}>
          <div className="mp-hero__slogan">日耕朝夕，耕愈工作，耕暖生活</div>
          <div className="mp-hero__divider" style={{ margin: '12px 0' }} />
        </div>

        {/* 进度条 + 标题 */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
            <h2 className="mp-hero__title--small" style={{ flex: 1 }}>晨起做规划，整日不慌忙</h2>
            <span style={{ fontSize: 12, color: '#999', fontWeight: 700, whiteSpace: 'nowrap' }}>
              今日计划完成率：{completionRate}%
            </span>
          </div>
          <div className="mp-progress-bar">
            <div className="mp-progress-bar__fill" style={{ width: `${completionRate}%` }} />
          </div>
          <p style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
            共 {totalTasks} 项计划，已完成 {completedTasks} 项
          </p>
        </div>

        {/* 四象限标题 */}
        <div className="mp-quadrant-header">
          <h3 className="mp-quadrant-header__title">
            <Icon icon="mingcute:grid-line" width={16} color="#D4A574" style={{ marginRight: 6 }} />计划四象限
          </h3>
          <span className="mp-quadrant-header__hint">拖拽调整优先级</span>
        </div>

        {/* 四象限网格 */}
        <div className="mp-quadrant-grid" style={{ marginBottom: 40 }}>
          {QUADRANTS.map((q) => {
            const quadrantTasks = getQuadrantTasks(q.key);
            const isDragOver = dragOverQuadrant === q.key;
            return (
              <div
                key={q.key}
                className="mp-quadrant-card"
                data-quadrant={q.key}
                id={QUADRANT_ID_MAP[q.key]}
                style={{
                  border: isDragOver ? '2px solid #C03A39' : quadrantTasks.length > 0 ? '2px solid #E8E0D6' : '2px dashed #E8E0D6',
                  ...(isDragOver ? { boxShadow: '0 0 0 2px rgba(192, 58, 57, 0.2)' } : {}),
                }}
                onDragOver={(e) => handleDragOver(e, q.key)}
                onDragLeave={() => setDragOverQuadrant(null)}
                onDrop={(e) => handleDrop(e, q.key)}
              >
                <div className={`mp-quadrant-label mp-quadrant-label--${q.labelColor}`}>
                  {q.label}
                </div>
                <div className="mp-quadrant-body">
                  {quadrantTasks.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      isDragging={draggingTaskId === task.id}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onToggle={() => toggleComplete(task.id)}
                      onDelete={() => {
                        if (window.confirm('确定要删除这条计划吗？')) {
                          deletePlan(task.id);
                        }
                      }}
                    />
                  ))}
                  {quadrantTasks.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#ccc', fontSize: 12, padding: 30 }}>
                      暂无任务
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 底部操作按钮 */}
        <div className="mp-actions">
          <button className="mp-btn-secondary" onClick={() => navigate('/m/morning-plan/chat')}>
            ← 继续规划
          </button>
          <button
            className="mp-btn-primary"
            style={{ width: 'auto', padding: '12px 48px', display: 'inline-block' }}
            onClick={handleConfirm}
          >
            确认计划 ✓
          </button>
        </div>
      </div>
    </div>
  );
}

/** 可拖拽任务卡片 */
function TaskItem({
  task, isDragging,
  onDragStart, onDragEnd,
  onToggle, onDelete,
}: {
  task: PlanItem;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, taskId: number) => void;
  onDragEnd: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="mp-task-item"
      style={{
        ...(isDragging ? { opacity: 0.4 } : {}),
        ...(task.completed ? { opacity: 0.6 } : {}),
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      data-task-id={task.id}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
        {/* 完成勾选 */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          title={task.completed ? '标记为未完成' : '标记为已完成'}
          style={{
            flexShrink: 0, width: 20, height: 20, borderRadius: '50%',
            border: `2px solid ${task.completed ? '#4CAF50' : '#D4A574'}`,
            background: task.completed ? '#4CAF50' : 'transparent',
            color: task.completed ? '#fff' : 'transparent',
            fontSize: 12, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {task.completed ? '✓' : ''}
        </button>
        <span
          className="mp-task-item__title"
          style={{
            textDecoration: task.completed ? 'line-through' : 'none',
            color: task.completed ? '#999' : '#333',
          }}
        >
          {task.text}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {task.completed && (
          <span style={{ fontSize: 9, padding: '2px 10px', borderRadius: 4, background: '#D4EDDA', color: '#155724', whiteSpace: 'nowrap' }}>
            ✓ 已完成
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="删除"
          style={{
            background: 'none', border: 'none', color: '#ccc',
            cursor: 'pointer', fontSize: 14, padding: '2px 6px', borderRadius: 4,
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#C03A39')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#ccc')}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
