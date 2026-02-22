import React, { useState, useEffect } from 'react';
import { FileText, Server, AlertTriangle, Activity, RefreshCw, TrendingUp, TrendingDown, Eye, Radio } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';
import { api } from '../utils/api';
import { useApp } from '../contexts/AppContext';
import { Site, System, UptimeMonitor, UptimeCheck, UptimeStatus } from '../types';
import { formatInLocalTime } from '../utils/dateUtils';
import { formatTimeAgo } from '../utils/timeFormat';

interface DashboardStats {
  total_logs: number;
  logs_per_hour: Array<{ hour: string; count: number }>;
  logs_by_level: Record<string, number>;
  top_sources: Array<{ source: string; count: number }>;
}

interface UptimeStats {
  total: number;
  up: number;
  down: number;
  degraded: number;
  unknown: number;
}

export default function DashboardPage() {
  const { t } = useTranslation('dashboard');
  const { t: tc } = useTranslation('common');
  const { selectedTenant, selectedEnvironment, selectedSite } = useApp();
  const [sites, setSites] = useState<Site[]>([]);
  const [systems, setSystems] = useState<System[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [uptimeStats, setUptimeStats] = useState<UptimeStats | null>(null);
  const [monitors, setMonitors] = useState<UptimeMonitor[]>([]);
  const [checksMap, setChecksMap] = useState<Record<number, UptimeCheck[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // /logs/stats uses tenant_id (numeric), environment_id, and site_id
    const statsParams = new URLSearchParams();
    statsParams.append('hours', '24');
    if (selectedTenant) statsParams.append('tenant_id', selectedTenant);
    if (selectedEnvironment) statsParams.append('environment_id', selectedEnvironment);
    if (selectedSite) statsParams.append('site_id', selectedSite);

    // /systems uses tenant_id, site_id, environment_id
    const systemsParams = new URLSearchParams();
    if (selectedTenant) systemsParams.append('tenant_id', selectedTenant);
    if (selectedSite) systemsParams.append('site_id', selectedSite);
    if (selectedEnvironment) systemsParams.append('environment_id', selectedEnvironment);

    // /uptime routes use tenant, site, environment (numeric IDs passed as string)
    const uptimeParams = new URLSearchParams();
    if (selectedTenant) uptimeParams.append('tenant', selectedTenant);
    if (selectedSite) uptimeParams.append('site', selectedSite);
    if (selectedEnvironment) uptimeParams.append('environment', selectedEnvironment);

    // /sites uses tenant_id
    const sitesParams = new URLSearchParams();
    if (selectedTenant) sitesParams.append('tenant_id', selectedTenant);

    setLoading(true);
    Promise.all([
      api.get<Site[]>(`/sites?${sitesParams}`),
      api.get<System[]>(`/systems?${systemsParams}`),
      api.get<DashboardStats>(`/logs/stats?${statsParams}`),
      api.get<UptimeStats>(`/uptime/stats?${uptimeParams}`).catch(() => null),
      api.get<UptimeMonitor[]>(`/uptime/monitors/all?${uptimeParams}`).catch(() => [])
    ]).then(async ([st, sys, logStats, up, mon]) => {
      setSites(st);
      setSystems(sys);
      setStats(logStats);
      setUptimeStats(up);
      setMonitors(mon || []);

      // If uptime-only tenant, fetch detailed check history for each monitor
      const isUptimeOnly = st.length > 0 && st.every(s => !s.has_metrics);
      if (isUptimeOnly && mon && mon.length > 0) {
        const checksPromises = mon.map(async (m) => {
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
      } else {
        setChecksMap({});
      }
    }).finally(() => setLoading(false));
  }, [selectedTenant, selectedEnvironment, selectedSite]);

  // Determine if this is an uptime-only tenant (all sites have has_metrics=false)
  const isUptimeOnly = sites.length > 0 && sites.every(s => !s.has_metrics);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-primary-500 mx-auto mb-4" />
          <p className="text-neutral-600 dark:text-neutral-400">{t('loading')}</p>
        </div>
      </div>
    );
  }

  // Custom tooltip component for pie chart
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const total = levelData.reduce((sum: number, item: any) => sum + item.value, 0);
      const value = payload[0].value;
      const percent = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
      return (
        <div
          style={{
            backgroundColor: 'rgba(31, 41, 55, 0.95)',
            border: '1px solid rgba(107, 114, 128, 0.3)',
            borderRadius: '8px',
            padding: '8px 12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
          }}
        >
          <p style={{ color: '#fff', margin: 0, fontSize: '13px', fontWeight: '500' }}>
            {payload[0].name}
          </p>
          <p style={{ color: '#e5e7eb', margin: '4px 0 0 0', fontSize: '12px' }}>
            {value} logs ({percent}%)
          </p>
        </div>
      );
    }
    return null;
  };
  const levelData = stats?.logs_by_level ? Object.entries(stats.logs_by_level).map(([name, value]) => ({ name, value })) : [];
  const totalErrors = (stats?.logs_by_level?.ERROR || 0) + (stats?.logs_by_level?.CRITICAL || 0);
  const errorRate = stats?.total_logs ? ((totalErrors / stats.total_logs) * 100).toFixed(1) : '0';

  // Calculate trends (mock for now - would need historical data)
  const logTrend = 12.5;
  const errorTrend = -3.2;

  // Visibility flags — hide sections that have no data
  const hasLogs = (stats?.total_logs ?? 0) > 0;
  const hasSystems = systems.length > 0;
  const hasMonitors = monitors.length > 0;
  const hasTopSources = (stats?.top_sources?.length ?? 0) > 0;
  const hasActivityTimeline = hasLogs && (stats?.logs_per_hour ?? []).some(h => h.count > 0);
  const hasLogDistribution = levelData.length > 0;

  // Determine which stat cards to show
  const showLogsCard = hasLogs;
  const showSystemsCard = hasSystems;
  const showErrorsCard = hasLogs;
  const showSourcesCard = hasTopSources;
  const hasAnyStatCards = showLogsCard || showSystemsCard || showErrorsCard || showSourcesCard;

  // No data at all — show a friendly empty state
  const hasAnyData = hasLogs || hasSystems || hasMonitors;

  if (!hasAnyData) {
    return (
      <div className="space-y-6 pb-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-heading-2">{t('page.title')}</h1>
            <p className="text-body-secondary mt-2">{t('page.subtitle')}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="button-primary flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            {t('actions.refresh')}
          </button>
        </div>

        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Activity className="w-16 h-16 text-neutral-300 dark:text-neutral-600 mb-4" />
          <h2 className="text-lg font-semibold text-neutral-700 dark:text-neutral-300 mb-2">{t('empty.no_data')}</h2>
          <p className="text-neutral-500 dark:text-neutral-400 max-w-sm">
            {t('empty.no_data_description')}
            {selectedTenant && ` ${t('empty.wrong_tenant')}`}
          </p>
        </div>
      </div>
    );
  }

  // ---------- Uptime-only dashboard ----------
  if (isUptimeOnly && hasMonitors) {
    const upCount = monitors.filter(m => m.current_status === 'up').length;
    const downCount = monitors.filter(m => m.current_status === 'down').length;
    const degradedCount = monitors.filter(m => m.current_status === 'degraded').length;

    const allChecks = Object.values(checksMap).flat();
    const uptimeOnlyPct = allChecks.length > 0
      ? (allChecks.filter(c => c.status === 'up').length / allChecks.length) * 100
      : null;

    const responseTimes = monitors.map(m => m.last_response_time).filter((t): t is number => t != null);
    const avgResponseTime = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((s, t) => s + t, 0) / responseTimes.length)
      : null;

    const statusDot: Record<UptimeStatus, string> = {
      up: 'bg-emerald-400 dark:bg-emerald-500',
      down: 'bg-rose-400 dark:bg-rose-500',
      degraded: 'bg-amber-400 dark:bg-amber-500',
      unknown: 'bg-gray-300 dark:bg-gray-500',
    };

    return (
      <div className="space-y-6 pb-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-heading-2">{t('page.title')}</h1>
            <p className="text-body-secondary mt-2">{t('page.subtitle')}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="button-primary flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            {t('actions.refresh')}
          </button>
        </div>

        {/* Summary stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card-compact border-l-4 border-l-accent-success">
            <p className="text-label mb-2">{t('uptime_summary.endpoints')}</p>
            <p className="text-2xl font-bold text-neutral-900 dark:text-white">{monitors.length}</p>
            <div className="flex flex-wrap gap-2 mt-2 text-xs text-neutral-500 dark:text-neutral-400">
              <span>{upCount} up</span>
              {downCount > 0 && <span className="font-medium text-neutral-700 dark:text-neutral-300">{downCount} down</span>}
              {degradedCount > 0 && <span>{degradedCount} degraded</span>}
            </div>
          </div>
          <div className="card-compact">
            <p className="text-label mb-2">{t('uptime_summary.uptime_label')}</p>
            <p className="text-2xl font-bold text-neutral-900 dark:text-white">
              {uptimeOnlyPct !== null ? `${uptimeOnlyPct.toFixed(1)}%` : '—'}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">{t('uptime_summary.last_30_checks')}</p>
          </div>
          <div className="card-compact">
            <p className="text-label mb-2">{t('uptime_summary.avg_response')}</p>
            <p className="text-2xl font-bold text-neutral-900 dark:text-white">
              {avgResponseTime !== null ? <>{avgResponseTime}<span className="text-sm font-normal text-neutral-400 ml-0.5">ms</span></> : '—'}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">{t('uptime_summary.across_all_monitors')}</p>
          </div>
          <div className="card-compact">
            <p className="text-label mb-2">{t('uptime_summary.sites')}</p>
            <p className="text-2xl font-bold text-neutral-900 dark:text-white">{sites.length}</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">{t('uptime_summary.being_monitored')}</p>
          </div>
        </div>

        {/* Monitor cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {monitors.map((monitor) => {
            const mStatus = monitor.current_status || 'unknown';
            const checks = checksMap[monitor.id] || [];
            const bars = checks.slice(0, 30).reverse();
            const uptimePct = checks.length > 0
              ? (checks.filter(c => c.status === 'up').length / checks.length) * 100
              : null;
            const validChecks = checks.filter(c => c.response_time_ms != null);
            const avgMs = validChecks.length > 0
              ? Math.round(validChecks.reduce((s, c) => s + (c.response_time_ms ?? 0), 0) / validChecks.length)
              : null;

            return (
              <div key={monitor.id} className="card-compact border-l-4" style={{ borderLeftColor: statusDot[mStatus].split(' ')[0].replace('bg-', '#').substring(0, 7) || '#6B7280' }}>
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className={`flex-shrink-0 w-2.5 h-2.5 rounded-full mt-1 status-indicator ${statusDot[mStatus].split('dark:')[0]}`} />
                      <span className="font-medium text-sm text-neutral-900 dark:text-white truncate">{monitor.name}</span>
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-1 pl-5">
                      {monitor.url.replace(/^https?:\/\//, '')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {monitor.is_main && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 uppercase">{t('uptime_summary.main_label')}</span>
                    )}
                    {!monitor.enabled && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">{t('uptime_summary.paused_label')}</span>
                    )}
                  </div>
                </div>

                {/* Sparkline */}
                <div className="mb-3">
                  <div className="flex gap-px h-6 items-end">
                    {bars.map((check, i) => {
                      const height = check.status === 'up' ? 'h-full' : check.status === 'degraded' ? 'h-3/4' : 'h-1/2';
                      const barColor = check.status === 'up'
                        ? 'bg-accent-success/60 dark:bg-accent-success/40'
                        : check.status === 'degraded'
                        ? 'bg-accent-warning/60 dark:bg-accent-warning/40'
                        : 'bg-accent-danger/60 dark:bg-accent-danger/40';
                      return (
                        <div key={i}
                          className={`flex-1 rounded-sm ${barColor} ${height}`}
                          title={`${check.status.toUpperCase()} – ${check.response_time_ms ?? 0}ms\n${formatInLocalTime(check.checked_at, 'dd.MM.yyyy HH:mm:ss')}`}
                        />
                      );
                    })}
                    {Array.from({ length: Math.max(0, 30 - bars.length) }).map((_, i) => (
                      <div key={`e-${i}`} className="flex-1 h-full rounded-sm bg-neutral-200 dark:bg-neutral-700/50" />
                    ))}
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3 text-neutral-500 dark:text-neutral-400">
                    <span>
                      {uptimePct !== null ? <><span className="font-medium text-neutral-700 dark:text-neutral-300">{uptimePct.toFixed(1)}%</span> {t('uptime_summary.uptime_percent')}</> : '—'}
                    </span>
                    <span>
                      {avgMs !== null ? <><span className="font-medium text-neutral-700 dark:text-neutral-300">{avgMs}</span>{t('uptime_summary.ms_avg')}</> : ''}
                    </span>
                  </div>
                  <span className="text-neutral-500 dark:text-neutral-400">
                    {formatTimeAgo(monitor.last_checked_at)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading-2">{t('page.title')}</h1>
          <p className="text-body-secondary mt-2">{t('page.subtitle')}</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="button-primary flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          {t('actions.refresh')}
        </button>
      </div>

      {/* Main Stats Cards — only render cards that have meaningful data */}
      {hasAnyStatCards && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Logs Card */}
          {showLogsCard && (
            <div className="card border-t-4 border-t-accent-info">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-accent-info/10">
                  <FileText className="w-5 h-5 text-accent-info" />
                </div>
                <div className="flex items-center gap-1 text-accent-info text-sm font-medium">
                  <TrendingUp className="w-4 h-4" />
                  <span>{logTrend}%</span>
                </div>
              </div>
              <p className="text-label mb-1">{t('stats.total_logs')}</p>
              <p className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">{stats?.total_logs?.toLocaleString() || 0}</p>
              <p className="text-body-secondary text-xs">{t('stats.total_logs_subtitle')}</p>
            </div>
          )}

          {/* Active Systems Card */}
          {showSystemsCard && (
            <div className="card border-t-4 border-t-accent-success">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-accent-success/10">
                  <Server className="w-5 h-5 text-accent-success" />
                </div>
                <div className="flex items-center gap-1 px-2 py-1 bg-accent-success/10 rounded-full">
                  <div className="w-2 h-2 bg-accent-success rounded-full status-pulse"></div>
                  <span className="text-accent-success text-xs font-medium">{t('stats.online_label')}</span>
                </div>
              </div>
              <p className="text-label mb-1">{t('stats.active_systems')}</p>
              <p className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">{systems.length}</p>
              <p className="text-body-secondary text-xs">{t('stats.active_systems_subtitle')}</p>
            </div>
          )}

          {/* Errors Card */}
          {showErrorsCard && (
            <div className="card border-t-4 border-t-accent-danger">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-accent-danger/10">
                  <AlertTriangle className="w-5 h-5 text-accent-danger" />
                </div>
                <div className="flex items-center gap-1 text-accent-danger text-sm font-medium">
                  <TrendingDown className="w-4 h-4" />
                  <span>{Math.abs(errorTrend)}%</span>
                </div>
              </div>
              <p className="text-label mb-1">{t('stats.errors_24h')}</p>
              <p className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">{totalErrors.toLocaleString()}</p>
              <p className="text-body-secondary text-xs">{errorRate}% {t('stats.error_rate')}</p>
            </div>
          )}

          {/* Sources Card */}
          {showSourcesCard && (
            <div className="card border-t-4 border-t-primary-500">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30">
                  <Eye className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div className="flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900/30 rounded-full">
                  <span className="text-xs font-medium text-primary-700 dark:text-primary-300">{t('stats.tracked_label')}</span>
                </div>
              </div>
              <p className="text-label mb-1">{t('stats.log_sources')}</p>
              <p className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">{stats?.top_sources?.length || 0}</p>
              <p className="text-body-secondary text-xs">{t('stats.log_sources_subtitle')}</p>
            </div>
          )}
        </div>
      )}

      {/* Uptime Monitors — only shown when monitors exist */}
      {hasMonitors && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-heading-4 flex items-center gap-2">
              <Radio className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              {t('stats.uptime_monitors')}
            </h2>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 dark:bg-emerald-500"></div>
                <span className="text-gray-600 dark:text-gray-400">{uptimeStats?.up || 0} {t('stats.up')}</span>
              </div>
              {Number(uptimeStats?.degraded) > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400 dark:bg-amber-500"></div>
                  <span className="text-amber-500 dark:text-amber-400 font-medium">{uptimeStats?.degraded} {t('stats.degraded')}</span>
                </div>
              )}
              {Number(uptimeStats?.down) > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-400 dark:bg-rose-500"></div>
                  <span className="text-rose-500 dark:text-rose-400 font-medium">{uptimeStats?.down} {t('stats.down')}</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {monitors.map((monitor) => {
              const statusColors: Record<UptimeStatus, string> = {
                up: 'bg-accent-success dark:bg-accent-success',
                down: 'bg-accent-danger dark:bg-accent-danger',
                degraded: 'bg-accent-warning dark:bg-accent-warning',
                unknown: 'bg-neutral-400 dark:bg-neutral-500'
              };

              return (
                <div key={monitor.id} className="card-compact">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className={`flex-shrink-0 w-3 h-3 rounded-full ${statusColors[monitor.current_status || 'unknown'].split(' ')[0]} ${monitor.current_status === 'down' ? 'animate-pulse' : ''}`}></div>
                      <h3 className="font-semibold text-sm text-neutral-900 dark:text-white truncate">
                        {monitor.name}
                      </h3>
                    </div>
                    <span className="font-mono text-[10px] text-neutral-500 dark:text-neutral-400 whitespace-nowrap flex-shrink-0">
                      {monitor.last_response_time ? `${monitor.last_response_time}ms` : '-'}
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate opacity-70">
                    {monitor.site_name}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Charts — only shown when there is log data */}
      {(hasActivityTimeline || hasLogDistribution) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Logs per Hour - Area Chart */}
          {hasActivityTimeline && (
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-heading-4">{t('charts.activity_timeline')}</h2>
                  <p className="text-body-secondary mt-1">{t('charts.activity_timeline_subtitle')}</p>
                </div>
                <div className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-lg text-sm font-medium border border-primary-200 dark:border-primary-800">
                  {t('charts.realtime_label')}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={stats?.logs_per_hour || []}>
                  <defs>
                    <linearGradient id="colorLogs" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    stroke="#9ca3af"
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    stroke="#9ca3af"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    fill="url(#colorLogs)"
                    activeDot={{ r: 6 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Logs by Level - Donut */}
          {hasLogDistribution && (
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-heading-4">{t('charts.log_distribution')}</h2>
                  <p className="text-body-secondary mt-1">{t('charts.log_distribution_subtitle')}</p>
                </div>
                <div className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-lg text-sm font-medium border border-primary-200 dark:border-primary-800">
                  {t('charts.breakdown_label')}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <defs>
                    <linearGradient id="pieGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#60A5FA"/>
                      <stop offset="100%" stopColor="#3B82F6"/>
                    </linearGradient>
                    <linearGradient id="pieGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#FBBF24"/>
                      <stop offset="100%" stopColor="#F59E0B"/>
                    </linearGradient>
                    <linearGradient id="pieGradient3" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#EF5350"/>
                      <stop offset="100%" stopColor="#E53935"/>
                    </linearGradient>
                    <linearGradient id="pieGradient4" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#C62828"/>
                      <stop offset="100%" stopColor="#B71C1C"/>
                    </linearGradient>
                  </defs>
                  <Pie
                    data={levelData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={false}
                    labelLine={false}
                  >
                    {levelData.map((_entry: any, index: number) => {
                      const levelName = levelData[index].name.toUpperCase();
                      let gradient = "url(#pieGradient1)"; // Default: Blue (DEBUG/INFO)

                      if (levelName === "DEBUG" || levelName === "INFO") {
                        gradient = "url(#pieGradient1)"; // Blue
                      } else if (levelName === "WARNING") {
                        gradient = "url(#pieGradient2)"; // Orange
                      } else if (levelName === "ERROR") {
                        gradient = "url(#pieGradient3)"; // Red
                      } else if (levelName === "CRITICAL") {
                        gradient = "url(#pieGradient4)"; // Dark Red
                      }

                      return (
                        <Cell
                          key={`cell-${index}`}
                          fill={gradient}
                          className="hover:opacity-80 transition-opacity cursor-pointer drop-shadow-md group"
                          style={{
                            filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.1))",
                            transition: "all 0.3s ease"
                          }}
                        />
                      );
                    })}
                  </Pie>
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ fill: 'transparent' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                {levelData.map((item: any, idx: number) => {
                  const levelName = item.name.toUpperCase();
                  let gradient = "linear-gradient(135deg, #60A5FA, #3B82F6)"; // Default: Blue

                  if (levelName === "DEBUG" || levelName === "INFO") {
                    gradient = "linear-gradient(135deg, #60A5FA, #3B82F6)"; // Blue
                  } else if (levelName === "WARNING") {
                    gradient = "linear-gradient(135deg, #FBBF24, #F59E0B)"; // Orange
                  } else if (levelName === "ERROR") {
                    gradient = "linear-gradient(135deg, #EF5350, #E53935)"; // Red
                  } else if (levelName === "CRITICAL") {
                    gradient = "linear-gradient(135deg, #C62828, #B71C1C)"; // Dark Red
                  }

                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: gradient }}></div>
                      <div className="text-xs">
                        <p className="font-medium text-gray-900 dark:text-white">{item.name}</p>
                        <p className="text-gray-500 dark:text-gray-400">{item.value}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Top Sources - Bar Chart — only shown when there are sources */}
      {hasTopSources && (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-heading-4">{t('charts.top_sources')}</h2>
              <p className="text-body-secondary mt-1">{t('charts.top_sources_subtitle')}</p>
            </div>
            <div className="px-3 py-1 bg-accent-success/10 text-accent-success rounded-lg text-sm font-medium border border-accent-success/20">
              {t('charts.top_10_label')}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats!.top_sources.slice(0, 10)} layout="vertical">
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                stroke="#9ca3af"
              />
              <YAxis
                dataKey="source"
                type="category"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                width={200}
                stroke="#9ca3af"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff'
                }}
                cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
              />
              <Bar
                dataKey="count"
                fill="url(#barGradient)"
                radius={[0, 8, 8, 0]}
                className="hover:opacity-80 transition-opacity"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Systems List — only shown when systems exist */}
      {hasSystems && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-heading-4 flex items-center gap-2">
              <Server className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              {t('systems_table.connected_systems')}
            </h2>
            <div className="px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-lg text-sm font-medium border border-primary-200 dark:border-primary-800">
              {systems.length} {t('systems_table.total_label')}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {systems.map((system: any) => (
              <div
                key={system.id}
                className="card-compact flex items-center gap-3 group"
              >
                <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Server className="w-5 h-5 text-white" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-base text-neutral-900 dark:text-white truncate">
                      {system.name}
                    </h3>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-accent-success dark:bg-accent-success rounded-full animate-pulse"></div>
                      <span className="text-[10px] font-medium text-accent-success">{t('systems_table.active_label')}</span>
                    </div>
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate opacity-70">
                    {system.site_name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
