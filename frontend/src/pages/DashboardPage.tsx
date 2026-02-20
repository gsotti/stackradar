import React, { useState, useEffect } from 'react';
import { FileText, Server, AlertTriangle, Activity, RefreshCw, TrendingUp, TrendingDown, Zap, Clock, Eye, Radio } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area } from 'recharts';
import { api } from '../utils/api';
import { useApp } from '../contexts/AppContext';
import { Site, System, UptimeMonitor, UptimeCheck, UptimeStatus } from '../types';
import { formatInLocalTime, parseAsUTC } from '../utils/dateUtils';

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
      const isUptimeOnly = st.length > 0 && st.every(s => s.has_metrics === false);
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
  const isUptimeOnly = sites.length > 0 && sites.every(s => s.has_metrics === false);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  const levelData = stats?.logs_by_level ? Object.entries(stats.logs_by_level).map(([name, value]) => ({ name, value })) : [];
  const totalErrors = (stats?.logs_by_level?.ERROR || 0) + (stats?.logs_by_level?.CRITICAL || 0);
  const errorRate = stats?.total_logs ? ((totalErrors / stats.total_logs) * 100).toFixed(1) : '0';

  // Calculate trends (mock for now - would need historical data)
  const logTrend = 12.5;
  const errorTrend = -3.2;

  const uptimeRate = uptimeStats && uptimeStats.total > 0
    ? ((uptimeStats.up / uptimeStats.total) * 100).toFixed(1)
    : '100';

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
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Dashboard Overview
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Real-time monitoring and analytics</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-lg hover:shadow-xl"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Activity className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">No data yet</h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-sm">
            Start ingesting logs or configure uptime monitors to see data here.
            {selectedTenant && ' Try switching to a different tenant.'}
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

    function formatTimeAgo(date: string | null | undefined) {
      if (!date) return 'Never';
      const parsed = parseAsUTC(date);
      if (!parsed) return date;
      const seconds = Math.floor((Date.now() - parsed.getTime()) / 1000);
      if (seconds < 0) return 'Just now';
      if (seconds < 60) return `${seconds}s ago`;
      if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
      if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
      return `${Math.floor(seconds / 86400)}d ago`;
    }

    return (
      <div className="space-y-6 pb-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Dashboard Overview
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Real-time monitoring and analytics</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-lg hover:shadow-xl"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Summary stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium mb-2">Endpoints</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{monitors.length}</p>
            <div className="flex items-center gap-2.5 mt-2 text-xs text-gray-500 dark:text-gray-400">
              <span>{upCount} up</span>
              {downCount > 0 && <span className="font-medium text-gray-700 dark:text-gray-300">{downCount} down</span>}
              {degradedCount > 0 && <span>{degradedCount} degraded</span>}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium mb-2">Uptime</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {uptimeOnlyPct !== null ? `${uptimeOnlyPct.toFixed(1)}%` : '—'}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Last 30 checks</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium mb-2">Avg Response</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {avgResponseTime !== null ? <>{avgResponseTime}<span className="text-sm font-normal text-gray-400 ml-0.5">ms</span></> : '—'}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Across all monitors</p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider font-medium mb-2">Sites</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{sites.length}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Being monitored</p>
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
              <div key={monitor.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-1.5 ${statusDot[mStatus]}`} />
                      <span className="font-medium text-sm text-gray-900 dark:text-white truncate">{monitor.name}</span>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5 pl-4">
                      {monitor.url.replace(/^https?:\/\//, '')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {monitor.is_main && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 uppercase">Main</span>
                    )}
                    {!monitor.enabled && (
                      <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">Paused</span>
                    )}
                  </div>
                </div>

                {/* Sparkline */}
                <div className="mb-3">
                  <div className="flex gap-px h-6 items-end">
                    {bars.map((check, i) => {
                      const height = check.status === 'up' ? 'h-full' : check.status === 'degraded' ? 'h-3/4' : 'h-1/2';
                      const barColor = check.status === 'up'
                        ? 'bg-emerald-300/60 dark:bg-emerald-600/40'
                        : check.status === 'degraded'
                        ? 'bg-amber-300/60 dark:bg-amber-600/40'
                        : 'bg-rose-300/60 dark:bg-rose-600/40';
                      return (
                        <div key={i}
                          className={`flex-1 rounded-sm ${barColor} ${height}`}
                          title={`${check.status.toUpperCase()} – ${check.response_time_ms ?? 0}ms\n${formatInLocalTime(check.checked_at, 'dd.MM.yyyy HH:mm:ss')}`}
                        />
                      );
                    })}
                    {Array.from({ length: Math.max(0, 30 - bars.length) }).map((_, i) => (
                      <div key={`e-${i}`} className="flex-1 h-full rounded-sm bg-gray-100 dark:bg-gray-700/50" />
                    ))}
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3 text-gray-500 dark:text-gray-400">
                    <span>
                      {uptimePct !== null ? <><span className="font-medium text-gray-700 dark:text-gray-300">{uptimePct.toFixed(1)}%</span> uptime</> : '—'}
                    </span>
                    <span>
                      {avgMs !== null ? <><span className="font-medium text-gray-700 dark:text-gray-300">{avgMs}</span>ms avg</> : ''}
                    </span>
                  </div>
                  <span className="text-gray-400 dark:text-gray-500">
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
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Dashboard Overview
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Real-time monitoring and analytics</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-lg hover:shadow-xl"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Main Stats Cards — only render cards that have meaningful data */}
      {hasAnyStatCards && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Logs Card */}
          {showLogsCard && (
            <div className="group relative bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FileText className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex items-center gap-1 text-white/90 text-sm">
                    <TrendingUp className="w-4 h-4" />
                    <span className="font-medium">{logTrend}%</span>
                  </div>
                </div>
                <p className="text-blue-100 text-sm font-medium mb-1">Total Logs (24h)</p>
                <p className="text-4xl font-bold text-white mb-2">{stats?.total_logs?.toLocaleString() || 0}</p>
                <div className="flex items-center gap-2 text-blue-100 text-xs">
                  <Clock className="w-3 h-3" />
                  <span>Last 24 hours</span>
                </div>
              </div>
            </div>
          )}

          {/* Active Systems Card */}
          {showSystemsCard && (
            <div className="group relative bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Server className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 bg-white/20 backdrop-blur-sm rounded-full">
                    <div className="w-2 h-2 bg-green-200 rounded-full animate-pulse"></div>
                    <span className="text-white text-xs font-medium">Online</span>
                  </div>
                </div>
                <p className="text-green-100 text-sm font-medium mb-1">Active Systems</p>
                <p className="text-4xl font-bold text-white mb-2">{systems.length}</p>
                <div className="flex items-center gap-2 text-green-100 text-xs">
                  <Activity className="w-3 h-3" />
                  <span>All systems operational</span>
                </div>
              </div>
            </div>
          )}

          {/* Errors Card */}
          {showErrorsCard && (
            <div className="group relative bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <AlertTriangle className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex items-center gap-1 text-white/90 text-sm">
                    <TrendingDown className="w-4 h-4" />
                    <span className="font-medium">{Math.abs(errorTrend)}%</span>
                  </div>
                </div>
                <p className="text-red-100 text-sm font-medium mb-1">Errors (24h)</p>
                <p className="text-4xl font-bold text-white mb-2">{totalErrors.toLocaleString()}</p>
                <div className="flex items-center gap-2 text-red-100 text-xs">
                  <Zap className="w-3 h-3" />
                  <span>{errorRate}% error rate</span>
                </div>
              </div>
            </div>
          )}

          {/* Sources Card */}
          {showSourcesCard && (
            <div className="group relative bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Eye className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 bg-white/20 backdrop-blur-sm rounded-full">
                    <span className="text-white text-xs font-medium">Tracked</span>
                  </div>
                </div>
                <p className="text-purple-100 text-sm font-medium mb-1">Log Sources</p>
                <p className="text-4xl font-bold text-white mb-2">{stats?.top_sources?.length || 0}</p>
                <div className="flex items-center gap-2 text-purple-100 text-xs">
                  <Activity className="w-3 h-3" />
                  <span>Unique sources</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Uptime Monitors — only shown when monitors exist */}
      {hasMonitors && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Radio className="w-5 h-5 text-blue-500" />
              Uptime Monitors
            </h2>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 dark:bg-emerald-500"></div>
                <span className="text-gray-600 dark:text-gray-400">{uptimeStats?.up || 0} Up</span>
              </div>
              {Number(uptimeStats?.degraded) > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400 dark:bg-amber-500"></div>
                  <span className="text-amber-500 dark:text-amber-400 font-medium">{uptimeStats?.degraded} Degraded</span>
                </div>
              )}
              {Number(uptimeStats?.down) > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-400 dark:bg-rose-500"></div>
                  <span className="text-rose-500 dark:text-rose-400 font-medium">{uptimeStats?.down} Down</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {monitors.map((monitor) => {
              const statusColors: Record<UptimeStatus, string> = {
                up: 'bg-emerald-400 dark:bg-emerald-500',
                down: 'bg-rose-400 dark:bg-rose-500',
                degraded: 'bg-amber-400 dark:bg-amber-500',
                unknown: 'bg-gray-300 dark:bg-gray-500'
              };

              return (
                <div key={monitor.id} className="bg-white dark:bg-gray-800 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-700 flex items-center gap-3 group transition-colors hover:border-blue-400 dark:hover:border-blue-500">
                  <div className={`flex-shrink-0 w-3 h-3 rounded-full ${statusColors[monitor.current_status || 'unknown']} ${monitor.current_status === 'down' ? 'animate-pulse' : ''}`}></div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                        {monitor.name}
                      </h3>
                      <span className="font-mono text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {monitor.last_response_time ? `${monitor.last_response_time}ms` : '-'}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate opacity-70">
                      {monitor.site_name}
                    </p>
                  </div>
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
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Activity Timeline</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Logs per hour (last 24h)</p>
                </div>
                <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-medium">
                  Real-time
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
                    dot={{ fill: '#3b82f6', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Logs by Level - Donut */}
          {hasLogDistribution && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-shadow">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Log Distribution</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">By severity level</p>
                </div>
                <div className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-lg text-sm font-medium">
                  Breakdown
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={levelData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {levelData.map((_entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                        className="hover:opacity-80 transition-opacity cursor-pointer"
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Top Sources - Bar Chart — only shown when there are sources */}
      {hasTopSources && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Top Log Sources</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Most active sources in the last 24 hours</p>
            </div>
            <div className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-lg text-sm font-medium">
              Top 10
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
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-blue-500" />
              Connected Systems
            </h2>
            <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-medium">
              {systems.length} Total
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {systems.map((system: any) => (
              <div
                key={system.id}
                className="bg-white dark:bg-gray-800 rounded-lg px-4 py-3 border border-gray-200 dark:border-gray-700 flex items-center gap-4 group transition-colors hover:border-blue-400 dark:hover:border-blue-500"
              >
                <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Server className="w-5 h-5 text-white" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-base text-gray-900 dark:text-white truncate">
                      {system.name}
                    </h3>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 bg-emerald-400 dark:bg-emerald-500 rounded-full animate-pulse"></div>
                      <span className="text-[10px] font-medium text-emerald-500 dark:text-emerald-400">Active</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate opacity-70">
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
