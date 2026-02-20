import React, { useState, useEffect, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw, Server, Info } from 'lucide-react';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { useNotification } from '../contexts/NotificationContext';
import { usePermissions } from '../hooks/usePermissions';
import { UptimeStatusDot } from '../components/uptime/UptimeStatusBadge';
import { Site, K8sMetrics, UptimeStatus } from '../types';

export default function SitesPage() {
  const { user } = useAuth();
  const { isViewer } = usePermissions();
  const { selectedTenant } = useApp();
  const { showError, showSuccess } = useNotification();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', retention_days: 30, site_type: 'kubernetes' as const, has_metrics: true });
  const [k8sMetrics, setK8sMetrics] = useState<Record<number, K8sMetrics>>({});
  const [uptimeStatus, setUptimeStatus] = useState<Record<number, { current_status: UptimeStatus }>>({});

  const safePercent = (val: number | string | undefined, fractionDigits = 1) => {
    const n = Number(val);
    return Number.isFinite(n) ? n.toFixed(fractionDigits) : (0).toFixed(fractionDigits);
  };

  useEffect(() => {
    fetchSites();
  }, [selectedTenant]);

  useEffect(() => {
    const fetchK8sMetrics = async () => {
      const metricsMap: Record<number, K8sMetrics> = {};
      for (const site of sites) {
        try {
          const metrics = await api.get<K8sMetrics>(`/sites/${site.id}/k8s-metrics`);
          if (metrics) {
            metricsMap[site.id] = metrics;
          }
        } catch (error) {
          // Ignore - no metrics yet
        }
      }
      setK8sMetrics(metricsMap);
    };

    const fetchUptimeStatus = async () => {
      const statusMap: Record<number, { current_status: UptimeStatus }> = {};
      for (const site of sites) {
        try {
          const status = await api.get<{ current_status: UptimeStatus }>(`/uptime/site/${site.id}/status`);
          if (status) {
            statusMap[site.id] = status;
          }
        } catch (error) {
          // Ignore - no uptime monitor yet
        }
      }
      setUptimeStatus(statusMap);
    };

    if (sites.length > 0) {
      fetchK8sMetrics();
      fetchUptimeStatus();
    }
  }, [sites]);

  const fetchSites = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedTenant) params.append('tenant_id', selectedTenant);
    try {
      const data = await api.get<Site[]>(`/sites?${params}`);
      setSites(data);
    } catch (error: any) {
      showError(error.message || 'Failed to fetch sites');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!selectedTenant) {
      showError('Please select a tenant from the sidebar before creating a site');
      return;
    }

    try {
      await api.post('/sites', { ...form, tenant_id: selectedTenant });
      showSuccess('Site created successfully');
      setShowForm(false);
      setForm({ name: '', description: '', retention_days: 30, site_type: 'kubernetes', has_metrics: true });
      fetchSites();
    } catch (error: any) {
      showError(error.message || 'Failed to create site');
    }
  };

  const getSiteTypeLabel = (type: string) => {
    switch (type) {
      case 'docker': return 'Docker';
      case 'kubernetes': return 'Kubernetes';
      case 'generic': return 'Generic';
      default: return 'Kubernetes';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-6rem)]">
        <RefreshCw className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Sites</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your Docker hosts, Kubernetes clusters, and generic sites</p>
        </div>
        {!isViewer() && (
          <button
            onClick={() => { setShowForm(true); setForm({ name: '', description: '', retention_days: 30, site_type: 'kubernetes', has_metrics: true }); }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Site
          </button>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-700 transform transition-all">
            <h2 className="text-xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Add New Site</h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Identifier (Name)</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all hover:border-blue-400 dark:hover:border-blue-500 shadow-sm"
                  placeholder="Production Cluster"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all hover:border-blue-400 dark:hover:border-blue-500 shadow-sm"
                  placeholder="Brief description of the site"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Retention (days)</label>
                  <input
                    type="number"
                    value={form.retention_days}
                    onChange={(e) => setForm({ ...form, retention_days: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all hover:border-blue-400 dark:hover:border-blue-500 shadow-sm"
                    min="1"
                    max="365"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Site Type</label>
                  <select
                    value={form.site_type}
                    onChange={(e) => setForm({ ...form, site_type: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all hover:border-blue-400 dark:hover:border-blue-500 shadow-sm"
                  >
                    <option value="kubernetes">Kubernetes</option>
                    <option value="docker">Docker</option>
                    <option value="generic">Generic</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={form.has_metrics}
                      onChange={(e) => setForm({ ...form, has_metrics: e.target.checked })}
                      className="sr-only"
                    />
                    <div className={`w-10 h-5 rounded-full transition-colors ${form.has_metrics ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`} />
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.has_metrics ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Collect infrastructure metrics</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Disable for uptime-only sites (no metrics tab shown)
                    </p>
                  </div>
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-2 rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95"
                >
                  Create Site
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold py-2 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all border border-gray-200 dark:border-gray-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {sites.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
          <Server className="w-16 h-16 text-gray-300 mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No sites found</h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-8">
            Create your first site to start monitoring your infrastructure.
          </p>
          {!isViewer() && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl hover:scale-105"
            >
              <Plus className="w-5 h-5" />
              Add Your First Site
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {sites.map((site) => {
            const metrics = k8sMetrics[site.id];
            const status = uptimeStatus[site.id]?.current_status || 'unknown';
            
            return (
              <Link
                key={site.id}
                to={`/sites/${site.id}`}
                className="group bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-xl hover:border-blue-500/50 transition-all duration-300 flex flex-col h-full"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg group-hover:scale-110 transition-transform duration-300">
                    <Server className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <UptimeStatusDot status={status} size="sm" />
                  <div className="flex flex-col min-w-0">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                      {site.name}
                    </h3>
                  </div>
                  <div className="ml-auto flex-shrink-0">
                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-bold rounded-md uppercase tracking-wider">
                      {getSiteTypeLabel(site.site_type)}
                    </span>
                  </div>
                </div>
                
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-1 min-h-[1.25rem]">
                  {site.description || 'No description provided.'}
                </p>

                <div className="mt-auto pt-4 border-t border-gray-100 dark:border-gray-700">
                  {metrics ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">CPU Usage</p>
                        <div className="flex items-end gap-1">
                          <span className="text-base font-bold text-gray-900 dark:text-white leading-none">{safePercent(metrics.cpu_usage_percent)}%</span>
                        </div>
                        <div className="w-full h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ${Number(metrics.cpu_usage_percent) > 80 ? 'bg-red-500' : Number(metrics.cpu_usage_percent) > 50 ? 'bg-amber-500' : 'bg-blue-500'}`}
                            style={{ width: `${Math.min(100, Number(metrics.cpu_usage_percent))}%` }}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Memory</p>
                        <div className="flex items-end gap-1">
                          <span className="text-base font-bold text-gray-900 dark:text-white leading-none">{safePercent(metrics.memory_usage_percent)}%</span>
                        </div>
                        <div className="w-full h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ${Number(metrics.memory_usage_percent) > 80 ? 'bg-red-500' : Number(metrics.memory_usage_percent) > 50 ? 'bg-amber-500' : 'bg-blue-500'}`}
                            style={{ width: `${Math.min(100, Number(metrics.memory_usage_percent))}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-gray-400 italic text-sm py-2">
                      <Info className="w-4 h-4" />
                      Waiting for metrics...
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
