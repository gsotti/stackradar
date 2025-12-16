import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Settings, RefreshCw, Server, Eye, EyeOff, Copy } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { api } from '../utils/api';
import { useApp } from '../contexts/AppContext';
import { useNotification } from '../contexts/NotificationContext';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function SystemsPage() {
  const { selectedTenant } = useApp();
  const { showError, showSuccess } = useNotification();
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSystem, setEditingSystem] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', retention_days: 30 });
  const [visibleTokens, setVisibleTokens] = useState({});
  const [k8sMetrics, setK8sMetrics] = useState({});
  const [history, setHistory] = useState({}); // { [systemId]: { points: [...] } }

  // Safely format percentage values that may arrive as strings/null/undefined
  const safePercent = (val, fractionDigits = 1) => {
    const n = Number(val);
    return Number.isFinite(n) ? n.toFixed(fractionDigits) : (0).toFixed(fractionDigits);
  };

  useEffect(() => {
    fetchSystems();
  }, [selectedTenant]);

  // Fetch K8s metrics for all systems
  useEffect(() => {
    const fetchK8sMetrics = async () => {
      const metricsMap = {};
      for (const system of systems) {
        try {
          const metrics = await api.get(`/systems/${system.id}/k8s-metrics`);
          if (metrics) {
            metricsMap[system.id] = metrics;
          }
        } catch (error) {
          console.error(`Error fetching K8s metrics for system ${system.id}:`, error);
        }
      }
      setK8sMetrics(metricsMap);
    };

    if (systems.length > 0) {
      fetchK8sMetrics();
    }
  }, [systems]);

  // Fetch historical metrics for graphs (last 24h, step 5m)
  useEffect(() => {
    const fetchHistory = async () => {
      const next = {};
      const now = new Date();
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const to = now.toISOString();
      for (const system of systems) {
        try {
          const data = await api.get(`/systems/${system.id}/k8s-metrics/history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&step=5m`);
          next[system.id] = data;
        } catch (e) {
          console.error('Failed to fetch history for system', system.id, e);
        }
      }
      setHistory(next);
    };
    if (systems.length > 0) {
      fetchHistory();
    }
  }, [systems]);

  const fetchSystems = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedTenant) params.append('tenant_id', selectedTenant);
    const data = await api.get(`/systems?${params}`);
    setSystems(data);
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Check if tenant is selected
    if (!selectedTenant) {
      showError('Please select a tenant from the sidebar before creating a system');
      return;
    }

    const submitData = { ...form, tenant_id: selectedTenant };

    try {
      if (editingSystem) {
        await api.put(`/systems/${editingSystem.id}`, submitData);
        showSuccess('System updated successfully');
      } else {
        await api.post('/systems', submitData);
        showSuccess('System created successfully');
      }
      setShowForm(false);
      setEditingSystem(null);
      setForm({ name: '', description: '', retention_days: 30 });
      fetchSystems();
    } catch (error) {
      showError(error.message || 'Failed to save system');
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this system?')) {
      await api.delete(`/systems/${id}`);
      fetchSystems();
    }
  };

  const handleRegenerateToken = async (id) => {
    if (confirm('Are you sure? This will invalidate the current token.')) {
      await api.post(`/systems/${id}/regenerate-token`);
      fetchSystems();
    }
  };

  const copyToken = (token) => {
    navigator.clipboard.writeText(token);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Systems</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your log collection systems</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingSystem(null); setForm({ name: '', description: '', retention_days: 30 }); }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 font-medium"
        >
          <Plus className="w-4 h-4" />
          Add System
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-700 transform transition-all">
            <h2 className="text-xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {editingSystem ? 'Edit System' : 'Add New System'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all hover:border-blue-400 dark:hover:border-blue-500 shadow-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all hover:border-blue-400 dark:hover:border-blue-500 shadow-sm"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Retention (days)</label>
                <input
                  type="number"
                  value={form.retention_days}
                  onChange={(e) => setForm({ ...form, retention_days: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all hover:border-blue-400 dark:hover:border-blue-500 shadow-sm"
                  min={1}
                  max={365}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all font-medium shadow-sm hover:shadow-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl transition-all shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 font-medium"
                >
                  {editingSystem ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Systems List */}
      <div className="grid gap-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <RefreshCw className="w-10 h-10 animate-spin text-blue-500 mb-3" />
            <span className="text-gray-600 dark:text-gray-400 font-medium">Loading systems...</span>
          </div>
        ) : systems.length === 0 ? (
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-12 text-center border border-gray-200 dark:border-gray-700 shadow-lg">
            <Server className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
            <p className="text-gray-600 dark:text-gray-400 font-medium">No systems yet. Create one to start collecting logs.</p>
          </div>
        ) : (
          systems.map((system) => (
            <div key={system.id} className="group bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Server className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{system.name}</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">{system.description || 'No description'}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditingSystem(system); setForm({ name: system.name, description: system.description, retention_days: system.retention_days }); setShowForm(true); }}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(system.id)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 text-sm mb-4">
                <div className="bg-white/50 dark:bg-gray-700/50 rounded-xl p-3">
                  <span className="text-gray-500 dark:text-gray-400 text-xs">Retention:</span>
                  <span className="ml-2 font-bold text-gray-900 dark:text-white">{system.retention_days} days</span>
                </div>
                <div className="bg-white/50 dark:bg-gray-700/50 rounded-xl p-3">
                  <span className="text-gray-500 dark:text-gray-400 text-xs">Created:</span>
                  <span className="ml-2 font-bold text-gray-900 dark:text-white">
                    {formatDistanceToNow(new Date(system.created_at), { addSuffix: true })}
                  </span>
                </div>
              </div>

              <div className="mt-4 p-5 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 shadow-inner">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">API Token</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setVisibleTokens({ ...visibleTokens, [system.id]: !visibleTokens[system.id] })}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-gray-600 rounded-lg transition-all"
                      title={visibleTokens[system.id] ? 'Hide token' : 'Show token'}
                    >
                      {visibleTokens[system.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => copyToken(system.api_token)}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-white dark:hover:bg-gray-600 rounded-lg transition-all"
                      title="Copy token"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleRegenerateToken(system.id)}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-white dark:hover:bg-gray-600 rounded-lg transition-all"
                      title="Regenerate token"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <code className={`text-sm bg-white dark:bg-gray-900 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 block break-all font-mono transition-all ${visibleTokens[system.id] ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-600 tracking-wider'}`}>
                  {visibleTokens[system.id] ? system.api_token : '••••••••••••••••••••••••••••••••'}
                </code>

                <div className="mt-4 text-xs">
                  <p className="font-semibold mb-2 text-gray-700 dark:text-gray-300">Ingest Endpoint:</p>
                  <code className="bg-white dark:bg-gray-900 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 block text-gray-700 dark:text-gray-300 font-mono">
                    POST /api/ingest/{'{api_token}'}
                  </code>
                </div>
              </div>

              {/* K8s Metrics */}
              {k8sMetrics[system.id] && (
                <div className="mt-4 p-5 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl border border-blue-200 dark:border-blue-800 shadow-inner">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    {/* <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />*/ }
                    Kubernetes Metrics
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-white/50 dark:bg-gray-700/50 rounded-lg p-3">
                      <span className="text-gray-500 dark:text-gray-400 text-xs block mb-1">CPU Usage</span>
                      <span className="font-bold text-lg text-blue-600 dark:text-blue-400">
                        {safePercent(k8sMetrics[system.id].cpu_usage_percent, 1)}%
                      </span>
                    </div>
                    <div className="bg-white/50 dark:bg-gray-700/50 rounded-lg p-3">
                      <span className="text-gray-500 dark:text-gray-400 text-xs block mb-1">Memory Usage</span>
                      <span className="font-bold text-lg text-purple-600 dark:text-purple-400">
                        {safePercent(k8sMetrics[system.id].memory_usage_percent, 1)}%
                      </span>
                    </div>
                    <div className="bg-white/50 dark:bg-gray-700/50 rounded-lg p-3">
                      <span className="text-gray-500 dark:text-gray-400 text-xs block mb-1">Pods</span>
                      <span className="font-bold text-gray-900 dark:text-white">
                        {(k8sMetrics[system.id].pod_running ?? 0)}/{(k8sMetrics[system.id].pod_count ?? 0)}
                      </span>
                    </div>
                    <div className="bg-white/50 dark:bg-gray-700/50 rounded-lg p-3">
                      <span className="text-gray-500 dark:text-gray-400 text-xs block mb-1">Nodes</span>
                      <span className="font-bold text-gray-900 dark:text-white">
                        {(k8sMetrics[system.id].node_ready ?? 0)}/{(k8sMetrics[system.id].node_count ?? 0)}
                      </span>
                    </div>
                  </div>
                  {/* Mini Charts */}
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-gray-900/60 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                      <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">CPU (24h)</div>
                      <div className="h-28">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={history[system.id]?.points || []} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
                            <XAxis dataKey="timestamp" hide tickFormatter={(t) => new Date(t).toLocaleTimeString()} />
                            <YAxis hide domain={[0, 100]} />
                            <Tooltip
                              labelFormatter={(l) => new Date(l).toLocaleString()}
                              formatter={(v) => [`${Number(v).toFixed(1)}%`, 'CPU']}
                              cursor={{
                                // semi-transparent overlay tuned for both themes
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
                            <Line type="monotone" dataKey="cpu_usage_percent" stroke="#3b82f6" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="bg-white dark:bg-gray-900/60 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                      <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">Memory (24h)</div>
                      <div className="h-28">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={history[system.id]?.points || []} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
                            <XAxis dataKey="timestamp" hide tickFormatter={(t) => new Date(t).toLocaleTimeString()} />
                            <YAxis hide domain={[0, 100]} />
                            <Tooltip
                              labelFormatter={(l) => new Date(l).toLocaleString()}
                              formatter={(v) => [`${Number(v).toFixed(1)}%`, 'Memory']}
                              cursor={{
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
                            <Line type="monotone" dataKey="memory_usage_percent" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                  {k8sMetrics[system.id].updated_at && (
                    <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                      Last updated: {formatDistanceToNow(new Date(k8sMetrics[system.id].updated_at), { addSuffix: true })}
                    </p>
                  )}
                  <div className="mt-3">
                    <Link to={`/systems/${system.id}`} className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">
                      View details →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
