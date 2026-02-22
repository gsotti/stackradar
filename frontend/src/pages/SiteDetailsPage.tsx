import React, { useEffect, useState, FormEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { RefreshCw, ArrowLeft, Server, Activity, CheckCircle, AlertTriangle, Bell, BarChart2, Settings, Eye, EyeOff, Copy, Trash2, Terminal, Clock, Box, Radio } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { formatInLocalTime } from '../utils/dateUtils';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { useNotification } from '../contexts/NotificationContext';
import AlertsView from '../components/alerts/AlertsView';
import SiteSetupInstructions from '../components/SiteSetupInstructions';
import UptimeMonitorsView from '../components/uptime/UptimeMonitorsView';
import ConfirmDialog from '../components/common/ConfirmDialog';

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
  const { t } = useTranslation('sites');
  const { t: tc } = useTranslation('common');
  const { id, tab: activeTab = 'metrics' } = useParams<{ id: string; tab?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isViewer } = usePermissions();
  const { showSuccess, showError } = useNotification();
  const [site, setSite] = useState<Site | null>(null);
  const [live, setLive] = useState<LiveMetricsResponse>({ points: [] });
  const [summary, setSummary] = useState<K8sMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const setActiveTab = (tab: string) => {
    if (tab === 'metrics') {
      navigate(`/sites/${id}`);
    } else {
      navigate(`/sites/${id}/${tab}`);
    }
  };
  const [form, setForm] = useState<{ name: string; description: string; retention_days: number; site_type: Site['site_type']; has_metrics: boolean }>({ name: '', description: '', retention_days: 30, site_type: 'kubernetes', has_metrics: true });
  const [tokenVisible, setTokenVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showRegenerateTokenModal, setShowRegenerateTokenModal] = useState(false);
  const [showDeleteSiteModal, setShowDeleteSiteModal] = useState(false);

  const fetchAll = async () => {
    try {
      const st = await api.get<Site>(`/sites/${id}`);
      setSite(st);
      setForm({
        name: st.name || '',
        description: st.description || '',
        retention_days: st.retention_days || 30,
        site_type: st.site_type || 'kubernetes',
        has_metrics: st.has_metrics !== false
      });

      // Only fetch k8s metrics when the site reports metrics
      if (st.has_metrics !== false) {
        const [l, s] = await Promise.all([
          api.get<LiveMetricsResponse>(`/sites/${id}/k8s-metrics/live`),
          api.get<K8sMetrics>(`/sites/${id}/k8s-metrics`)
        ]);
        setLive(l || { points: [] });
        setSummary(s || null);
      }
    } catch (error: any) {
      showError(error.message || t('messages.failed_load'));
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
      showSuccess(t('messages.settings_saved'));
    } catch (error: any) {
      showError(error.message || t('messages.failed_save_settings'));
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateToken = async () => {
    try {
      const updated = await api.post<Site>(`/sites/${id}/regenerate-token`, {});
      setSite(updated);
      showSuccess(t('messages.token_regenerated'));
    } catch (error: any) {
      showError(error.message || t('messages.failed_regenerate_token'));
    }
  };

  const copyToken = () => {
    if (site?.api_token) {
      navigator.clipboard.writeText(site.api_token);
      showSuccess(t('messages.token_copied'));
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/sites/${id}`);
      showSuccess(t('messages.site_deleted'));
      navigate('/sites');
    } catch (error: any) {
      showError(error.message || t('messages.failed_delete'));
    }
  };

  useEffect(() => {
    fetchAll();
    let interval: ReturnType<typeof setInterval> | undefined;
    if (autoRefresh && site?.has_metrics !== false) {
      interval = setInterval(async () => {
        try {
          const l = await api.get<LiveMetricsResponse>(`/sites/${id}/k8s-metrics/live`);
          setLive(l || { points: [] });
        } catch (e) {
          // ignore transient errors
        }
      }, 10000);
    }
    return () => { if (interval) clearInterval(interval); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, autoRefresh]);

  // Redirect viewers away from restricted tabs
  useEffect(() => {
    if (isViewer() && (activeTab === 'alerts' || activeTab === 'setup' || activeTab === 'settings')) {
      navigate(`/sites/${id}/monitors`, { replace: true });
    }
  }, [isViewer, activeTab, id, navigate]);

  // When site has no metrics, redirect the "metrics" default tab to "monitors"
  useEffect(() => {
    if (site && site.has_metrics === false && activeTab === 'metrics') {
      navigate(`/sites/${id}/monitors`, { replace: true });
    }
  }, [site, activeTab, id, navigate]);

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
    containers: isDocker ? t('details.label_containers') : t('details.label_pods'),
    hosts: isDocker ? t('details.label_host') : t('details.label_nodes'),
    deployments: isDocker ? t('details.label_running') : t('details.label_deployments'),
    platform: isDocker ? 'Docker' : isK8s ? 'Kubernetes' : t('details.label_infrastructure')
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-6rem)]">
        <div className="text-center">
          <RefreshCw className="w-10 h-10 animate-spin text-primary-500 mx-auto mb-3" />
          <p className="text-neutral-600 dark:text-neutral-400">{t('details.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/sites" className="text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-700 rounded-lg flex items-center justify-center shadow-lg">
            <Server className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-heading-3 text-neutral-900 dark:text-white">{site?.name || `Site #${id}`}</h1>
            <p className="text-body-secondary text-sm">
              {activeTab === 'metrics'
                ? t('details.subtitle_metrics', { platform: labels.platform })
                : activeTab === 'monitors'
                ? site?.has_metrics === false
                  ? t('details.subtitle_uptime_overview')
                  : t('details.subtitle_monitors')
                : t('details.subtitle_alerts')}
            </p>
          </div>
        </div>
        {activeTab === 'metrics' && (
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${autoRefresh ? 'bg-primary-600 text-white border-primary-600' : 'bg-transparent text-neutral-700 dark:text-neutral-300 border-neutral-300 dark:border-neutral-600'}`}
          >
            {autoRefresh ? t('details.auto_refresh_on') : t('details.auto_refresh_off')}
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-neutral-200 dark:border-neutral-700">
        <nav className="flex gap-4">
          {/* Metrics tab – hidden when site has no infrastructure metrics */}
          {site?.has_metrics !== false && (
            <button
              onClick={() => setActiveTab('metrics')}
              className={`
                flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors
                ${
                  activeTab === 'metrics'
                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-300 hover:border-neutral-300'
                }
              `}
            >
              <BarChart2 className="w-4 h-4" />
              {t('details.tab_metrics')}
            </button>
          )}
          <button
            onClick={() => setActiveTab('monitors')}
            className={`
              flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors
              ${
                activeTab === 'monitors'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-300 hover:border-neutral-300'
              }
            `}
          >
            <Radio className="w-4 h-4" />
            {site?.has_metrics === false ? t('details.tab_uptime_overview') : t('details.tab_monitors')}
          </button>
          {!isViewer() && (
            <>
              <button
                onClick={() => setActiveTab('alerts')}
                className={`
                  flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors
                  ${
                    activeTab === 'alerts'
                      ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                      : 'border-transparent text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-300 hover:border-neutral-300'
                  }
                `}
              >
                <Bell className="w-4 h-4" />
                {t('details.tab_alerts')}
              </button>
              <button
                onClick={() => setActiveTab('setup')}
                className={`
                  flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors
                  ${
                    activeTab === 'setup'
                      ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                      : 'border-transparent text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-300 hover:border-neutral-300'
                  }
                `}
              >
                <Terminal className="w-4 h-4" />
                {t('details.tab_setup')}
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`
                  flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors
                  ${
                    activeTab === 'settings'
                      ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                      : 'border-transparent text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-300 hover:border-neutral-300'
                  }
                `}
              >
                <Settings className="w-4 h-4" />
                {t('details.tab_settings')}
              </button>
            </>
          )}
        </nav>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'metrics' ? (
        <>
          {/* Site Info Bar */}
          <div className="card-compact flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Box className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
              <span className="text-sm text-neutral-600 dark:text-neutral-400">{t('details.type_label')}</span>
              <span className="text-sm font-medium text-neutral-900 dark:text-white">{labels.platform}</span>
            </div>
            <div className="w-px h-4 bg-neutral-300 dark:bg-neutral-600" />
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-neutral-500 dark:text-neutral-400" />
              <span className="text-sm text-neutral-600 dark:text-neutral-400">{t('details.retention_label')}</span>
              <span className="text-sm font-medium text-neutral-900 dark:text-white">{t('details.retention_days', { count: site?.retention_days })}</span>
            </div>
            {site?.description && (
              <>
                <div className="w-px h-4 bg-neutral-300 dark:bg-neutral-600" />
                <span className="text-sm text-neutral-600 dark:text-neutral-400 truncate">{site.description}</span>
              </>
            )}
          </div>

          {/* Summary grid */}
          {summary ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* CPU usage */}
              <div className="card-compact border-t-4 border-t-primary-500">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{t('details.cpu_usage_label')}</div>
                  <div className="text-xs px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">{t('details.cpu_badge')}</div>
                </div>
                <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">{safePercent(summary.cpu_usage_percent, 1)}%</div>
              </div>

              {/* Memory usage */}
              <div className="card-compact border-t-4 border-t-accent-info">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{t('details.memory_usage_label')}</div>
                  <div className="text-xs px-2 py-0.5 rounded-full bg-accent-info/10 text-accent-info">{t('details.memory_badge')}</div>
                </div>
                <div className="text-2xl font-bold text-accent-info">{safePercent(summary.memory_usage_percent, 1)}%</div>
              </div>

              {/* Pods/Containers */}
              <div className="card-compact border-t-4 border-t-accent-success">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Running / Total</div>
                  <div className="text-xs px-2 py-0.5 rounded-full bg-accent-success/10 text-accent-success">{labels.containers}</div>
                </div>
                <div className="text-2xl font-bold text-accent-success">{safeNumber(summary.pod_running)}/{safeNumber(summary.pod_count)}</div>
                <div className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  {isDocker ? `${t('details.stopped_label')} ${safeNumber(summary.pod_failed)}` : `${t('details.pending_label')} ${safeNumber(summary.pod_pending)} · ${t('details.failed_label')} ${safeNumber(summary.pod_failed)}`}
                </div>
              </div>

              {/* Nodes/Host */}
              <div className="card-compact border-t-4 border-t-accent-warning">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{isDocker ? t('details.status_label') : t('details.ready_total')}</div>
                  <div className="text-xs px-2 py-0.5 rounded-full bg-accent-warning/10 text-accent-warning">{labels.hosts}</div>
                </div>
                <div className="text-2xl font-bold text-accent-warning">
                  {isDocker ? (safeNumber(summary.node_count) > 0 ? t('details.online') : t('details.offline')) : `${safeNumber(summary.node_ready)}/${safeNumber(summary.node_count)}`}
                </div>
              </div>

              {/* Deployments/Running */}
              <div className="card-compact border-t-4 border-t-primary-600">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{isDocker ? t('details.label_containers') : t('details.ready_total')}</div>
                  <div className="text-xs px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">{labels.deployments}</div>
                </div>
                <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                  {isDocker ? safeNumber(summary.deployment_ready) : `${safeNumber(summary.deployment_ready)}/${safeNumber(summary.deployment_count)}`}
                </div>
              </div>

              {/* Services & PVCs (K8s only) / Network (Docker) */}
              {!isDocker ? (
                <div className="card-compact border-t-4 border-t-accent-danger">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{t('details.services_label')}</div>
                    <div className="text-xs px-2 py-0.5 rounded-full bg-accent-danger/10 text-accent-danger">{t('details.services_pvcs_label')}</div>
                  </div>
                  <div className="text-2xl font-bold text-accent-danger">{safeNumber(summary.service_count)}</div>
                  <div className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">PVCs: <span className="font-semibold text-neutral-900 dark:text-white">{safeNumber(summary.pvc_bound)}/{safeNumber(summary.pvc_count)}</span></div>
                </div>
              ) : (
                <div className="card-compact border-t-4 border-t-accent-info">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{t('details.total_containers')}</div>
                    <div className="text-xs px-2 py-0.5 rounded-full bg-accent-info/10 text-accent-info">{t('details.network_label')}</div>
                  </div>
                  <div className="text-2xl font-bold text-accent-info">{safeNumber(summary.pod_count)}</div>
                  <div className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{t('details.label_running')}: <span className="font-semibold text-neutral-900 dark:text-white">{safeNumber(summary.pod_running)}</span></div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-accent-warning/10 border border-accent-warning/20 text-accent-warning rounded-lg p-4">
              {t('details.no_metrics_yet', { platform: labels.platform.toLowerCase() })}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">{t('details.cpu_memory_live')}</h2>
                <button onClick={fetchAll} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors">
                  <RefreshCw className="w-4 h-4" /> {t('details.refresh')}
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
                      formatter={(v: any, _n: any, item: any) => [`${Number(v).toFixed(1)}%`, item?.dataKey === 'cpu_usage_percent' ? t('details.cpu_badge') : t('details.memory_badge')]}
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
                    <Line type="monotone" dataKey="cpu_usage_percent" name={t('details.cpu_badge')} stroke="#3b82f6" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="memory_usage_percent" name={t('details.memory_badge')} stroke="#8b5cf6" strokeWidth={2} dot={false} />
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Column - Site Settings Form */}
          <div className="card">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">{t('settings.title')}</h2>
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">{t('settings.name_label')}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input-base w-full"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">{t('settings.description_label')}</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="input-base w-full"
                  rows={4}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">{t('settings.site_type_label')}</label>
                  <select
                    value={form.site_type}
                    onChange={(e) => setForm({ ...form, site_type: e.target.value as any })}
                    className="input-base w-full"
                  >
                    <option value="docker">{t('settings.site_type_docker')}</option>
                    <option value="kubernetes">{t('settings.site_type_kubernetes')}</option>
                    <option value="generic">{t('settings.site_type_generic')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">{t('settings.retention_label')}</label>
                  <input
                    type="number"
                    value={form.retention_days}
                    onChange={(e) => setForm({ ...form, retention_days: parseInt(e.target.value) })}
                    className="input-base w-full"
                    min={1}
                    max={365}
                  />
                </div>
              </div>
              <div>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <div className="relative flex-shrink-0" onClick={() => setForm({ ...form, has_metrics: !form.has_metrics })}>
                    <div className={`w-10 h-5 rounded-full transition-colors ${form.has_metrics ? 'bg-primary-600' : 'bg-neutral-300 dark:bg-neutral-600'}`} />
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.has_metrics ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t('settings.has_metrics_label')}</span>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {t('settings.has_metrics_description')}
                    </p>
                  </div>
                </label>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="button-primary w-full justify-center disabled:opacity-50"
              >
                {saving ? t('settings.saving_button') : t('settings.save_button')}
              </button>
            </form>
          </div>

          {/* Right Column - API Token & Danger Zone */}
          <div className="space-y-4">
            {/* API Token */}
            <div className="card">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">{t('settings.api_token_label')}</h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                {t('settings.api_token_description')}
              </p>
              <div className="flex items-center gap-2 mb-4">
                <code className={`flex-1 text-sm bg-neutral-50 dark:bg-neutral-900 px-3 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-600 break-all font-mono ${tokenVisible ? 'text-neutral-900 dark:text-white' : 'text-neutral-400 dark:text-neutral-600 tracking-wider'}`}>
                  {tokenVisible ? site?.api_token : '••••••••••••••••••••••••••••••••'}
                </code>
                <button
                  onClick={() => setTokenVisible(!tokenVisible)}
                  className="p-2.5 text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-all"
                  title={tokenVisible ? t('settings.hide_token') : t('settings.show_token')}
                >
                  {tokenVisible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
                <button
                  onClick={copyToken}
                  className="p-2.5 text-neutral-600 dark:text-neutral-400 hover:text-accent-success dark:hover:text-accent-success hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg transition-all"
                  title={t('settings.copy_token')}
                >
                  <Copy className="w-5 h-5" />
                </button>
              </div>
              <button
                onClick={() => setShowRegenerateTokenModal(true)}
                className="button-secondary w-full justify-center"
              >
                {t('settings.regenerate_token')}
              </button>
            </div>

            {/* Danger Zone */}
            <div className="card border-l-4 border-l-accent-danger">
              <h2 className="text-lg font-semibold text-accent-danger mb-2">{t('danger_zone.title')}</h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                {t('danger_zone.delete_description')}
              </p>
              <button
                onClick={() => setShowDeleteSiteModal(true)}
                className="button-danger w-full justify-center"
              >
                {t('danger_zone.delete_button')}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showRegenerateTokenModal}
        title={t('confirm.regenerate_token_title')}
        description={t('confirm.regenerate_token_description')}
        confirmLabel={t('confirm.regenerate_token_label')}
        onCancel={() => setShowRegenerateTokenModal(false)}
        onConfirm={() => {
          setShowRegenerateTokenModal(false);
          handleRegenerateToken();
        }}
      />

      <ConfirmDialog
        isOpen={showDeleteSiteModal}
        title={t('confirm.delete_title')}
        description={tc('confirm_dialog.cannot_be_undone')}
        confirmLabel={t('confirm.delete_label')}
        variant="danger"
        onCancel={() => setShowDeleteSiteModal(false)}
        onConfirm={() => {
          setShowDeleteSiteModal(false);
          handleDelete();
        }}
      />
    </div>
  );
}
