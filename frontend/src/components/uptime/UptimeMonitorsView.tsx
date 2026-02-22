import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Zap, Clock, RefreshCw, Radio } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatInLocalTime } from '../../utils/dateUtils';
import { formatTimeAgo } from '../../utils/timeFormat';
import { api } from '../../utils/api';
import { useNotification } from '../../contexts/NotificationContext';
import { usePermissions } from '../../hooks/usePermissions';
import { UptimeMonitor, UptimeCheck, UptimeStatus, CreateUptimeMonitorRequest } from '../../types';
import UptimeMonitorForm from './UptimeMonitorForm';
import ConfirmDialog from '../common/ConfirmDialog';

const statusDot: Record<UptimeStatus, string> = {
  up: 'bg-emerald-400 dark:bg-emerald-500',
  down: 'bg-rose-400 dark:bg-rose-500',
  degraded: 'bg-amber-400 dark:bg-amber-500',
  unknown: 'bg-gray-300 dark:bg-gray-500',
};



const statusBadge: Record<UptimeStatus, string> = {
  up: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  down: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  degraded: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  unknown: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
};

const intervalLabels: Record<number, string> = {
  60: '1m',
  300: '5m',
  900: '15m',
  1800: '30m',
  3600: '1h',
};


interface UptimeMonitorsViewProps {
  siteId: string | number;
}

