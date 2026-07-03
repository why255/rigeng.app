/**
 * ConfirmDialog — 确认弹窗组件。
 * 对齐 m1-p5.html 中 modal-overlay / modal-dialog 样式。
 */
import { useEffect } from 'react';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // 阻止背景滚动
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 bg-black/50 z-[100] flex items-center justify-center"
      style={{ animation: 'fadeIn 0.25s ease-out' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="bg-white rounded-[20px] p-6 pb-5 w-[280px] text-center shadow-2xl"
        style={{ animation: 'scaleIn 0.25s ease-out' }}
      >
        <h3 className="text-base font-semibold text-[#333] mb-1.5">{title}</h3>
        <p className="text-[13px] text-[#666] mb-[18px] leading-relaxed">{message}</p>
        <div className="flex gap-2.5">
          <button
            className="flex-1 py-2.5 rounded-[25px] text-sm font-medium bg-[#f0f0f0] text-[#666] active:bg-[#e0e0e0] transition-colors"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            className="flex-1 py-2.5 rounded-[25px] text-sm font-medium bg-[#C03A39] text-white active:bg-[#A0302E] transition-colors"
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
