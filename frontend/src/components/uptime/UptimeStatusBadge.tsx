import React from 'react';
import { CheckCircle, XCircle, AlertTriangle, Clock, LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { UptimeStatus } from '../../types';

interface StatusConfig {
  color: string;
  bg: string;
  icon: LucideIcon;
}

const statusConfig: Record<UptimeStatus, StatusConfig> = {
  up: {
    color: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-100 dark:bg-green-900/30',
    icon: CheckCircle,
  },
  down: {
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-900/30',
    icon: XCircle,
  },
  degraded: {
    color: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    icon: AlertTriangle,
  },
  unknown: {
    color: 'text-gray-500 dark:text-gray-400',
    bg: 'bg-gray-100 dark:bg-gray-700',
    icon: Clock,
  },
};

interface UptimeStatusBadgeProps {
  status: UptimeStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export default function UptimeStatusBadge({ status, size = 'md', showLabel = true }: UptimeStatusBadgeProps) {
  const { t } = useTranslation('uptime');
  const config = statusConfig[status] || statusConfig.unknown;
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  if (!showLabel) {
    return <Icon className={`${sizeClasses[size]} ${config.color}`} />;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
      <Icon className={sizeClasses[size]} />
      {t(`status.${status}`)}
    </span>
  );
}

interface UptimeStatusDotProps {
  status: UptimeStatus;
  size?: 'sm' | 'md' | 'lg';
}

export function UptimeStatusDot({ status, size = 'md' }: UptimeStatusDotProps) {
  const { t } = useTranslation('uptime');
  const colorMap: Record<UptimeStatus, string> = {
    up: 'bg-green-500',
    down: 'bg-red-500',
    degraded: 'bg-yellow-500',
    unknown: 'bg-gray-400',
  };

  const sizeMap = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  };

  return (
    <span
      className={`inline-block rounded-full ${sizeMap[size]} ${colorMap[status] || colorMap.unknown}`}
      title={t(`status.${status}`)}
    />
  );
}