export default function UptimeMonitorsView({ siteId }: UptimeMonitorsViewProps) {
  const { t } = useTranslation('uptime');
  const { t: tc } = useTranslation('common');
  const { showSuccess, showError } = useNotification();
  const { isViewer } = usePermissions();
  const [monitors, setMonitors] = useState<UptimeMonitor[]>([]);
  const [checksMap, setChecksMap] = useState<Record<number, UptimeCheck[]>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingMonitor, setEditingMonitor] = useState<UptimeMonitor | null>(null);
  const [saving, setSaving] = useState(false);
  const [checkingId, setCheckingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UptimeMonitor | null>(null);

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
      showError(t('messages.load_failed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isActive = true;
    const wrappedFetch = async () => {
      try {
        const monitorsData = await api.get<UptimeMonitor[]>(`/uptime/monitors?site_id=${siteId}`);
        if (!isActive) return;
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
        if (!isActive) return;
        const map: Record<number, UptimeCheck[]> = {};
        checksResults.forEach((r) => { map[r.id] = r.checks; });
        setChecksMap(map);
      } catch (error) {
        if (isActive) showError(t('messages.load_failed'));
      } finally {
        if (isActive) setLoading(false);
      }
    };

    wrappedFetch();
    const interval = setInterval(wrappedFetch, 30000);
    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [siteId]);

  const handleCreate = async (form: Partial<CreateUptimeMonitorRequest>) => {
    setSaving(true);
    try {
      await api.post('/uptime/monitors', { ...form, site_id: parseInt(String(siteId)) });
      showSuccess(t('messages.created'));
      setShowForm(false);
      fetchData();
    } catch (error: any) {
      showError(error.message || t('messages.create_failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (form: Partial<CreateUptimeMonitorRequest>) => {
    if (!editingMonitor) return;
    setSaving(true);
    try {
      await api.put(`/uptime/monitors/${editingMonitor.id}`, form);
      showSuccess(t('messages.updated'));
      setEditingMonitor(null);
      fetchData();
    } catch (error: any) {
      showError(error.message || t('messages.update_failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (monitor: UptimeMonitor) => {
    try {
      await api.delete(`/uptime/monitors/${monitor.id}`);
      showSuccess(t('messages.deleted'));
      fetchData();
    } catch (error: any) {
      showError(error.message || t('messages.delete_failed'));
    }
  };

  const handleManualCheck = async (monitor: UptimeMonitor) => {
    setCheckingId(monitor.id);
    try {
      const result = await api.post<any>(`/uptime/monitors/${monitor.id}/check`, {});
      showSuccess(t('messages.check_complete', { status: result.status, ms: result.responseTimeMs }));
      fetchData();
    } catch (error: any) {
      showError(error.message || t('messages.check_failed'));
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
          <p className="text-gray-600 dark:text-gray-400">{t('monitors.loading')}</p>
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
                  <span className="w-2 h-2 rounded-full bg-emerald-400 dark:bg-emerald-500" />{t('monitors.counts.up', { count: upCount })}
                </span>
                {downCount > 0 && (
                  <span className="flex items-center gap-1.5 text-rose-500 dark:text-rose-400 font-medium">
                    <span className="w-2 h-2 rounded-full bg-rose-400 dark:bg-rose-500" />{t('monitors.counts.down', { count: downCount })}
                  </span>
                )}
                {degradedCount > 0 && (
                  <span className="flex items-center gap-1.5 text-amber-500 dark:text-amber-400">
                    <span className="w-2 h-2 rounded-full bg-amber-400 dark:bg-amber-500" />{t('monitors.counts.degraded', { count: degradedCount })}
                  </span>
                )}
              </div>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {overallUptimePct !== null ? `${overallUptimePct.toFixed(1)}% ${t('monitors.uptime_label')}` : ''}
                {overallUptimePct !== null && avgResponseTime !== null ? ' · ' : ''}
                {avgResponseTime !== null ? `${avgResponseTime}${t('monitors.ms_avg_label')}` : ''}
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
            {t('monitors.add_button')}
          </button>
        )}
      </div>

      {/* Empty State */}
      {monitors.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-700">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Radio className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{t('empty.title')}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 max-w-sm mx-auto">
            {isViewer() ? t('empty.description_site') : t('empty.description_action')}
          </p>
          {!isViewer() && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium text-sm"
            >
              <Plus className="w-4 h-4" />
              {t('empty.create_first')}
            </button>
          )}
        </div>
      ) : (
        /* Monitor grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {monitors.map((monitor) => {
            const mStatus = monitor.current_status || 'unknown';
            const checks = checksMap[monitor.id] || [];
            const bars = checks.slice(0, 30).reverse();
            const uptimePct = checks.length > 0
              ? (checks.filter(c => c.status === 'up').length / checks.length) * 100
              : null;

            const statusColors: Record<UptimeStatus, string> = {
              up: 'border-l-accent-success',
              down: 'border-l-accent-danger',
              degraded: 'border-l-accent-warning',
              unknown: 'border-l-neutral-400'
            };

            return (
              <div key={monitor.id} className={`card-compact border-l-4 ${statusColors[mStatus]}`}>
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm text-neutral-900 dark:text-white truncate">{monitor.name}</h3>
                      <span
                        className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${statusBadge[mStatus]}`}
                        title={t(`status_help.${mStatus}`)}
                      >
                        {t(`status.${mStatus}`)}
                      </span>
                      {monitor.is_main && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 uppercase">{t('monitors.main_badge')}</span>
                      )}
                      {!monitor.enabled && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">{t('monitors.paused_badge')}</span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-1">
                      {monitor.url.replace(/^https?:\/\//, '')}
                    </p>
                  </div>
                  <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 flex-shrink-0">
                    {intervalLabels[monitor.interval_seconds] || `${monitor.interval_seconds}s`}
                  </span>
                </div>

                {/* Sparkline */}
                <div className="mb-3">
                  <div className="flex gap-px h-5 items-end">
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
                      <div key={`e-${i}`} className="flex-1 h-full rounded-sm bg-neutral-200 dark:bg-neutral-700/50" />
                    ))}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between text-xs mb-3">
                  <div className="text-neutral-600 dark:text-neutral-400">
                    {uptimePct !== null ? (
                      <span><span className="font-semibold text-neutral-900 dark:text-white">{uptimePct.toFixed(1)}%</span> {t('monitors.uptime_label')}</span>
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                  <span className="text-neutral-500 dark:text-neutral-400">
                    {formatTimeAgo(monitor.last_checked_at)}
                  </span>
                </div>

                {/* Actions */}
                {!isViewer() && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleManualCheck(monitor)}
                      disabled={checkingId === monitor.id}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-md transition-colors disabled:opacity-50"
                    >
                      <Radio className="w-3 h-3" />
                      {checkingId === monitor.id ? t('monitors.checking') : t('monitors.check_now')}
                    </button>
                    <button
                      onClick={() => setEditingMonitor(monitor)}
                      className="px-2 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-md transition-colors"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(monitor)}
                      className="px-2 py-1.5 text-neutral-400 hover:text-accent-danger hover:bg-accent-danger/10 rounded-md transition-colors"
                      title={tc('actions.delete')}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
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

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={t('confirm.delete_title')}
        description={deleteTarget ? t('confirm.delete_description', { name: deleteTarget.name }) : undefined}
        confirmLabel={t('confirm.delete_label')}
        variant="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          handleDelete(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
