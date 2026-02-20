import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Zap, Clock, RefreshCw, Radio } from 'lucide-react';
import { formatInLocalTime, parseAsUTC } from '../../utils/dateUtils';
import { api } from '../../utils/api';
import { useNotification } from '../../contexts/NotificationContext';
import { usePermissions } from '../../hooks/usePermissions';
import UptimeMonitorForm from './UptimeMonitorForm';
import { UptimeMonitor, UptimeCheck, UptimeStatus, CreateUptimeMonitorRequest } from '../../types';

const statusDot: Record<UptimeStatus, string> = {
  up: 'bg-emerald-400 dark:bg-emerald-500',
  down: 'bg-rose-400 dark:bg-rose-500',
  degraded: 'bg-amber-400 dark:bg-amber-500',
  unknown: 'bg-gray-300 dark:bg-gray-500',
};

const statusLabel: Record<UptimeStatus, string> = {
  up: 'Operational',
  down: 'Down',
  degraded: 'Degraded',
  unknown: 'Pending',
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
  if (seconds < 0) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

interface UptimeMonitorsViewProps {
  siteId: string | number;
}

export default function UptimeMonitorsView({ siteId }: UptimeMonitorsViewProps) {
  const { showSuccess, showError } = useNotification();
  const { isViewer } = usePermissions();
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
      checksResults.forEach((r) => { map[r.id] = r.checks; });
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
      const result = await api.post<any>(`/uptime/monitors/${monitor.id}/check`, {});
      showSuccess(`Check complete: ${result.status} (${result.responseTimeMs}ms)`);
      fetchData();
    } catch (error: any) {
      showError(error.message || 'Check failed');
    } finally {
      setCheckingId(null);
    }
  };

  // Aggregate stats
  const upCount = monitors.filter(m => m.current_status === 'up').length;
  const downCount = monitors.filter(m => m.current_status === 'down').length;
  const degradedCount = monitors.filter(m => m.current_status === 'degraded').length;

  const allChecks = Object.values(checksMap).flat();
  const overallUptimePct = allChecks.length > 0
    ? (allChecks.filter(c => c.status === 'up').length / allChecks.length) * 100
    : null;

  const responseTimes = monitors.map(m => m.last_response_time).filter((t): t is number => t != null);
  const avgResponseTime = responseTimes.length > 0
    ? Math.round(responseTimes.reduce((s, t) => s + t, 0) / responseTimes.length)
    : null;

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
    <div className="space-y-5">
      {/* Summary stats + Add button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {monitors.length > 0 && (
            <>
              <div className="flex items-center gap-3 text-sm">
                <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 dark:bg-emerald-500" />{upCount} up
                </span>
                {downCount > 0 && (
                  <span className="flex items-center gap-1.5 text-rose-500 dark:text-rose-400 font-medium">
                    <span className="w-2 h-2 rounded-full bg-rose-400 dark:bg-rose-500" />{downCount} down
                  </span>
                )}
                {degradedCount > 0 && (
                  <span className="flex items-center gap-1.5 text-amber-500 dark:text-amber-400">
                    <span className="w-2 h-2 rounded-full bg-amber-400 dark:bg-amber-500" />{degradedCount} degraded
                  </span>
                )}
              </div>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {overallUptimePct !== null ? `${overallUptimePct.toFixed(1)}% uptime` : ''}
                {overallUptimePct !== null && avgResponseTime !== null ? ' · ' : ''}
                {avgResponseTime !== null ? `${avgResponseTime}ms avg` : ''}
              </span>
            </>
          )}
        </div>
        {!isViewer() && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium text-sm shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Monitor
          </button>
        )}
      </div>

      {/* Empty State */}
      {monitors.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-700">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Radio className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">No Monitors Yet</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 max-w-sm mx-auto">
            {isViewer() ? 'No uptime monitors have been configured for this site.' : 'Monitor your endpoints to track uptime and get alerts when they go down.'}
          </p>
          {!isViewer() && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium text-sm"
            >
              <Plus className="w-4 h-4" />
              Create First Monitor
            </button>
          )}
        </div>
      ) : (
        /* Monitor list */
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {monitors.map((monitor) => {
              const mStatus = monitor.current_status || 'unknown';
              const checks = checksMap[monitor.id] || [];
              const bars = checks.slice(0, 30).reverse();
              const uptimePct = checks.length > 0
                ? (checks.filter(c => c.status === 'up').length / checks.length) * 100
                : null;

              return (
                <div key={monitor.id} className="px-5 py-3.5 flex items-center gap-4 transition-colors">
                  {/* Status dot */}
                  <div className={`flex-shrink-0 w-2.5 h-2.5 rounded-full ${statusDot[mStatus]} ${mStatus === 'down' ? 'animate-pulse' : ''}`} />

                  {/* Name + URL + badges */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900 dark:text-white truncate">{monitor.name}</span>
                      {monitor.is_main && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-50 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400 uppercase">Main</span>
                      )}
                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-400">
                        {intervalLabels[monitor.interval_seconds] || `${monitor.interval_seconds}s`}
                      </span>
                      {!monitor.enabled && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-yellow-50 dark:bg-yellow-900/20 text-yellow-500">Paused</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500 truncate block">
                      {monitor.url.replace(/^https?:\/\//, '')}
                    </span>
                  </div>

                  {/* Sparkline */}
                  <div className="hidden md:flex gap-px h-5 items-end w-32 flex-shrink-0">
                    {bars.map((check, i) => {
                      const height = check.status === 'up' ? 'h-full' : check.status === 'degraded' ? 'h-3/4' : 'h-1/2';
                      return (
                        <div key={i}
                          className={`flex-1 rounded-sm ${statusDot[check.status] || statusDot.unknown} opacity-70 ${height}`}
                          title={`${check.status.toUpperCase()} – ${check.response_time_ms ?? 0}ms\n${formatInLocalTime(check.checked_at, 'dd.MM.yyyy HH:mm:ss')}`}
                        />
                      );
                    })}
                    {Array.from({ length: Math.max(0, 30 - bars.length) }).map((_, i) => (
                      <div key={`e-${i}`} className="flex-1 h-full rounded-sm bg-gray-200 dark:bg-gray-700 opacity-20" />
                    ))}
                  </div>

                  {/* Uptime % */}
                  <div className="hidden sm:block text-right w-16 flex-shrink-0">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {uptimePct !== null ? `${uptimePct.toFixed(1)}%` : '—'}
                    </span>
                  </div>

                  {/* Response time */}
                  <div className="text-right w-16 flex-shrink-0">
                    <span className="text-sm font-mono text-gray-500 dark:text-gray-400">
                      {monitor.last_response_time != null ? `${monitor.last_response_time}ms` : '—'}
                    </span>
                  </div>

                  {/* Last checked */}
                  <div className="hidden lg:block text-right w-20 flex-shrink-0">
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {formatTimeAgo(monitor.last_checked_at)}
                    </span>
                  </div>

                  {/* Actions */}
                  {!isViewer() && (
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button
                        onClick={() => handleManualCheck(monitor)}
                        disabled={checkingId === monitor.id}
                        className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-all disabled:opacity-50"
                        title="Run check now"
                      >
                        {checkingId === monitor.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Zap className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => setEditingMonitor(monitor)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                        title="Edit monitor"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(monitor)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                        title="Delete monitor"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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
