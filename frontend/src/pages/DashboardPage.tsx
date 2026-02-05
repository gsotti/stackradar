import React, { useState, useEffect } from 'react';
import { FileText, Server, AlertTriangle, Activity, RefreshCw, TrendingUp, TrendingDown, Zap, Clock, Eye, Radio } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area } from 'recharts';
import { api } from '../utils/api';
import { useApp } from '../contexts/AppContext';
import { System, UptimeMonitor, UptimeStatus } from '../types';

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
  const [systems, setSystems] = useState<System[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [uptimeStats, setUptimeStats] = useState<UptimeStats | null>(null);
  const [monitors, setMonitors] = useState<UptimeMonitor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const statsParams = new URLSearchParams();
    statsParams.append('hours', '24');
    if (selectedTenant) statsParams.append('tenant', selectedTenant);
    if (selectedEnvironment) statsParams.append('environment', selectedEnvironment);

    const systemsParams = new URLSearchParams();
    if (selectedTenant) systemsParams.append('tenant_id', selectedTenant);

    const uptimeParams = new URLSearchParams();
    if (selectedTenant) uptimeParams.append('tenant', selectedTenant);
    if (selectedEnvironment) uptimeParams.append('environment', selectedEnvironment);
    if (selectedSite) uptimeParams.append('site', selectedSite);

    setLoading(true);
    Promise.all([
      api.get<System[]>(`/systems?${systemsParams}`),
      api.get<DashboardStats>(`/logs/stats?${statsParams}`),
      api.get<UptimeStats>(`/uptime/stats?${uptimeParams}`).catch(() => null),
      api.get<UptimeMonitor[]>(`/uptime/monitors/all?${uptimeParams}`).catch(() => [])
    ]).then(([sys, st, up, mon]) => {
      setSystems(sys);
      setStats(st);
      setUptimeStats(up);
      setMonitors(mon || []);
    }).finally(() => setLoading(false));
  }, [selectedTenant, selectedEnvironment, selectedSite]);

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

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Logs Card */}
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

        {/* Active Systems Card */}
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

        {/* Errors Card */}
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

        {/* Sources Card */}
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
      </div>

      {/* Uptime Monitors - Flat Cards */}
      {monitors.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Radio className="w-5 h-5 text-blue-500" />
              Uptime Monitors
            </h2>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                <span className="text-gray-600 dark:text-gray-400">{uptimeStats?.up || 0} Up</span>
              </div>
              {Number(uptimeStats?.degraded) > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                  <span className="text-yellow-600 dark:text-yellow-400 font-medium">{uptimeStats?.degraded} Degraded</span>
                </div>
              )}
              {Number(uptimeStats?.down) > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></div>
                  <span className="text-red-600 dark:text-red-400 font-medium">{uptimeStats?.down} Down</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {monitors.map((monitor) => {
              const statusColors: Record<UptimeStatus, string> = {
                up: 'bg-green-500',
                down: 'bg-red-500',
                degraded: 'bg-yellow-500',
                unknown: 'bg-gray-400'
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

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Logs per Hour - Area Chart */}
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

        {/* Logs by Level - Enhanced Donut */}
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
          {levelData.length > 0 ? (
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
          ) : (
            <div className="h-[280px] flex items-center justify-center text-gray-500 dark:text-gray-400">
              No log data available
            </div>
          )}
        </div>
      </div>

      {/* Top Sources - Enhanced Bar Chart */}
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
        {stats?.top_sources && stats.top_sources.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.top_sources.slice(0, 10)} layout="vertical">
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
        ) : (
          <div className="h-[300px] flex items-center justify-center text-gray-500 dark:text-gray-400">
            No source data available
          </div>
        )}
      </div>

      {/* Systems List */}
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
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-[10px] font-medium text-green-600 dark:text-green-400">Active</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate opacity-70">
                  {system.site_name}
                </p>
              </div>
            </div>
          ))}
          {systems.length === 0 && (
            <div className="col-span-full bg-white dark:bg-gray-800 rounded-xl p-8 text-center border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
              No systems connected yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
