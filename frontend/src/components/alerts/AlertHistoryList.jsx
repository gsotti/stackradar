import { useState, useEffect } from 'react';
import { Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';
import { api } from '../../utils/api';

export default function AlertHistoryList({ systemId }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const { showError } = useNotification();

  useEffect(() => {
    loadHistory();
  }, [systemId, filter]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ system_id: systemId, limit: '50' });
      if (filter !== 'all') {
        params.append('state', filter);
      }
      const data = await api.get(`/alerts/history?${params}`);
      setHistory(data);
    } catch (error) {
      showError(error.message || 'Failed to load alert history');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 dark:text-red-400';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return 'text-blue-600 dark:text-blue-400';
    }
  };

  const getStateIcon = (state) => {
    return state === 'firing' ? (
      <AlertTriangle className="w-5 h-5 text-red-500" />
    ) : (
      <CheckCircle className="w-5 h-5 text-green-500" />
    );
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString();
  };

  const getMetricLabel = (metricType) => {
    const labels = {
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
          {['all', 'firing', 'resolved'].map((state) => (
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
          {history.map((alert) => (
            <div
              key={alert.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="flex-shrink-0 mt-1">{getStateIcon(alert.state)}</div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {alert.rule_name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {getMetricLabel(alert.metric_type)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          alert.severity === 'critical'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                            : alert.severity === 'warning'
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                        }`}
                      >
                        {alert.severity.toUpperCase()}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          alert.state === 'firing'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                            : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                        }`}
                      >
                        {alert.state.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Message */}
                  {alert.message && (
                    <p className="text-gray-700 dark:text-gray-300 mb-3">{alert.message}</p>
                  )}

                  {/* Details */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Metric Value:</span>
                      <span className="ml-2 font-medium text-gray-900 dark:text-white">
                        {alert.metric_value !== null ? alert.metric_value : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Threshold:</span>
                      <span className="ml-2 font-medium text-gray-900 dark:text-white">
                        {alert.threshold_value}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Triggered:</span>
                      <span className="ml-2 font-medium text-gray-900 dark:text-white">
                        {formatDate(alert.triggered_at)}
                      </span>
                    </div>
                    {alert.resolved_at && (
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Resolved:</span>
                        <span className="ml-2 font-medium text-gray-900 dark:text-white">
                          {formatDate(alert.resolved_at)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Notification Status */}
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 text-sm">
                      {alert.notification_sent ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="text-green-600 dark:text-green-400">
                            Notification sent successfully
                          </span>
                        </>
                      ) : alert.notification_error ? (
                        <>
                          <XCircle className="w-4 h-4 text-red-500" />
                          <span className="text-red-600 dark:text-red-400">
                            Notification failed: {alert.notification_error}
                          </span>
                        </>
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400">
                          Notification pending
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
