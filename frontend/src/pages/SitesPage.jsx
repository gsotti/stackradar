import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw, Server, Info } from 'lucide-react';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { useNotification } from '../contexts/NotificationContext';
import { UptimeStatusDot } from '../components/uptime/UptimeStatusBadge';

export default function SitesPage() {
  const { user } = useAuth();
  const { selectedTenant } = useApp();
  const { showError, showSuccess } = useNotification();
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', retention_days: 30, site_type: 'kubernetes' });
  const [k8sMetrics, setK8sMetrics] = useState({});
  const [uptimeStatus, setUptimeStatus] = useState({});

  const safePercent = (val, fractionDigits = 1) => {
    const n = Number(val);
    return Number.isFinite(n) ? n.toFixed(fractionDigits) : (0).toFixed(fractionDigits);
  };

  useEffect(() => {
    fetchSites();
  }, [selectedTenant]);

  useEffect(() => {
    const fetchK8sMetrics = async () => {
      const metricsMap = {};
      for (const site of sites) {
        try {
          const metrics = await api.get(`/sites/${site.id}/k8s-metrics`);
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
      const statusMap = {};
      for (const site of sites) {
        try {
          const status = await api.get(`/uptime/site/${site.id}/status`);
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
    const data = await api.get(`/sites?${params}`);
    setSites(data);
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedTenant) {
      showError('Please select a tenant from the sidebar before creating a site');
      return;
    }

    try {
      await api.post('/sites', { ...form, tenant_id: selectedTenant });
      showSuccess('Site created successfully');
      setShowForm(false);
      setForm({ name: '', description: '', retention_days: 30, site_type: 'kubernetes' });
      fetchSites();
    } catch (error) {
      showError(error.message || 'Failed to create site');
    }
  };

  const getSiteTypeLabel = (type) => {
    switch (type) {
      case 'docker': return 'Docker';
      case 'kubernetes': return 'Kubernetes';
      case 'generic': return 'Generic';
      default: return 'Kubernetes';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Sites</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your Docker hosts, Kubernetes clusters, and generic sites</p>
        </div>
        {!user?.is_viewer && (
          <button
            onClick={() => { setShowForm(true); setForm({ name: '', description: '', retention_days: 30, site_type: 'kubernetes' }); }}
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
            <h2 className="text-xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Add New Site
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Site Type</label>
                <select
                  value={form.site_type}
                  onChange={(e) => setForm({ ...form, site_type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all hover:border-blue-400 dark:hover:border-blue-500 shadow-sm"
                  required
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
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sites List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <RefreshCw className="w-10 h-10 animate-spin text-blue-500 mb-3" />
          <span className="text-gray-600 dark:text-gray-400 font-medium">Loading sites...</span>
        </div>
      ) : sites.length === 0 ? (
        <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-12 text-center border border-gray-200 dark:border-gray-700 shadow-lg">
          <Server className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
          <p className="text-gray-600 dark:text-gray-400 font-medium">No sites yet. Create one to start collecting logs and metrics from your infrastructure.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sites.map((site) => (
            <Link
              key={site.id}
              to={`/sites/${site.id}`}
              className="group bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all hover:scale-[1.02] hover:border-blue-300 dark:hover:border-blue-700"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2.5 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                  <Server className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-gray-900 dark:text-white truncate flex items-center gap-2">
                    {uptimeStatus[site.id] && (
                      <UptimeStatusDot status={uptimeStatus[site.id].current_status} />
                    )}
                    {site.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{site.description || 'No description'}</p>
                </div>
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  {getSiteTypeLabel(site.site_type)}
                </span>
              </div>

              {/* Quick Metrics Preview */}
              {k8sMetrics[site.id] ? (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2">
                    <span className="text-blue-600 dark:text-blue-400 font-semibold">
                      {safePercent(k8sMetrics[site.id].cpu_usage_percent)}%
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 ml-1">CPU</span>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg px-3 py-2">
                    <span className="text-purple-600 dark:text-purple-400 font-semibold">
                      {safePercent(k8sMetrics[site.id].memory_usage_percent)}%
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 ml-1">Memory</span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-400 dark:text-gray-500 italic">
                  No metrics yet
                </div>
              )}

              <div className="mt-3 flex items-center text-sm text-blue-600 dark:text-blue-400 font-medium group-hover:underline">
                <Info className="w-4 h-4 mr-1" />
                Show Details
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
