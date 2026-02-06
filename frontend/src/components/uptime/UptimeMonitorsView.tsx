import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Zap, ExternalLink, Clock, RefreshCw, CheckCircle, XCircle, AlertTriangle, Radio, TrendingUp, Activity, LucideIcon } from 'lucide-react';
import { format } from 'date-fns';
import { parseAsUTC, formatInLocalTime } from '../../utils/dateUtils';
import { api } from '../../utils/api';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import UptimeMonitorForm from './UptimeMonitorForm';
import { UptimeMonitor, UptimeCheck, UptimeStatus, CreateUptimeMonitorRequest } from '../../types';

interface StatusConfigItem {
  color: string;
  bg: string;
  bgLight: string;
  border: string;
  gradient: string;
  icon: LucideIcon;
  label: string;
}

const statusConfig: Record<UptimeStatus, StatusConfigItem> = {
  up: {
    color: 'text-green-500',
    bg: 'bg-green-500',
    bgLight: 'bg-green-100 dark:bg-green-900/30',
    border: 'border-green-200 dark:border-green-800',
    gradient: 'from-green-500 to-emerald-500',
    icon: CheckCircle,
    label: 'Operational',
  },
  down: {
    color: 'text-red-500',
    bg: 'bg-red-500',
    bgLight: 'bg-red-100 dark:bg-red-900/30',
    border: 'border-red-200 dark:border-red-800',
    gradient: 'from-red-500 to-rose-500',
    icon: XCircle,
    label: 'Down',
  },
  degraded: {
    color: 'text-yellow-500',
    bg: 'bg-yellow-500',
    bgLight: 'bg-yellow-100 dark:bg-yellow-900/30',
    border: 'border-yellow-200 dark:border-yellow-800',
    gradient: 'from-yellow-500 to-amber-500',
    icon: AlertTriangle,
    label: 'Degraded',
  },
  unknown: {
    color: 'text-gray-400',
    bg: 'bg-gray-400',
    bgLight: 'bg-gray-100 dark:bg-gray-700',
    border: 'border-gray-200 dark:border-gray-600',
    gradient: 'from-gray-400 to-gray-500',
    icon: Clock,
    label: 'Pending',
  },
};

const intervalLabels: Record<number, string> = {
  60: '1m',
  300: '5m',
  900: '15m',
  1800: '30m',
  3600: '1h',
};

