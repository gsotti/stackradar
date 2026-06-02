import React, { useState, useEffect, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw, Server, Info, LayoutGrid, List } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import { useNotification } from '../contexts/NotificationContext';
import { usePermissions } from '../hooks/usePermissions';
import { UptimeStatusDot } from '../components/uptime/UptimeStatusBadge';
import { Site, K8sMetrics, UptimeStatus } from '../types';

export default function SitesPage() {
  const { t } = useTranslation('sites');
  const { t: tc } = useTranslation('common');
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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() =>
    (localStorage.getItem('viewMode_sites') as 'grid' | 'list') || 'grid'
  );

  const toggleView = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('viewMode_sites', mode);
  };

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
          if (metrics) metricsMap[site.id] = metrics;
        } catch {
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
          if (status) statusMap[site.id] = status;
        } catch {
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
      showError(error.message || t('messages.failed_fetch'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) {
      showError(t('messages.select_tenant_first'));
      return;
    }
    try {
      await api.post('/sites', { ...form, tenant_id: selectedTenant });
      showSuccess(t('messages.created'));
      setShowForm(false);
      setForm({ name: '', description: '', retention_days: 30, site_type: 'kubernetes', has_metrics: true });
      fetchSites();
    } catch (error: any) {
      showError(error.message || t('messages.failed_create'));
    }
  };

  const getSiteTypeLabel = (type: string) => {
    switch (type) {
      case 'docker': return t('form.site_type_docker');
      case 'kubernetes': return t('form.site_type_kubernetes');
      case 'generic': return t('form.site_type_generic');
      case 'aws_lambda': return t('form.site_type_aws_lambda');
      default: return t('form.site_type_kubernetes');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-6rem)]">
        <RefreshCw className="w-10 h-10 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading-2">{t('page.title')}</h1>
          <p className="text-body-secondary mt-2">{t('page.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1 gap-0.5">
            <button
              onClick={() => toggleView('grid')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-neutral-700 shadow-sm text-primary-600 dark:text-primary-400' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => toggleView('list')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-neutral-700 shadow-sm text-primary-600 dark:text-primary-400' : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300'}`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          {!isViewer() && (
            <button
              onClick={() => { setShowForm(true); setForm({ name: '', description: '', retention_days: 30, site_type: 'kubernetes', has_metrics: true }); }}
              className="button-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {t('actions.add_site')}
            </button>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="card w-full max-w-md">
            <h2 className="text-heading-3 mb-6">{t('form.title')}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-label mb-2">{t('form.name_label')}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input-base w-full"
                  placeholder={t('form.name_placeholder')}
                  required
                />
              </div>
              <div>
                <label className="block text-label mb-2">{t('form.description_label')}</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="input-base w-full"
                  placeholder={t('form.description_placeholder')}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-label mb-2">{t('form.retention_label')}</label>
                  <input
                    type="number"
                    value={form.retention_days}
                    onChange={(e) => setForm({ ...form, retention_days: parseInt(e.target.value) })}
                    className="input-base w-full"
                    min="1"
                    max="365"
                    required
                  />
                </div>
                <div>
                  <label className="block text-label mb-2">{t('form.site_type_label')}</label>
                  <select
                    value={form.site_type}
                    onChange={(e) => setForm({ ...form, site_type: e.target.value as any })}
                    className="input-base w-full"
                  >
                    <option value="kubernetes">{t('form.site_type_kubernetes')}</option>
                    <option value="docker">{t('form.site_type_docker')}</option>
                    <option value="generic">{t('form.site_type_generic')}</option>
                    <option value="aws_lambda">{t('form.site_type_aws_lambda')}</option>
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
                    <div className={`w-10 h-5 rounded-full transition-colors ${form.has_metrics ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-600'}`} />
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.has_metrics ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t('form.has_metrics_label')}</span>
                    <p className="text-body-secondary text-xs mt-0.5">
                      {t('form.has_metrics_description')}
                    </p>
                  </div>
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowForm(false)} className="button-secondary button-center">
                  {tc('actions.cancel')}
                </button>
                <button type="submit" className="button-primary button-center">
                  {t('actions.create_site')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {sites.length === 0 ? (
        <div className="text-center py-20 surface rounded-2xl border-2 border-dashed border-neutral-300 dark:border-neutral-700">
          <Server className="w-16 h-16 text-neutral-300 dark:text-neutral-600 mx-auto mb-4 opacity-50" />
          <h3 className="text-heading-4 mb-2">{t('empty.title')}</h3>
          <p className="text-body-secondary max-w-sm mx-auto mb-8">{t('empty.description')}</p>
          {!isViewer() && (
            <button onClick={() => setShowForm(true)} className="button-primary inline-flex items-center gap-2">
              <Plus className="w-5 h-5" />
              {t('actions.add_first_site')}
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {sites.map((site) => {
            const metrics = k8sMetrics[site.id];
            const status = uptimeStatus[site.id]?.current_status || 'unknown';
            return (
              <Link key={site.id} to={`/sites/${site.id}`} className="card-hover group flex flex-col h-full">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg group-hover:scale-110 transition-transform duration-300">
                    <Server className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <UptimeStatusDot status={status} size="sm" />
                  <div className="flex flex-col min-w-0">
                    <h3 className="text-base font-semibold text-neutral-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
                      {site.name}
                    </h3>
                  </div>
                  <div className="ml-auto flex-shrink-0">
                    <span className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-xs font-semibold rounded-md uppercase tracking-wider">
                      {getSiteTypeLabel(site.site_type)}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4 line-clamp-1 min-h-[1.25rem]">
                  {site.description || t('card.no_description')}
                </p>
                <div className="mt-auto pt-4 border-t border-neutral-200 dark:border-neutral-700/50">
                  {!site.has_metrics ? null : metrics ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-label">{t('card.cpu_usage')}</p>
                        <span className="text-base font-bold text-neutral-900 dark:text-white leading-none">{safePercent(metrics.cpu_usage_percent)}%</span>
                        <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-1000 ${Number(metrics.cpu_usage_percent) > 80 ? 'bg-accent-danger' : Number(metrics.cpu_usage_percent) > 50 ? 'bg-accent-warning' : 'bg-accent-success'}`}
                            style={{ width: `${Math.min(100, Number(metrics.cpu_usage_percent))}%` }} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-label">{t('card.memory')}</p>
                        <span className="text-base font-bold text-neutral-900 dark:text-white leading-none">{safePercent(metrics.memory_usage_percent)}%</span>
                        <div className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-1000 ${Number(metrics.memory_usage_percent) > 80 ? 'bg-accent-danger' : Number(metrics.memory_usage_percent) > 50 ? 'bg-accent-warning' : 'bg-accent-success'}`}
                            style={{ width: `${Math.min(100, Number(metrics.memory_usage_percent))}%` }} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-neutral-500 dark:text-neutral-400 italic text-sm py-2">
                      <Info className="w-4 h-4" />
                      {t('card.waiting_metrics')}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {sites.map((site) => {
            const metrics = k8sMetrics[site.id];
            const status = uptimeStatus[site.id]?.current_status || 'unknown';
            return (
              <Link key={site.id} to={`/sites/${site.id}`} className="card-hover group flex items-center gap-4 py-3 px-4">
                <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                  <Server className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                </div>
                <UptimeStatusDot status={status} size="sm" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
                    {site.name}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                    {site.description || t('card.no_description')}
                  </p>
                </div>
                <span className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-xs font-semibold rounded-md uppercase tracking-wider flex-shrink-0">
                  {getSiteTypeLabel(site.site_type)}
                </span>
                {site.has_metrics && metrics && (
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="flex items-center gap-2 w-28">
                      <span className="text-xs text-neutral-500 dark:text-neutral-400 w-8 text-right">{safePercent(metrics.cpu_usage_percent)}%</span>
                      <div className="flex-1 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${Number(metrics.cpu_usage_percent) > 80 ? 'bg-accent-danger' : Number(metrics.cpu_usage_percent) > 50 ? 'bg-accent-warning' : 'bg-accent-success'}`}
                          style={{ width: `${Math.min(100, Number(metrics.cpu_usage_percent))}%` }} />
                      </div>
                      <span className="text-xs text-neutral-400 w-6">{t('card.cpu_usage')}</span>
                    </div>
                    <div className="flex items-center gap-2 w-28">
                      <span className="text-xs text-neutral-500 dark:text-neutral-400 w-8 text-right">{safePercent(metrics.memory_usage_percent)}%</span>
                      <div className="flex-1 h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${Number(metrics.memory_usage_percent) > 80 ? 'bg-accent-danger' : Number(metrics.memory_usage_percent) > 50 ? 'bg-accent-warning' : 'bg-accent-success'}`}
                          style={{ width: `${Math.min(100, Number(metrics.memory_usage_percent))}%` }} />
                      </div>
                      <span className="text-xs text-neutral-400 w-6">{t('card.memory')}</span>
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
