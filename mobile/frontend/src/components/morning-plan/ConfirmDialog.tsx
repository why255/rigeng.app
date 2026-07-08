/**
 * ConfirmDialog — 确认弹窗组件。
 * 纯 BEM 类名 + 内联 style，无 Tailwind。
 */
import { Icon } from '@iconify/react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, confirmText = '确认', cancelText = '取消', onConfirm, onCancel }: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="mp-modal-overlay" onClick={onCancel}>
      <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
        <Icon icon="mingcute:question-fill" className="mp-modal-icon" />
        <h3 className="mp-modal-title">{title}</h3>
        <p className="mp-modal-text">{message}</p>
        <div className="mp-modal-actions">
          <button className="mp-btn-outline" style={{ flex: 1, padding: '12px 0' }} onClick={onCancel}>{cancelText}</button>
          <button className="mp-btn-primary" style={{ flex: 1, padding: '12px 0' }} onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}
