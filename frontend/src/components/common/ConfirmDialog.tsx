import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen || typeof document === 'undefined') {
    return null;
  }

  const confirmClass = variant === 'danger' ? 'button-danger' : 'button-primary';
  const hasUndoCopy = (description || '').toLowerCase().includes('cannot be undone');

  const dialog = (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="card relative w-full max-w-md">
        <div className="pb-4 border-b border-neutral-200 dark:border-neutral-700">
          <h2 className="text-heading-3">{title}</h2>
        </div>
        {description && (
          <p className="pt-4 text-sm text-neutral-600 dark:text-neutral-400">{description}</p>
        )}
        {variant === 'danger' && !hasUndoCopy && (
          <p className="pt-2 text-sm text-neutral-600 dark:text-neutral-400">This action cannot be undone.</p>
        )}
        <div className="modal-actions">
          <button type="button" onClick={onCancel} className="button-secondary button-center">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} className={`${confirmClass} button-center`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
