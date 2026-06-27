/**
 * EisenhowerMatrix — 四象限矩阵（艾森豪威尔矩阵）。
 * 对齐 m1-p3.html 设计。
 *
 * 支持 HTML5 拖拽（PC）和 Touch 事件（手机）。
 * 新增：内联编辑、完成切换、删除。
 */
import { useState, useCallback, useRef } from 'react';
import type { PlanTask, Quadrant } from '@/api/plans';
import { TaskCard } from './TaskCard';

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

interface EisenhowerMatrixProps {
  tasks: PlanTask[];
  onTaskMove: (taskId: string, newQuadrant: Quadrant) => void;
  onToggleComplete?: (taskId: string) => void;
  onTitleChange?: (taskId: string, newTitle: string) => void;
  onDelete?: (taskId: string) => void;
}

export function EisenhowerMatrix({
  tasks, onTaskMove, onToggleComplete, onTitleChange, onDelete,
}: EisenhowerMatrixProps) {
  const [dragOverQuadrant, setDragOverQuadrant] = useState<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [touchDragging, setTouchDragging] = useState<string | null>(null);
  const touchTargetRef = useRef<string | null>(null);

  const getQuadrantTasks = (quadrant: Quadrant) =>
    tasks.filter((t) => t.quadrant === quadrant);

  const handleDragStart = useCallback((_e: React.DragEvent, taskId: string) => {
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

  const handleDragLeave = useCallback(() => {
    setDragOverQuadrant(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, quadrant: Quadrant) => {
      e.preventDefault();
      const taskId = draggingTaskId;
      if (taskId) {
        onTaskMove(taskId, quadrant);
      }
      setDragOverQuadrant(null);
      setDraggingTaskId(null);
    },
    [draggingTaskId, onTaskMove],
  );

  const handleTouchStart = useCallback((_e: React.TouchEvent, taskId: string) => {
    setTouchDragging(taskId);
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchDragging) return;
      const touch = e.touches[0];
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      if (el) {
        const quadrantEl = el.closest('[data-quadrant]');
        if (quadrantEl) {
          touchTargetRef.current = quadrantEl.getAttribute('data-quadrant');
        }
      }
    },
    [touchDragging],
  );

  const handleTouchEnd = useCallback(() => {
    if (touchDragging && touchTargetRef.current) {
      onTaskMove(touchDragging, touchTargetRef.current as Quadrant);
    }
    setTouchDragging(null);
    touchTargetRef.current = null;
  }, [touchDragging, onTaskMove]);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const rate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div>
      {/* 进度条 */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
          <h2 className="mp-hero__title--small" style={{ flex: 1 }}>晨起做规划，整日不慌忙</h2>
          <span style={{ fontSize: 12, color: '#C03A39', fontWeight: 700, whiteSpace: 'nowrap' }}>
            今日计划完成率：{rate}%
          </span>
        </div>
        <div className="mp-progress-bar">
          <div className="mp-progress-bar__fill" style={{ width: `${rate}%` }} />
        </div>
      </div>

      {/* 四象限标题 */}
      <div className="mp-quadrant-header">
        <h3 className="mp-quadrant-header__title">
          <span style={{ color: '#D4A574' }}>▦</span> 计划四象限
        </h3>
        <span className="mp-quadrant-header__hint">
          拖拽调整优先级 · 双击编辑 · 点击圆圈标记完成
        </span>
      </div>

      {/* 四象限网格 */}
      <div className="mp-quadrant-grid" onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        {QUADRANTS.map((q) => {
          const quadrantTasks = getQuadrantTasks(q.key);
          const isDragOver = dragOverQuadrant === q.key;
          return (
            <div
              key={q.key}
              className="mp-quadrant-card"
              data-quadrant={q.key}
              style={isDragOver ? { boxShadow: '0 0 0 2px #C03A39', borderColor: '#C03A39' } : {}}
              onDragOver={(e) => handleDragOver(e, q.key)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, q.key)}
            >
              <div className={`mp-quadrant-label mp-quadrant-label--${q.labelColor}`}>
                {q.label}
                <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 6 }}>
                  ({quadrantTasks.length})
                </span>
              </div>
              <div className="mp-quadrant-body">
                {quadrantTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isDragging={draggingTaskId === task.id}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onTouchStart={handleTouchStart}
                    onToggleComplete={onToggleComplete}
                    onTitleChange={onTitleChange}
                    onDelete={onDelete}
                  />
                ))}
                {quadrantTasks.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#ccc', fontSize: 10, padding: 20 }}>
                    拖拽任务到此处
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
