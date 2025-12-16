import React, { useState, useEffect } from 'react';
import { FileText, Server, AlertTriangle, Activity, RefreshCw, TrendingUp, TrendingDown, Zap, Clock, Eye } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area } from 'recharts';
import { api } from '../utils/api';
import { useApp } from '../contexts/AppContext';

export default function DashboardPage() {
  const { selectedTenant, selectedEnvironment } = useApp();
  const [systems, setSystems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const statsParams = new URLSearchParams();
    statsParams.append('hours', '24');
    if (selectedTenant) statsParams.append('tenant', selectedTenant);
    if (selectedEnvironment) statsParams.append('environment', selectedEnvironment);

    const systemsParams = new URLSearchParams();
    if (selectedTenant) systemsParams.append('tenant_id', selectedTenant);

    Promise.all([
      api.get(`/systems?${systemsParams}`),
      api.get(`/logs/stats?${statsParams}`)
    ]).then(([sys, st]) => {
      setSystems(sys);
      setStats(st);
    }).finally(() => setLoading(false));
  }, [selectedTenant, selectedEnvironment]);

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
  const errorRate = stats?.total_logs ? ((totalErrors / stats.total_logs) * 100).toFixed(1) : 0;

  // Calculate trends (mock for now - would need historical data)
  const logTrend = 12.5;
  const errorTrend = -3.2;

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
                  {levelData.map((entry, index) => (
                    <Cell
                      key={entry.name}
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
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-shadow">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Connected Systems</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">All registered logging systems</p>
          </div>
          <div className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg text-sm font-medium">
            {systems.length} Total
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {systems.map((system) => (
            <div
              key={system.id}
              className="group relative bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 transition-all hover:shadow-lg cursor-pointer"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Server className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {system.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">ID: {system.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                  Active
                </div>
              </div>
            </div>
          ))}
          {systems.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500 dark:text-gray-400">
              No systems connected yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