function formatTimeAgo(date: string | null | undefined) {
  if (!date) return 'Never';

  const parsedDate = parseAsUTC(date);
  if (!parsedDate) return date;

  const seconds = Math.floor((Date.now() - parsedDate.getTime()) / 1000);

  // Handle negative values (future dates due to timezone issues or clock skew)
  if (seconds < 0) return 'Just now';

  if (seconds < 5) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function UptimeBar({ checks }: { checks: UptimeCheck[] }) {
  const bars = (checks || []).slice(0, 30).reverse();

  return (
    <div className="flex gap-0.5 h-8 items-end">
      {bars.map((check, i) => {
        const config = statusConfig[check.status] || statusConfig.unknown;
        const height = check.status === 'up' ? 'h-full' : check.status === 'degraded' ? 'h-3/4' : 'h-1/2';
        return (
          <div
            key={i}
            className={`flex-1 max-w-2 min-w-1 rounded-sm ${config.bg} opacity-80 hover:opacity-100 transition-all hover:scale-110 cursor-pointer ${height}`}
            title={`${check.status.toUpperCase()} - ${check.response_time_ms || 0}ms\n${formatInLocalTime(check.checked_at, 'dd.MM.yyyy HH:mm:ss')}`}
          />
        );
      })}
      {Array.from({ length: Math.max(0, 30 - bars.length) }).map((_, i) => (
        <div key={`empty-${i}`} className="flex-1 max-w-2 min-w-1 h-full rounded-sm bg-gray-200 dark:bg-gray-700 opacity-30" />
      ))}
    </div>
  );
}

interface MonitorCardProps {
  monitor: UptimeMonitor;
  checks: UptimeCheck[];
  onEdit: (monitor: UptimeMonitor) => void;
  onDelete: (monitor: UptimeMonitor) => void;
  onManualCheck: (monitor: UptimeMonitor) => void;
  checking: boolean;
  isViewer: boolean;
}

function MonitorCard({ monitor, checks, onEdit, onDelete, onManualCheck, checking, isViewer }: MonitorCardProps) {
  const config = statusConfig[monitor.current_status] || statusConfig.unknown;
  const Icon = config.icon;

  const upChecks = (checks || []).filter(c => c.status === 'up').length;
  const totalChecks = (checks || []).length;
  const uptimePercent = totalChecks > 0 ? ((upChecks / totalChecks) * 100).toFixed(1) : null;

  const avgResponseTime = totalChecks > 0
    ? Math.round((checks || []).reduce((sum, c) => sum + (c.response_time_ms || 0), 0) / totalChecks)
    : null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 transition-all">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
              <Icon className={`w-5 h-5 ${config.color}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-gray-900 dark:text-white truncate">{monitor.name}</h3>
                {monitor.is_main && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                    Main
                  </span>
                )}
                <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                  {intervalLabels[monitor.interval_seconds] || `${monitor.interval_seconds}s`}
                </span>
                {!monitor.enabled && (
                  <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400">
                    Paused
                  </span>
                )}
              </div>
              <a
                href={monitor.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 flex items-center gap-1 truncate"
              >
                {monitor.url.replace(/^https?:\/\//, '').substring(0, 40)}
                {monitor.url.replace(/^https?:\/\//, '').length > 40 && '...'}
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>
            </div>
          </div>

          {/* Status badge */}
          <div className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium ${config.bgLight} ${config.color}`}>
            {config.label}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">
              {uptimePercent !== null ? `${uptimePercent}%` : '-'}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Uptime</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Activity className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">
              {avgResponseTime !== null ? avgResponseTime : '-'}
              {avgResponseTime !== null && <span className="text-xs font-normal text-gray-500">ms</span>}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Avg Response</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Clock className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">
              {monitor.last_response_time || '-'}
              {monitor.last_response_time && <span className="text-xs font-normal text-gray-500">ms</span>}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Last Response</div>
          </div>
        </div>

        {/* Uptime visualization */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">Last 30 checks</span>
            </div>
            <span>Checked {formatTimeAgo(monitor.last_checked_at)}</span>
          </div>
          <UptimeBar checks={checks} />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
          <div className="text-xs text-gray-400">
            Expected: {monitor.expected_status} · Timeout: {monitor.timeout_ms / 1000}s
          </div>
          {!isViewer && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onManualCheck(monitor)}
                disabled={checking}
                className="p-2 text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-all disabled:opacity-50"
                title="Run check now"
              >
                {checking ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => onEdit(monitor)}
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                title="Edit monitor"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(monitor)}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                title="Delete monitor"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface UptimeMonitorsViewProps {
  siteId: string | number;
}

export default function UptimeMonitorsView({ siteId }: UptimeMonitorsViewProps) {
  const { showSuccess, showError } = useNotification();
  const { user } = useAuth();
  const isViewer = user?.is_viewer ?? false;
  const [monitors, setMonitors] = useState<UptimeMonitor[]>([]);
  const [checksMap, setChecksMap] = useState<Record<number, UptimeCheck[]>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingMonitor, setEditingMonitor] = useState<UptimeMonitor | null>(null);
  const [saving, setSaving] = useState(false);
  const [checkingId, setCheckingId] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      const monitorsData = await api.get<UptimeMonitor[]>(`/uptime/monitors?site_id=${siteId}`);
      setMonitors(monitorsData || []);

      // Fetch recent checks for each monitor
      const checksPromises = (monitorsData || []).map(async (m) => {
        try {
          const history = await api.get<{ checks: UptimeCheck[] }>(`/uptime/monitors/${m.id}/history?limit=30`);
          return { id: m.id, checks: history.checks || [] };
        } catch {
          return { id: m.id, checks: [] };
        }
      });

      const checksResults = await Promise.all(checksPromises);
      const map: Record<number, UptimeCheck[]> = {};
      checksResults.forEach((r) => {
        map[r.id] = r.checks;
      });
      setChecksMap(map);
    } catch (error) {
      showError('Failed to load monitors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [siteId]);

  const handleCreate = async (form: Partial<CreateUptimeMonitorRequest>) => {
    setSaving(true);
    try {
      await api.post('/uptime/monitors', { ...form, site_id: parseInt(String(siteId)) });
      showSuccess('Monitor created');
      setShowForm(false);
      fetchData();
    } catch (error: any) {
      showError(error.message || 'Failed to create monitor');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (form: Partial<CreateUptimeMonitorRequest>) => {
    if (!editingMonitor) return;
    setSaving(true);
    try {
      await api.put(`/uptime/monitors/${editingMonitor.id}`, form);
      showSuccess('Monitor updated');
      setEditingMonitor(null);
      fetchData();
    } catch (error: any) {
      showError(error.message || 'Failed to update monitor');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (monitor: UptimeMonitor) => {
    if (!confirm(`Delete monitor "${monitor.name}"? This will also delete all check history.`)) {
      return;
    }
    try {
      await api.delete(`/uptime/monitors/${monitor.id}`);
      showSuccess('Monitor deleted');
      fetchData();
    } catch (error: any) {
      showError(error.message || 'Failed to delete monitor');
    }
  };

  const handleManualCheck = async (monitor: UptimeMonitor) => {
    setCheckingId(monitor.id);
    try {
      const result = await api.post<any>(`/uptime/monitors/${monitor.id}/check`);
      showSuccess(`Check complete: ${result.status} (${result.responseTimeMs}ms)`);
      fetchData();
    } catch (error: any) {
      showError(error.message || 'Check failed');
    } finally {
      setCheckingId(null);
    }
  };

  // Overall status calculation
  const overallStatus: UptimeStatus = monitors.length === 0
    ? 'unknown'
    : monitors.some(m => m.current_status === 'down')
    ? 'down'
    : monitors.some(m => m.current_status === 'degraded')
    ? 'degraded'
    : monitors.every(m => m.current_status === 'up')
    ? 'up'
    : 'unknown';

  const overallConfig = statusConfig[overallStatus];
  const OverallIcon = overallConfig.icon;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <RefreshCw className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">Loading monitors...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Status Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                <Radio className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Uptime Monitors</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {monitors.length === 0
                    ? 'No monitors configured'
                    : `${monitors.length} endpoint${monitors.length !== 1 ? 's' : ''} monitored`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {monitors.length > 0 && (
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${overallConfig.bgLight}`}>
                  <OverallIcon className={`w-4 h-4 ${overallConfig.color}`} />
                  <span className={`font-medium text-sm ${overallConfig.color}`}>
                    {overallStatus === 'up' ? 'All Operational' : overallConfig.label}
                  </span>
                </div>
              )}
              {!isViewer && (
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all font-medium text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Monitor
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {monitors.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-700">
          <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6">
            <Radio className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No Monitors Yet</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
            {isViewer ? 'No uptime monitors have been configured for this site.' : 'Start monitoring your endpoints to track uptime and receive alerts when they go down.'}
          </p>
          {!isViewer && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl transition-all font-semibold"
            >
              <Plus className="w-5 h-5" />
              Create Your First Monitor
            </button>
          )}
        </div>
      ) : (
        /* Monitor Cards Grid */
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {monitors.map((monitor) => (
            <MonitorCard
              key={monitor.id}
              monitor={monitor}
              checks={checksMap[monitor.id] || []}
              onEdit={setEditingMonitor}
              onDelete={handleDelete}
              onManualCheck={handleManualCheck}
              checking={checkingId === monitor.id}
              isViewer={isViewer}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {showForm && (
        <UptimeMonitorForm
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
          loading={saving}
        />
      )}

      {editingMonitor && (
        <UptimeMonitorForm
          monitor={editingMonitor}
          onSubmit={handleUpdate}
          onCancel={() => setEditingMonitor(null)}
          loading={saving}
        />
      )}
    </div>
  );
}
