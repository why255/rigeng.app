/**
 * 朝有规划 · 确认对话框。
 * 移动端和 PC 端共用。
 */
import type { ReactNode } from 'react';

interface PlanConfirmDialogProps {
  open: boolean;
  title?: string;
  message?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PlanConfirmDialog({
  open,
  title = '确认',
  message,
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  onCancel,
}: PlanConfirmDialogProps) {
  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onCancel}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '24px 20px 20px',
        width: 280, textAlign: 'center',
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{
          fontSize: 18, fontWeight: 700, color: '#333', marginBottom: 8,
        }}>
          {title}
        </div>
        {message && (
          <div style={{ fontSize: 14, color: '#666', marginBottom: 24, lineHeight: 1.6 }}>
            {message}
          </div>
        )}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '12px 0', background: '#f5f5f5',
              color: '#666', border: 'none', borderRadius: 10,
              fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1, padding: '12px 0', background: '#C03A39',
              color: '#fff', border: 'none', borderRadius: 10,
              fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
