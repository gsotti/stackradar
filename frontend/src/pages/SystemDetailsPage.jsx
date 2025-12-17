import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { RefreshCw, ArrowLeft, Server, Activity, CheckCircle, AlertTriangle, Bell, BarChart2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { api } from '../utils/api';
import AlertsView from '../components/alerts/AlertsView';

export default function SystemDetailsPage() {
  const { id } = useParams();
  const [system, setSystem] = useState(null);
  const [live, setLive] = useState({ points: [] });
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeTab, setActiveTab] = useState('metrics');

  const fetchAll = async () => {
    try {
      const [sys, l, s] = await Promise.all([
        api.get(`/systems/${id}`),
        api.get(`/systems/${id}/k8s-metrics/live`),
        api.get(`/systems/${id}/k8s-metrics`)
      ]);
      setSystem(sys);
      setLive(l || { points: [] });
      setSummary(s || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    let interval;
    if (autoRefresh) {
      interval = setInterval(async () => {
        try {
          const l = await api.get(`/systems/${id}/k8s-metrics/live`);
          setLive(l || { points: [] });
        } catch (e) {
          // ignore transient errors
        }
      }, 10000);
    }
    return () => interval && clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, autoRefresh]);

  const data = live?.points || [];

  // Safe helpers
  const safeNumber = (v, d = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };
  const safePercent = (v, fd = 1) => safeNumber(v, 0).toFixed(fd);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-6rem)]">
        <div className="text-center">
          <RefreshCw className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">Loading system details…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/systems" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
            <Server className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{system?.name || `System #${id}`}</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {activeTab === 'metrics' ? 'Kubernetes summary and live CPU/Memory (last 30 minutes)' : 'Alert management and monitoring'}
            </p>
          </div>
        </div>
        {activeTab === 'metrics' && (
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${autoRefresh ? 'bg-blue-600 text-white border-blue-600' : 'bg-transparent text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'}`}
          >
            {autoRefresh ? 'Auto-refresh: ON' : 'Auto-refresh: OFF'}
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('metrics')}
            className={`
              flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors
              ${
                activeTab === 'metrics'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300'
              }
            `}
          >
            <BarChart2 className="w-4 h-4" />
            Metrics
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            className={`
              flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors
              ${
                activeTab === 'alerts'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300'
              }
            `}
          >
            <Bell className="w-4 h-4" />
            Alerts
          </button>
        </nav>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'metrics' ? (
        <>
          {/* Summary grid styled like KubernetesPage */}
          {summary ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* CPU usage */}
          <div className="group relative bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-lg flex items-center justify-center">
                %
              </div>
              <div className="px-2 py-0.5 text-xs rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">CPU</div>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">CPU Usage</div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{safePercent(summary.cpu_usage_percent, 1)}%</div>
          </div>

          {/* Memory usage */}
          <div className="group relative bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-lg flex items-center justify-center">
                %
              </div>
              <div className="px-2 py-0.5 text-xs rounded-full bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">Memory</div>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Memory Usage</div>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{safePercent(summary.memory_usage_percent, 1)}%</div>
          </div>

          {/* Pods */}
          <div className="group relative bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-green-500/20 text-green-600 dark:text-green-400 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div className="px-2 py-0.5 text-xs rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">Pods</div>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Running / Total</div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">{safeNumber(summary.pod_running)}/{safeNumber(summary.pod_count)}</div>
            <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">Pending: {safeNumber(summary.pod_pending)} · Failed: {safeNumber(summary.pod_failed)}</div>
          </div>

          {/* Nodes */}
          <div className="group relative bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center">
                <Server className="w-5 h-5" />
              </div>
              <div className="px-2 py-0.5 text-xs rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">Nodes</div>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Ready / Total</div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">{safeNumber(summary.node_ready)}/{safeNumber(summary.node_count)}</div>
          </div>

          {/* Deployments */}
          <div className="group relative bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
              <div className="px-2 py-0.5 text-xs rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">Deployments</div>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Ready / Total</div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">{safeNumber(summary.deployment_ready)}/{safeNumber(summary.deployment_count)}</div>
          </div>

          {/* Services & PVCs */}
          <div className="group relative bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="px-2 py-0.5 text-xs rounded-full bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300">Services/PVCs</div>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Services</div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">{safeNumber(summary.service_count)}</div>
            <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">PVCs (bound/total): <span className="font-semibold text-gray-900 dark:text-white">{safeNumber(summary.pvc_bound)}/{safeNumber(summary.pvc_count)}</span></div>
          </div>
        </div>
          ) : (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200 rounded-lg p-4">
              No Kubernetes metrics available yet for this system.
            </div>
          )}

          <div className="grid grid-cols-1 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">CPU & Memory (Live)</h2>
                <button onClick={fetchAll} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <RefreshCw className="w-4 h-4" /> Refresh
                </button>
              </div>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
                    <XAxis
                      dataKey="timestamp"
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      stroke="#9ca3af"
                      tickFormatter={(t) => new Date(t).toLocaleTimeString()}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      stroke="#9ca3af"
                    />
                    <Tooltip
                      labelFormatter={(l) => new Date(l).toLocaleString()}
                      formatter={(v, _n, item) => [`${Number(v).toFixed(1)}%`, item?.dataKey === 'cpu_usage_percent' ? 'CPU' : 'Memory']}
                      cursor={{
                        // subtle hover overlay tuned per theme
                        fill: typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(0,0,0,0.04)'
                      }}
                      contentStyle={{
                        backgroundColor: typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? '#111827' : '#ffffff',
                        color: typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? '#F9FAFB' : '#111827',
                        border: '1px solid',
                        borderColor: typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb',
                        borderRadius: 8
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="cpu_usage_percent" name="CPU" stroke="#3b82f6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="memory_usage_percent" name="Memory" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      ) : (
        <AlertsView systemId={id} />
      )}
    </div>
  );
}
