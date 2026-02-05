import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useNotification } from '../../contexts/NotificationContext';
import { api } from '../../utils/api';
import { AlertHistory, AlertSeverity, AlertState, MetricType } from '../../types';

interface AlertHistoryListProps {
  siteId: string;
}

interface AlertHistoryWithRule extends AlertHistory {
  rule_name: string;
  severity: AlertSeverity;
  metric_type: MetricType | null;
}

export default function AlertHistoryList({ siteId }: AlertHistoryListProps) {
  const [history, setHistory] = useState<AlertHistoryWithRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AlertState | 'all'>('all');
  const { showError } = useNotification();

  useEffect(() => {
    loadHistory();
  }, [siteId, filter]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ site_id: siteId, limit: '50' });
      if (filter !== 'all') {
        params.append('state', filter);
      }
      const data = await api.get<AlertHistoryWithRule[]>(`/alerts/history?${params}`);
      setHistory(data);
    } catch (error: any) {
      showError(error.message || 'Failed to load alert history');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 dark:text-red-400';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return 'text-blue-600 dark:text-blue-400';
    }
  };

  const getStateIcon = (state: AlertState) => {
    return state === 'firing' ? (
      <AlertTriangle className="w-5 h-5 text-red-500" />
    ) : (
      <CheckCircle className="w-5 h-5 text-green-500" />
    );
  };

  const formatDate = (date: string) => {
    return format(new Date(date), 'dd.MM.yyyy HH:mm:ss');
  };

  const getMetricLabel = (metricType: MetricType | string) => {
    const labels: Record<string, string> = {
      cpu_percent: 'CPU Usage',
      memory_percent: 'Memory Usage',
      error_logs: 'Error Logs',
      pod_failed: 'Failed Pods',
      pod_pending: 'Pending Pods',
      deployment_readiness: 'Deployment Readiness',
      pvc_bound: 'PVC Bound',
      node_health: 'Node Health',
    };
    return labels[metricType] || metricType;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading alert history...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Alert History</h3>
        <div className="flex gap-2">
          {(['all', 'firing', 'resolved'] as const).map((state) => (
            <button
              key={state}
              onClick={() => setFilter(state)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                filter === state
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {state.charAt(0).toUpperCase() + state.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* History Timeline */}
      {history.length === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-12 text-center">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Alert History
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {filter === 'all'
              ? 'No alerts have been triggered yet'
              : `No ${filter} alerts found`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((entry) => (
            <div
              key={entry.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">
                  {getStateIcon(entry.state)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className="font-bold text-gray-900 dark:text-white truncate">
                      {entry.rule_name || 'Deleted Rule'}
                    </h4>
                    <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {formatDate(entry.triggered_at)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-bold uppercase tracking-wider ${getSeverityColor(entry.severity)}`}>
                      {entry.severity}
                    </span>
                    <span className="text-gray-300 dark:text-gray-600">•</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {entry.metric_type ? getMetricLabel(entry.metric_type) : 'Uptime Check'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {entry.message}
                  </p>
                  {entry.metric_value !== null && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Metric value: <span className="font-mono font-bold text-gray-900 dark:text-white">{Number(entry.metric_value).toFixed(2)}</span>
                      </div>
                      <div className="text-gray-300 dark:text-gray-600">•</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Threshold: <span className="font-mono font-bold text-gray-900 dark:text-white">{entry.threshold_value}</span>
                      </div>
                    </div>
                  )}
                  {entry.state === 'resolved' && entry.resolved_at && (
                    <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                      <CheckCircle className="w-3 h-3" />
                      Resolved at {formatDate(entry.resolved_at)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
