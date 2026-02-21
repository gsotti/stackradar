import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Power, AlertTriangle, Info, BarChart2, Radio } from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';
import { usePermissions } from '../../hooks/usePermissions';
import { api } from '../../utils/api';
import AlertRuleForm from './AlertRuleForm';
import { AlertRule, AlertSeverity, AlertType, MetricType } from '../../types';
import ConfirmDialog from '../common/ConfirmDialog';

interface AlertRuleListProps {
  siteId: string | number;
}

interface AlertRuleWithChannels extends AlertRule {
  channel_ids: number[];
}

export default function AlertRuleList({ siteId }: AlertRuleListProps) {
  const [rules, setRules] = useState<AlertRuleWithChannels[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRuleWithChannels | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AlertRuleWithChannels | null>(null);
  const { showError, showSuccess } = useNotification();
  const { isViewer } = usePermissions();

  useEffect(() => {
    loadRules();
  }, [siteId]);

  const loadRules = async () => {
    try {
      setLoading(true);
      const data = await api.get<AlertRuleWithChannels[]>(`/alerts/rules?site_id=${siteId}`);
      setRules(data);
    } catch (error: any) {
      showError(error.message || 'Failed to load alert rules');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingRule(null);
    setShowForm(true);
  };

  const handleEdit = (rule: AlertRuleWithChannels) => {
    setEditingRule(rule);
    setShowForm(true);
  };

  const handleDelete = async (ruleId: number) => {
     try {
       await api.delete(`/alerts/rules/${ruleId}`);
       showSuccess('Alert rule deleted successfully');
       loadRules();
     } catch (error: any) {
       showError(error.message || 'Failed to delete alert rule');
     }
   };

  const handleToggle = async (rule: AlertRuleWithChannels) => {
    try {
      await api.put(`/alerts/rules/${rule.id}`, { enabled: !rule.enabled });
      showSuccess(`Alert rule ${rule.enabled ? 'disabled' : 'enabled'}`);
      loadRules();
    } catch (error: any) {
      showError(error.message || 'Failed to toggle alert rule');
    }
  };

  const handleFormClose = (shouldReload?: boolean) => {
    setShowForm(false);
    setEditingRule(null);
    if (shouldReload) {
      loadRules();
    }
  };

  const getSeverityIcon = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
    }
  };

  const getMetricLabel = (metricType: MetricType | string) => {
    const labels: Record<string, string> = {
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

  const getAlertTypeIcon = (alertType: AlertType) => {
    return alertType === 'metric' ? (
      <BarChart2 className="w-4 h-4 text-blue-500" />
    ) : (
      <Radio className="w-4 h-4 text-purple-500" />
    );
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
          {!isViewer() && (
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium text-sm shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Rule
            </button>
          )}
        </div>

        {/* Rules Grid */}
        {rules.length === 0 ? (
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-8 text-center border border-dashed border-gray-300 dark:border-gray-700">
            <AlertTriangle className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400">No alert rules defined yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={`bg-white dark:bg-gray-800 rounded-xl border p-5 shadow-sm transition-all ${
                  rule.enabled
                    ? 'border-gray-200 dark:border-gray-700'
                    : 'border-gray-100 dark:border-gray-800 opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getAlertTypeIcon(rule.alert_type)}
                      <h4 className="font-bold text-gray-900 dark:text-white truncate">{rule.name}</h4>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-1">
                      {rule.description || 'No description'}
                    </p>
                    
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${getSeverityColor(rule.severity)}`}>
                        {getSeverityIcon(rule.severity)}
                        {rule.severity}
                      </span>
                      <span className="px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] font-bold uppercase tracking-wider">
                        {rule.alert_type === 'metric' 
                          ? `${getMetricLabel(rule.metric_type!)} ${rule.threshold_operator} ${rule.threshold_value}`
                          : 'Uptime Check'}
                      </span>
                    </div>
                  </div>

                  {!isViewer() && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggle(rule)}
                        className={`p-2 rounded-lg transition-colors ${
                          rule.enabled
                            ? 'text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20'
                            : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                        title={rule.enabled ? 'Disable' : 'Enable'}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(rule)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(rule)}
                        className="button-danger button-sm"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between mt-2 pt-4 border-t border-gray-50 dark:border-gray-700">
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    {rule.alert_type === 'metric' ? (
                      <>
                        <span>Window: {rule.time_window_minutes}m</span>
                        <span>•</span>
                        <span>Cooldown: {rule.cooldown_minutes}m</span>
                        {rule.repeat_interval_hours > 1 && (
                          <>
                            <span>•</span>
                            <span>Repeat: {rule.repeat_interval_hours}h</span>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <span>Threshold: {rule.failure_threshold} failures</span>
                        {rule.repeat_interval_hours > 1 && (
                          <>
                            <span>•</span>
                            <span>Repeat: {rule.repeat_interval_hours}h</span>
                          </>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">Channels:</span>
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                      {rule.channel_ids?.length || 0}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <AlertRuleForm
          siteId={siteId}
          rule={editingRule}
          onClose={handleFormClose}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete alert rule?"
        description={deleteTarget ? `Delete "${deleteTarget.name}".` : undefined}
        confirmLabel="Delete"
        variant="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          handleDelete(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}
