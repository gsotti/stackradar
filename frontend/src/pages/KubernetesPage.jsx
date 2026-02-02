import React, { useState, useEffect } from 'react';
import { Activity, Server, CheckCircle, Clock, RefreshCw, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { api } from '../utils/api';
import { useApp } from '../contexts/AppContext';

export default function KubernetesPage() {
  const { selectedTenant, selectedEnvironment } = useApp();
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetchTime, setLastFetchTime] = useState(null);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [selectedTenant, selectedEnvironment]);

  const fetchMetrics = async () => {
    try {
      const fetchTime = Date.now();
      const params = new URLSearchParams();
      if (selectedTenant) params.append('tenant', selectedTenant);
      if (selectedEnvironment) params.append('environment', selectedEnvironment);

      const data = await api.get(`/k8s/metrics?${params}`);
      // Convert numeric fields to actual numbers
      const parsedMetrics = (data || []).map(m => ({
        ...m,
        cpu_usage_percent: parseFloat(m.cpu_usage_percent) || 0,
        memory_usage_percent: parseFloat(m.memory_usage_percent) || 0,
        node_count: parseInt(m.node_count) || 0,
        node_ready: parseInt(m.node_ready) || 0,
        pod_count: parseInt(m.pod_count) || 0,
        pod_running: parseInt(m.pod_running) || 0,
        pod_pending: parseInt(m.pod_pending) || 0,
        pod_failed: parseInt(m.pod_failed) || 0,
        deployment_count: parseInt(m.deployment_count) || 0,
        deployment_ready: parseInt(m.deployment_ready) || 0,
        service_count: parseInt(m.service_count) || 0,
        pvc_count: parseInt(m.pvc_count) || 0,
        pvc_bound: parseInt(m.pvc_bound) || 0,
        pv_count: parseInt(m.pv_count) || 0
      }));
      setMetrics(parsedMetrics);
      setLastFetchTime(fetchTime);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch K8s metrics:', err);
      setError(err.message || 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kubernetes Monitoring</h1>
        <div className="bg-red-50 rounded-xl p-12 text-center border border-red-200">
          <AlertTriangle className="w-12 h-12 mx-auto text-red-400 mb-4" />
          <p className="text-red-600 mb-4">Error loading metrics</p>
          <p className="text-sm text-red-500 mb-4">{error}</p>
          <button
            onClick={fetchMetrics}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kubernetes Monitoring</h1>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border border-gray-200 dark:border-gray-700">
          <Activity className="w-12 h-12 mx-auto text-gray-700 dark:text-gray-300 mb-4" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">No Kubernetes metrics available yet.</p>
          <p className="text-sm text-gray-400">
            Deploy the metrics collector to your cluster to start monitoring.
          </p>
        </div>
      </div>
    );
  }

  const isDataStale = (updatedAt) => {
    if (!updatedAt || !lastFetchTime) return false;

    // Compare the updated_at timestamp to when we fetched the data
    // This avoids clock sync issues between browser and server
    const updated = new Date(updatedAt).getTime();
    const diffSeconds = (lastFetchTime - updated) / 1000;

    // If the data was already older than 60 seconds when we fetched it, it's stale
    // Stats collector runs every 10 seconds, so data older than 60s is definitely stale
    return diffSeconds > 60;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Kubernetes Monitoring</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Real-time cluster health and metrics</p>
        </div>
        <button onClick={fetchMetrics} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 font-medium">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {metrics.map((m) => {
        const dataIsStale = isDataStale(m.updated_at);

        return (
          <div key={m.id} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{m.cluster_name || 'Cluster'}</h2>
              {dataIsStale && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <Clock className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm text-yellow-700">
                    Data is stale (last updated {formatDistanceToNow(new Date(m.updated_at), { addSuffix: true })})
                  </span>
                </div>
              )}
            </div>

            {/* Resource Usage */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="group relative bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-blue-100 text-sm font-medium">CPU Usage</span>
                    <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Activity className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-white mb-3">{m.cpu_usage_percent?.toFixed(1)}%</p>
                  <div className="bg-white/20 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-white rounded-full h-2 transition-all duration-500"
                      style={{ width: `${Math.min(m.cpu_usage_percent, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="group relative bg-gradient-to-br from-purple-500 to-violet-600 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-purple-100 text-sm font-medium">Memory Usage</span>
                    <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Activity className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-white mb-3">{m.memory_usage_percent?.toFixed(1)}%</p>
                  <div className="bg-white/20 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-white rounded-full h-2 transition-all duration-500"
                      style={{ width: `${Math.min(m.memory_usage_percent, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="group relative bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-green-100 text-sm font-medium">Nodes</span>
                    <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Server className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-white mb-1">{m.node_ready}/{m.node_count}</p>
                  <p className="text-green-100 text-xs">Ready / Total</p>
                </div>
              </div>

              <div className="group relative bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-teal-100 text-sm font-medium">Pods</span>
                    <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold text-white mb-1">{m.pod_running}/{m.pod_count}</p>
                  <p className="text-teal-100 text-xs">
                    Running: {m.pod_running} | Pending: {m.pod_pending} | Failed: {m.pod_failed}
                  </p>
                </div>
              </div>
            </div>

            {/* Workloads */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-300 hover:scale-105">
                <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-4">Deployments</h3>
                <div className="flex items-center gap-4">
                  <div className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">{m.deployment_ready}</div>
                  <div className="text-gray-400 text-2xl">/</div>
                  <div className="text-3xl text-gray-500 dark:text-gray-400">{m.deployment_count}</div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 font-medium">Ready / Total</p>
              </div>

              <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-300 hover:scale-105">
                <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-4">Services</h3>
                <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{m.service_count}</div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 font-medium">Total Services</p>
              </div>

              <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-300 hover:scale-105">
                <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-4">PVCs</h3>
                <div className="flex items-center gap-4">
                  <div className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">{m.pvc_bound}</div>
                  <div className="text-gray-400 text-2xl">/</div>
                  <div className="text-3xl text-gray-500 dark:text-gray-400">{m.pvc_count}</div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 font-medium">Bound / Total</p>
              </div>

              <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-300 hover:scale-105">
                <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-4">PVs</h3>
                <div className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">{m.pv_count}</div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 font-medium">Total PVs</p>
              </div>
            </div>

            {/* Alerts */}
            {m.alerts && JSON.parse(m.alerts).length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <h3 className="font-medium mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                  Alerts
                </h3>
                <div className="space-y-2">
                  {JSON.parse(m.alerts).map((alert, i) => (
                    <div key={i} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
                      {alert}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-sm text-gray-400">
              Last updated: {formatDistanceToNow(new Date(m.updated_at), { addSuffix: true })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
