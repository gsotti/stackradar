// Component Library - StackRadar UI 2026
// Shared components for consistent design system application

import React from 'react';

// ============================================================================
// MODAL / DIALOG COMPONENTS
// ============================================================================

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  showCloseButton?: boolean;
}

export function Modal({ isOpen, onClose, title, children, size = 'md', showCloseButton = true }: ModalProps) {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
  };

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className={`card w-full ${sizeClasses[size]}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-heading-4">{title}</h2>
          {showCloseButton && (
            <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 transition-colors">
              <span className="text-xl">×</span>
            </button>
          )}
        </div>
        <div className="text-body">{children}</div>
      </div>
    </div>
  );
}

// ============================================================================
// DROPDOWN / SELECT COMPONENTS
// ============================================================================

interface DropdownItem {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface DropdownProps {
  items: DropdownItem[];
  value?: string | number;
  onChange: (value: string | number) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function Dropdown({ items, value, onChange, label, placeholder = 'Select...', disabled = false }: DropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedItem = items.find(item => item.value === value);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {label && <label className="block text-label mb-2">{label}</label>}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="input-base w-full text-left flex items-center justify-between"
      >
        <span>{selectedItem?.label || placeholder}</span>
        <span className="text-neutral-400">▼</span>
      </button>
      {isOpen && (
        <div className="absolute top-full mt-2 w-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg z-50">
          {items.map(item => (
            <button
              key={item.value}
              onClick={() => {
                onChange(item.value);
                setIsOpen(false);
              }}
              disabled={item.disabled}
              className="w-full text-left px-4 py-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 flex items-center gap-2 transition-colors disabled:opacity-50 cursor-not-allowed"
            >
              {item.icon && <span>{item.icon}</span>}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TABLE COMPONENTS
// ============================================================================

interface TableColumn {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: any) => React.ReactNode;
}

interface TableProps {
  columns: TableColumn[];
  data: any[];
  loading?: boolean;
  striped?: boolean;
  hoverable?: boolean;
}

export function Table({ columns, data, loading = false, striped = true, hoverable = true }: TableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary-500"></div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center p-8 text-neutral-500 dark:text-neutral-400">
        <p className="text-body-secondary">No data available</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                className="px-4 py-3 text-left font-semibold text-neutral-900 dark:text-white"
                style={{ textAlign: col.align || 'left', width: col.width }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={idx}
              className={`border-b border-neutral-200 dark:border-neutral-700/50 transition-colors ${
                striped && idx % 2 === 1 ? 'bg-neutral-50 dark:bg-neutral-800/20' : ''
              } ${hoverable ? 'hover:bg-neutral-100 dark:hover:bg-neutral-800/50' : ''}`}
            >
              {columns.map(col => (
                <td key={col.key} className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// ALERT / NOTIFICATION COMPONENTS
// ============================================================================

interface AlertProps {
  type: 'success' | 'warning' | 'danger' | 'info';
  title?: string;
  message: string;
  onClose?: () => void;
  dismissible?: boolean;
}

export function Alert({ type, title, message, onClose, dismissible = true }: AlertProps) {
  const [isVisible, setIsVisible] = React.useState(true);

  const handleClose = () => {
    setIsVisible(false);
    onClose?.();
  };

  if (!isVisible) return null;

  const typeConfig = {
    success: { bg: 'bg-accent-success/10', border: 'border-accent-success/20', text: 'text-accent-success', icon: '✓' },
    warning: { bg: 'bg-accent-warning/10', border: 'border-accent-warning/20', text: 'text-accent-warning', icon: '⚠' },
    danger: { bg: 'bg-accent-danger/10', border: 'border-accent-danger/20', text: 'text-accent-danger', icon: '✕' },
    info: { bg: 'bg-accent-info/10', border: 'border-accent-info/20', text: 'text-accent-info', icon: 'ℹ' },
  };

  const config = typeConfig[type];

  return (
    <div className={`${config.bg} border ${config.border} rounded-lg p-4 flex items-start gap-3`}>
      <span className={`${config.text} font-bold text-lg flex-shrink-0 mt-0.5`}>{config.icon}</span>
      <div className="flex-1">
        {title && <p className={`${config.text} font-semibold text-sm mb-1`}>{title}</p>}
        <p className="text-body-secondary text-sm">{message}</p>
      </div>
      {dismissible && (
        <button onClick={handleClose} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 flex-shrink-0">
          ×
        </button>
      )}
    </div>
  );
}

// ============================================================================
// BADGE COMPONENTS
// ============================================================================

interface BadgeProps {
  type: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  children: React.ReactNode;
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
}

export function Badge({ type, children, icon, size = 'md' }: BadgeProps) {
  const typeConfig = {
    success: 'bg-accent-success/10 text-accent-success',
    warning: 'bg-accent-warning/10 text-accent-warning',
    danger: 'bg-accent-danger/10 text-accent-danger',
    info: 'bg-accent-info/10 text-accent-info',
    neutral: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${typeConfig[type]} ${sizeClasses[size]}`}>
      {icon && <span>{icon}</span>}
      {children}
    </span>
  );
}

