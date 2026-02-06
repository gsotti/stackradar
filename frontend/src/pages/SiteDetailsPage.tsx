import React, { useEffect, useState, FormEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { RefreshCw, ArrowLeft, Server, Activity, CheckCircle, AlertTriangle, Bell, BarChart2, Settings, Eye, EyeOff, Copy, Trash2, Terminal, Clock, Box, Radio } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { format } from 'date-fns';
import { formatInLocalTime } from '../utils/dateUtils';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import AlertsView from '../components/alerts/AlertsView';
import SiteSetupInstructions from '../components/SiteSetupInstructions';
import UptimeMonitorsView from '../components/uptime/UptimeMonitorsView';
import { Site, K8sMetrics } from '../types';

interface LiveMetricPoint {
  timestamp: string;
  cpu_usage_percent: number;
  memory_usage_percent: number;
}

interface LiveMetricsResponse {
  points: LiveMetricPoint[];
}

export default function SiteDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [site, setSite] = useState<Site | null>(null);
  const [live, setLive] = useState<LiveMetricsResponse>({ points: [] });
  const [summary, setSummary] = useState<K8sMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeTab, setActiveTab] = useState('metrics');
  const [form, setForm] = useState({ name: '', description: '', retention_days: 30, site_type: 'kubernetes' as const });
  const [tokenVisible, setTokenVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    try {
      const [st, l, s] = await Promise.all([
        api.get<Site>(`/sites/${id}`),
        api.get<LiveMetricsResponse>(`/sites/${id}/k8s-metrics/live`),
        api.get<K8sMetrics>(`/sites/${id}/k8s-metrics`)
      ]);
      setSite(st);
      setLive(l || { points: [] });
      setSummary(s || null);
      setForm({
        name: st.name || '',
        description: st.description || '',
        retention_days: st.retention_days || 30,
        site_type: st.site_type || 'kubernetes'
      });
    } catch (error: any) {
      showError(error.message || 'Failed to fetch site details');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.put<Site>(`/sites/${id}`, form);
      setSite(updated);
      showSuccess('Site settings saved');
    } catch (error: any) {
      showError(error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateToken = async () => {
    if (confirm('Are you sure? This will invalidate the current token.')) {
      try {
        const updated = await api.post<Site>(`/sites/${id}/regenerate-token`, {});
        setSite(updated);
        showSuccess('API token regenerated');
      } catch (error: any) {
        showError(error.message || 'Failed to regenerate token');
      }
    }
  };

  const copyToken = () => {
    if (site?.api_token) {
      navigator.clipboard.writeText(site.api_token);
      showSuccess('Token copied to clipboard');
    }
  };

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this site? This action cannot be undone.')) {
      try {
        await api.delete(`/sites/${id}`);
        showSuccess('Site deleted');
        navigate('/sites');
      } catch (error: any) {
        showError(error.message || 'Failed to delete site');
      }
    }
  };

  useEffect(() => {
    fetchAll();
    let interval: ReturnType<typeof setInterval> | undefined;
    if (autoRefresh) {
      interval = setInterval(async () => {
        try {
          const l = await api.get<LiveMetricsResponse>(`/sites/${id}/k8s-metrics/live`);
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
  const safeNumber = (v: number | string | undefined | null, d = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };
  const safePercent = (v: number | string | undefined | null, fd = 1) => safeNumber(v, 0).toFixed(fd);

  // Get labels based on site type
  const isDocker = site?.site_type === 'docker';
  const isK8s = site?.site_type === 'kubernetes';
  const labels = {
    containers: isDocker ? 'Containers' : 'Pods',
    hosts: isDocker ? 'Host' : 'Nodes',
    deployments: isDocker ? 'Running' : 'Deployments',
    platform: isDocker ? 'Docker' : isK8s ? 'Kubernetes' : 'Infrastructure'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-6rem)]">
        <div className="text-center">
          <RefreshCw className="w-10 h-10 animate-spin text-blue-500 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">Loading site details…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/sites" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
            <Server className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{site?.name || `Site #${id}`}</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {activeTab === 'metrics' ? `${labels.platform} metrics - live CPU/Memory (last 30 minutes)` : 'Alert management and monitoring'}
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
            onClick={() => setActiveTab('monitors')}
            className={`
              flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors
              ${
                activeTab === 'monitors'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300'
              }
            `}
          >
            <Radio className="w-4 h-4" />
            Monitors
          </button>
          {!user?.is_viewer && (
            <>
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
              <button
                onClick={() => setActiveTab('setup')}
                className={`
                  flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors
                  ${
                    activeTab === 'setup'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300'
                  }
                `}
              >
                <Terminal className="w-4 h-4" />
                Setup
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`
                  flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors
                  ${
                    activeTab === 'settings'
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300'
                  }
                `}
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
            </>
          )}
        </nav>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'metrics' ? (
        <>
          {/* Site Info Bar */}
          <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-2">
              <Box className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Type:</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">{labels.platform}</span>
            </div>
            <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-500 dark:text-gray-400">Retention:</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">{site?.retention_days} days</span>
            </div>
            {site?.description && (
              <>
                <div className="w-px h-4 bg-gray-300 dark:bg-gray-600" />
                <span className="text-sm text-gray-500 dark:text-gray-400 truncate">{site.description}</span>
              </>
            )}
          </div>

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

          {/* Pods/Containers */}
          <div className="group relative bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-green-500/20 text-green-600 dark:text-green-400 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div className="px-2 py-0.5 text-xs rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">{labels.containers}</div>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Running / Total</div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">{safeNumber(summary.pod_running)}/{safeNumber(summary.pod_count)}</div>
            <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              {isDocker ? `Stopped: ${safeNumber(summary.pod_failed)}` : `Pending: ${safeNumber(summary.pod_pending)} · Failed: ${safeNumber(summary.pod_failed)}`}
            </div>
          </div>

          {/* Nodes/Host */}
          <div className="group relative bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center">
                <Server className="w-5 h-5" />
              </div>
              <div className="px-2 py-0.5 text-xs rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">{labels.hosts}</div>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{isDocker ? 'Status' : 'Ready / Total'}</div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">
              {isDocker ? (safeNumber(summary.node_count) > 0 ? 'Online' : 'Offline') : `${safeNumber(summary.node_ready)}/${safeNumber(summary.node_count)}`}
            </div>
          </div>

          {/* Deployments/Running */}
          <div className="group relative bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
              <div className="px-2 py-0.5 text-xs rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300">{labels.deployments}</div>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{isDocker ? 'Containers' : 'Ready / Total'}</div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">
              {isDocker ? safeNumber(summary.deployment_ready) : `${safeNumber(summary.deployment_ready)}/${safeNumber(summary.deployment_count)}`}
            </div>
          </div>

          {/* Services & PVCs (K8s only) / Network (Docker) */}
          {!isDocker ? (
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
              <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">PVs: <span className="font-semibold text-gray-900 dark:text-white">{safeNumber(summary.pv_count)}</span></div>
            </div>
          ) : (
            <div className="group relative bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 rounded-lg flex items-center justify-center">
                  <Activity className="w-5 h-5" />
                </div>
                <div className="px-2 py-0.5 text-xs rounded-full bg-cyan-100 dark:bg-cyan-900 text-cyan-700 dark:text-cyan-300">Network</div>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Total Containers</div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">{safeNumber(summary.pod_count)}</div>
              <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">Running: <span className="font-semibold text-gray-900 dark:text-white">{safeNumber(summary.pod_running)}</span></div>
            </div>
          )}
        </div>
          ) : (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200 rounded-lg p-4">
              No {labels.platform.toLowerCase()} metrics available yet for this site.
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
                      tickFormatter={(t) => formatInLocalTime(t, 'HH:mm:ss')}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      stroke="#9ca3af"
                    />
                    <Tooltip
                      labelFormatter={(l) => formatInLocalTime(l, 'dd.MM.yyyy HH:mm:ss')}
                      formatter={(v: any, _n: any, item: any) => [`${Number(v).toFixed(1)}%`, item?.dataKey === 'cpu_usage_percent' ? 'CPU' : 'Memory']}
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
      ) : activeTab === 'monitors' ? (
        <UptimeMonitorsView siteId={id!} />
      ) : activeTab === 'alerts' ? (
        <AlertsView siteId={id!} />
      ) : activeTab === 'setup' ? (
        <SiteSetupInstructions site={site!} embedded />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Site Settings Form */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Site Settings</h2>
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Site Type</label>
                  <select
                    value={form.site_type}
                    onChange={(e) => setForm({ ...form, site_type: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="docker">Docker Host</option>
                    <option value="kubernetes">Kubernetes Cluster</option>
                    <option value="generic">Generic Host</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Retention (days)</label>
                  <input
                    type="number"
                    value={form.retention_days}
                    onChange={(e) => setForm({ ...form, retention_days: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    min={1}
                    max={365}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl transition-all shadow-lg hover:shadow-xl font-medium disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </form>
          </div>

          {/* Right Column - API Token & Danger Zone */}
          <div className="space-y-6">
            {/* API Token */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">API Token</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Use this token to authenticate log ingestion from collectors.
              </p>
              <div className="flex items-center gap-2 mb-4">
                <code className={`flex-1 text-sm bg-gray-50 dark:bg-gray-900 px-3 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 break-all font-mono ${tokenVisible ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-600 tracking-wider'}`}>
                  {tokenVisible ? site?.api_token : '••••••••••••••••••••••••••••••••'}
                </code>
                <button
                  onClick={() => setTokenVisible(!tokenVisible)}
                  className="p-2.5 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                  title={tokenVisible ? 'Hide token' : 'Show token'}
                >
                  {tokenVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
                <button
                  onClick={copyToken}
                  className="p-2.5 text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                  title="Copy token"
                >
                  <Copy className="w-5 h-5" />
                </button>
              </div>
              <button
                onClick={handleRegenerateToken}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-orange-300 dark:border-orange-700 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-xl transition-all font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                Regenerate Token
              </button>
            </div>

            {/* Danger Zone */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-red-200 dark:border-red-900">
              <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">Danger Zone</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Deleting this site will permanently remove all associated environments, systems, logs, and metrics. This action cannot be undone.
              </p>
              <button
                onClick={handleDelete}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all font-medium"
              >
                <Trash2 className="w-4 h-4" />
                Delete Site
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
