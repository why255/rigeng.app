/**
 * TaskCard — 可拖拽任务卡片（含编辑/完成/删除）。
 * 对齐 m1-p3.html 设计，新增内联编辑和状态管理。
 */
import { useState, useRef, useEffect } from 'react';
import type { PlanTask } from '@/api/plans';

interface TaskCardProps {
  task: PlanTask;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent, taskId: string) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onTouchStart?: (e: React.TouchEvent, taskId: string) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
  /** 切换完成状态 */
  onToggleComplete?: (taskId: string) => void;
  /** 更新任务标题 */
  onTitleChange?: (taskId: string, newTitle: string) => void;
  /** 删除任务 */
  onDelete?: (taskId: string) => void;
}

const SOURCE_LABELS: Record<string, string> = {
  user_input: '用户自述',
  yesterday_unfinished: '昨日未完成',
  smart_record_sync: '智能记录同步',
};

export function TaskCard({
  task, isDragging,
  onDragStart, onDragEnd, onTouchStart, onTouchEnd,
  onToggleComplete, onTitleChange, onDelete,
}: TaskCardProps) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const sourceLabel = SOURCE_LABELS[task.source] || '用户自述';
  const badgeClass =
    task.source === 'yesterday_unfinished' ? 'mp-task-item__badge--yesterday' :
    task.source === 'smart_record_sync' ? 'mp-task-item__badge--sync' :
    'mp-task-item__badge--user';
  const isCompleted = task.status === 'completed';

  const handleDoubleClick = () => {
    if (onTitleChange) {
      setEditTitle(task.title);
      setEditing(true);
    }
  };

  const handleSaveTitle = () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== task.title) {
      onTitleChange?.(task.id, trimmed);
    } else {
      setEditTitle(task.title);
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      setEditTitle(task.title);
      setEditing(false);
    }
  };

  return (
    <div
      className="mp-task-item"
      style={{
        ...(isDragging ? { opacity: 0.4 } : {}),
        ...(isCompleted ? { opacity: 0.6 } : {}),
      }}
      draggable={!editing}
      onDragStart={(e) => !editing && onDragStart?.(e, task.id)}
      onDragEnd={(e) => onDragEnd?.(e)}
      onTouchStart={(e) => !editing && onTouchStart?.(e, task.id)}
      onTouchEnd={(e) => onTouchEnd?.(e)}
      data-task-id={task.id}
    >
      {/* 完成勾选框 */}
      {onToggleComplete && (
        <button
          className={`mp-task-item__check ${isCompleted ? 'mp-task-item__check--done' : ''}`}
          onClick={(e) => { e.stopPropagation(); onToggleComplete(task.id); }}
          title={isCompleted ? '标记为未完成' : '标记为已完成'}
          style={{
            flexShrink: 0,
            width: 20, height: 20,
            borderRadius: '50%',
            border: `2px solid ${isCompleted ? '#4CAF50' : '#D4A574'}`,
            background: isCompleted ? '#4CAF50' : 'transparent',
            color: isCompleted ? '#fff' : 'transparent',
            fontSize: 12,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginRight: 8,
          }}
        >
          {isCompleted ? '✓' : ''}
        </button>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%', border: 'none', borderBottom: '1px solid #C03A39',
              outline: 'none', fontSize: 13, padding: '2px 0',
              background: 'transparent', color: '#333',
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            className="mp-task-item__title"
            style={{
              textDecoration: isCompleted ? 'line-through' : 'none',
              color: isCompleted ? '#999' : '#333',
              cursor: onTitleChange ? 'pointer' : 'default',
            }}
            onDoubleClick={handleDoubleClick}
            title={onTitleChange ? '双击编辑标题' : undefined}
          >
            {task.title}
          </div>
        )}
        <div className="mp-task-item__meta">
          <span className={`mp-task-item__badge ${badgeClass}`}>{sourceLabel}</span>
          {task.time_estimate && (
            <span style={{ fontSize: 10, color: '#999', marginLeft: 4 }}>{task.time_estimate}</span>
          )}
        </div>
      </div>

      {/* 删除按钮 */}
      {onDelete && (
        <button
          className="mp-task-item__delete"
          onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
          title="删除任务"
          style={{
            flexShrink: 0,
            width: 22, height: 22,
            borderRadius: '50%',
            border: 'none',
            background: 'transparent',
            color: '#ccc',
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginLeft: 4,
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#C03A39')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#ccc')}
        >
          ×
        </button>
      )}
    </div>
  );
}
