import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Power, AlertTriangle, Info, Zap, Bell, BarChart2, Radio } from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';
import { api } from '../../utils/api';
import AlertRuleForm from './AlertRuleForm';

export default function AlertRuleList({ siteId }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const { showError, showSuccess } = useNotification();

  useEffect(() => {
    loadRules();
  }, [siteId]);

  const loadRules = async () => {
    try {
      setLoading(true);
      const data = await api.get(`/alerts/rules?site_id=${siteId}`);
      setRules(data);
    } catch (error) {
      showError(error.message || 'Failed to load alert rules');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingRule(null);
    setShowForm(true);
  };

  const handleEdit = (rule) => {
    setEditingRule(rule);
    setShowForm(true);
  };

  const handleDelete = async (ruleId) => {
    if (!confirm('Are you sure you want to delete this alert rule?')) {
      return;
    }

    try {
      await api.delete(`/alerts/rules/${ruleId}`);
      showSuccess('Alert rule deleted successfully');
      loadRules();
    } catch (error) {
      showError(error.message || 'Failed to delete alert rule');
    }
  };

  const handleToggle = async (rule) => {
    try {
      await api.put(`/alerts/rules/${rule.id}`, { enabled: !rule.enabled });
      showSuccess(`Alert rule ${rule.enabled ? 'disabled' : 'enabled'}`);
      loadRules();
    } catch (error) {
      showError(error.message || 'Failed to toggle alert rule');
    }
  };

  const handleFormClose = (shouldReload) => {
    setShowForm(false);
    setEditingRule(null);
    if (shouldReload) {
      loadRules();
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
    }
  };

  const getMetricLabel = (metricType) => {
    const labels = {
      cpu_percent: 'CPU Usage',
      memory_percent: 'Memory Usage',
      error_logs: 'Error Logs',
      pod_failed: 'Failed Pods',
      pod_pending: 'Pending Pods',
      deployment_readiness: 'Deployment Readiness',
      pvc_bound: 'PVC Bound Status',
      node_health: 'Node Health',
    };
    return labels[metricType] || metricType;
  };

  const getAlertTypeIcon = (alertType) => {
    return alertType === 'uptime' ? Radio : BarChart2;
  };

  const getAlertTypeBadge = (alertType) => {
    return alertType === 'uptime'
      ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-400'
      : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading alert rules...</div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Alert Rules</h3>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-medium transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create Alert Rule
          </button>
        </div>

        {/* Rules List */}
        {rules.length === 0 ? (
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-12 text-center">
            <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No Alert Rules Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Create your first alert rule to monitor your system metrics
            </p>
            <button
              onClick={handleCreate}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-medium transition-all shadow-sm"
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Create Alert Rule
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {rules.map((rule) => {
              const AlertTypeIcon = getAlertTypeIcon(rule.alert_type);
              return (
              <div
                key={rule.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getSeverityIcon(rule.severity)}
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {rule.name}
                      </h4>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${getAlertTypeBadge(rule.alert_type)}`}
                      >
                        <AlertTypeIcon className="w-3 h-3 inline mr-1" />
                        {rule.alert_type === 'uptime' ? 'Uptime' : 'Metric'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(
                          rule.severity
                        )}`}
                      >
                        {rule.severity.toUpperCase()}
                      </span>
                      {!rule.enabled && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                          DISABLED
                        </span>
                      )}
                    </div>
                    {rule.description && (
                      <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                        {rule.description}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {rule.alert_type === 'metric' ? (
                        <>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Metric:</span>
                            <span className="ml-2 font-medium text-gray-900 dark:text-white">
                              {getMetricLabel(rule.metric_type)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Condition:</span>
                            <span className="ml-2 font-medium text-gray-900 dark:text-white">
                              {rule.threshold_operator} {rule.threshold_value}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="col-span-2">
                          <span className="text-gray-500 dark:text-gray-400">Monitor:</span>
                          <span className="ml-2 font-medium text-gray-900 dark:text-white">
                            {rule.monitor_name || `Monitor #${rule.monitor_id}`}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Cooldown:</span>
                        <span className="ml-2 font-medium text-gray-900 dark:text-white">
                          {rule.cooldown_minutes} minutes
                        </span>
                      </div>
                      {rule.alert_type === 'metric' && rule.metric_type === 'error_logs' && (
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Time Window:</span>
                          <span className="ml-2 font-medium text-gray-900 dark:text-white">
                            {rule.time_window_minutes} minutes
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleToggle(rule)}
                      className={`p-2 rounded-lg transition-colors ${
                        rule.enabled
                          ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                          : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                      title={rule.enabled ? 'Disable' : 'Enable'}
                    >
                      <Power className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleEdit(rule)}
                      className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <AlertRuleForm
          siteId={siteId}
          rule={editingRule}
          onClose={handleFormClose}
        />
      )}
    </>
  );
}