// ============================================================================
// LOADING SKELETON COMPONENTS
// ============================================================================

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card space-y-3 animate-pulse">
      <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-3/4"></div>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3 bg-neutral-200 dark:bg-neutral-700 rounded w-full"></div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: columns }).map((_, j) => (
            <div key={j} className="h-10 bg-neutral-200 dark:bg-neutral-700 rounded flex-1"></div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// PAGINATION COMPONENTS
// ============================================================================

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  maxVisible?: number;
}

export function Pagination({ currentPage, totalPages, onPageChange, maxVisible = 5 }: PaginationProps) {
  const pages = [];
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);

  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  if (startPage > 1) {
    pages.push(1);
    if (startPage > 2) pages.push('...');
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-center gap-2">
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="button-secondary button-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        ← Prev
      </button>
      {pages.map((page, idx) => (
        <button
          key={idx}
          onClick={() => typeof page === 'number' && onPageChange(page)}
          disabled={typeof page !== 'number'}
          className={`
            px-3 py-1.5 rounded text-sm font-medium transition-all
            ${page === currentPage
              ? 'bg-primary-500 text-white'
              : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }
            ${typeof page !== 'number' ? 'cursor-default' : 'hover:scale-105'}
          `}
        >
          {page}
        </button>
      ))}
      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="button-secondary button-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Next →
      </button>
    </div>
  );
}

// ============================================================================
// STATUS BADGE COMPONENTS
// ============================================================================

interface StatusBadgeProps {
  status: 'up' | 'down' | 'degraded' | 'unknown';
  label?: string;
  pulsing?: boolean;
}

export function StatusBadge({ status, label, pulsing = false }: StatusBadgeProps) {
  const statusConfig = {
    up: { color: 'bg-accent-success', label: 'Up' },
    down: { color: 'bg-accent-danger', label: 'Down' },
    degraded: { color: 'bg-accent-warning', label: 'Degraded' },
    unknown: { color: 'bg-neutral-400', label: 'Unknown' },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      <div className={`w-3 h-3 rounded-full ${config.color} ${pulsing ? 'animate-pulse-subtle' : ''}`}></div>
      <span className="text-body-secondary text-sm">{label || config.label}</span>
    </div>
  );
}

// ============================================================================
// PROGRESS BAR COMPONENTS
// ============================================================================

interface ProgressBarProps {
  value: number;
  max?: number;
  label?: string;
  showPercentage?: boolean;
  color?: 'success' | 'warning' | 'danger' | 'info' | 'primary';
}

export function ProgressBar({ value, max = 100, label, showPercentage = false, color = 'primary' }: ProgressBarProps) {
  const percentage = Math.min(100, Math.round((value / max) * 100));

  const colorMap = {
    success: 'bg-accent-success',
    warning: 'bg-accent-warning',
    danger: 'bg-accent-danger',
    info: 'bg-accent-info',
    primary: 'bg-primary-500',
  };

  return (
    <div>
      {(label || showPercentage) && (
        <div className="flex items-center justify-between mb-2">
          {label && <span className="text-label text-xs">{label}</span>}
          {showPercentage && <span className="text-body-secondary text-xs">{percentage}%</span>}
        </div>
      )}
      <div className="w-full h-2 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
        <div className={`h-full transition-all duration-300 ${colorMap[color]}`} style={{ width: `${percentage}%` }}></div>
      </div>
    </div>
  );
}

export default {
  Modal,
  Dropdown,
  Table,
  Alert,
  Badge,
  SkeletonCard,
  SkeletonTable,
  Pagination,
  StatusBadge,
  ProgressBar,
};

