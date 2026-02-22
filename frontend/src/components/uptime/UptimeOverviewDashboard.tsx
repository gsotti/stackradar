import React, { useState, useEffect } from 'react';
import { RefreshCw, Radio } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatInLocalTime } from '../../utils/dateUtils';
import { formatTimeAgo } from '../../utils/timeFormat';
import { api } from '../../utils/api';
import { useNotification } from '../../contexts/NotificationContext';
import { UptimeMonitor, UptimeCheck, UptimeStatus } from '../../types';

const statusDot: Record<UptimeStatus, string> = {
  up: 'bg-emerald-400 dark:bg-emerald-500',
  down: 'bg-rose-400 dark:bg-rose-500',
  degraded: 'bg-amber-400 dark:bg-amber-500',
  unknown: 'bg-gray-300 dark:bg-gray-500',
};


interface UptimeOverviewDashboardProps {
  siteId: string | number;
}

export default function UptimeOverviewDashboard({ siteId }: UptimeOverviewDashboardProps) {
  const { t } = useTranslation('uptime');
  const { t: tc } = useTranslation('common');
  const { showError } = useNotification();
  const [monitors, setMonitors] = useState<UptimeMonitor[]>([]);
  const [checksMap, setChecksMap] = useState<Record<number, UptimeCheck[]>>({});
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const monitorsData = await api.get<UptimeMonitor[]>(`/uptime/monitors?site_id=${siteId}`);
      setMonitors(monitorsData || []);

      const checksPromises = (monitorsData || []).map(async (m) => {
        try {
          const history = await api.get<{ checks: UptimeCheck[] }>(
            `/uptime/monitors/${m.id}/history?limit=30`
          );
          return { id: m.id, checks: history.checks || [] };
        } catch {
          return { id: m.id, checks: [] };
        }
      });

      const results = await Promise.all(checksPromises);
      const map: Record<number, UptimeCheck[]> = {};
      results.forEach((r) => { map[r.id] = r.checks; });
      setChecksMap(map);
    } catch {
      showError(t('overview.load_failed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [siteId]);

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
          <p className="text-gray-600 dark:text-gray-400">{t('overview.loading')}</p>
        </div>
      </div>
    );
  }

  if (monitors.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-700">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <Radio className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{t('overview.no_monitors_title')}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
          {t('empty.overview_description')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
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
        </div>
        <button
          onClick={() => fetchData()}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {t('overview.refresh')}
        </button>
      </div>

      {/* Monitor list */}
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

                {/* Name + URL */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-900 dark:text-white truncate">{monitor.name}</span>
                    {monitor.is_main && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-50 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400 uppercase">{t('monitors.main_badge')}</span>
                    )}
                    {!monitor.enabled && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-yellow-50 dark:bg-yellow-900/20 text-yellow-500">{t('monitors.paused_badge')}</span>
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
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
