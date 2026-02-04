import { useState, useEffect } from 'react';
import { X, BarChart2, Radio } from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';
import { api } from '../../utils/api';

export default function AlertRuleForm({ siteId, rule, onClose }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    alert_type: 'metric',
    metric_type: 'cpu_percent',
    threshold_operator: '>',
    threshold_value: '',
    time_window_minutes: 5,
    severity: 'warning',
    cooldown_minutes: 30,
    failure_threshold: 3,
    notification_channel_ids: [],
    monitor_id: '',
  });
  const [channels, setChannels] = useState([]);
  const [monitors, setMonitors] = useState([]);
  const [loading, setLoading] = useState(false);
  const { showError, showSuccess } = useNotification();

  useEffect(() => {
    loadChannels();
    loadMonitors();
    if (rule) {
      setFormData({
        name: rule.name || '',
        description: rule.description || '',
        alert_type: rule.alert_type || 'metric',
        metric_type: rule.metric_type || 'cpu_percent',
        threshold_operator: rule.threshold_operator || '>',
        threshold_value: rule.threshold_value || '',
        time_window_minutes: rule.time_window_minutes || 5,
        severity: rule.severity || 'warning',
        cooldown_minutes: rule.cooldown_minutes || 30,
        failure_threshold: rule.failure_threshold || 3,
        notification_channel_ids: rule.channel_ids || [],
        monitor_id: rule.monitor_id || '',
      });
    }
  }, [rule]);

  const loadChannels = async () => {
    try {
      const data = await api.get(`/alerts/channels?site_id=${siteId}`);
      setChannels(data.filter((c) => c.enabled));
    } catch (error) {
      console.error('Failed to load channels:', error);
    }
  };

  const loadMonitors = async () => {
    try {
      const data = await api.get(`/uptime/monitors?site_id=${siteId}`);
      setMonitors(data || []);
    } catch (error) {
      console.error('Failed to load monitors:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name) {
      showError('Please enter a rule name');
      return;
    }

    if (formData.alert_type === 'metric' && !formData.threshold_value) {
      showError('Please enter a threshold value');
      return;
    }

    if (formData.alert_type === 'uptime' && !formData.monitor_id) {
      showError('Please select a monitor');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        ...formData,
        site_id: siteId,
        threshold_value: formData.alert_type === 'metric' ? parseFloat(formData.threshold_value) : null,
        monitor_id: formData.alert_type === 'uptime' ? parseInt(formData.monitor_id) : null,
        failure_threshold: formData.alert_type === 'uptime' ? parseInt(formData.failure_threshold) : null,
      };

      if (rule) {
        await api.put(`/alerts/rules/${rule.id}`, payload);
        showSuccess('Alert rule updated successfully');
      } else {
        await api.post('/alerts/rules', payload);
        showSuccess('Alert rule created successfully');
      }

      onClose(true);
    } catch (error) {
      showError(error.message || 'Failed to save alert rule');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleChannelToggle = (channelId) => {
    setFormData((prev) => ({
      ...prev,
      notification_channel_ids: prev.notification_channel_ids.includes(channelId)
        ? prev.notification_channel_ids.filter((id) => id !== channelId)
        : [...prev.notification_channel_ids, channelId],
    }));
  };

  const metricTypes = [
    { value: 'cpu_percent', label: 'CPU Usage (%)' },
    { value: 'memory_percent', label: 'Memory Usage (%)' },
    { value: 'error_logs', label: 'Error Log Count' },
    { value: 'pod_failed', label: 'Failed Pods' },
    { value: 'pod_pending', label: 'Pending Pods' },
    { value: 'deployment_readiness', label: 'Deployment Readiness (%)' },
    { value: 'pvc_bound', label: 'PVC Bound Status (%)' },
    { value: 'node_health', label: 'Node Health (%)' },
  ];

  const operators = [
    { value: '>', label: '> (greater than)' },
    { value: '>=', label: '>= (greater than or equal)' },
    { value: '<', label: '< (less than)' },
    { value: '<=', label: '<= (less than or equal)' },
    { value: '=', label: '= (equals)' },
  ];

  const severities = [
    { value: 'critical', label: 'Critical' },
    { value: 'warning', label: 'Warning' },
    { value: 'info', label: 'Info' },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {rule ? 'Edit Alert Rule' : 'Create Alert Rule'}
          </h2>
          <button
            onClick={() => onClose(false)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Rule Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
              placeholder="e.g., High CPU Alert"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
              placeholder="Optional description"
            />
          </div>

          {/* Alert Type Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Alert Type
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, alert_type: 'metric', severity: 'warning' }))}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                  formData.alert_type === 'metric'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <BarChart2 className="w-5 h-5" />
                <span className="font-medium">Metric Alert</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, alert_type: 'uptime', severity: 'critical' }))}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                  formData.alert_type === 'uptime'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
                }`}
              >
                <Radio className="w-5 h-5" />
                <span className="font-medium">Uptime Alert</span>
              </button>
            </div>
          </div>

          {/* Metric Alert Settings */}
          {formData.alert_type === 'metric' && (
            <>
              {/* Metric Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Metric Type *
                </label>
                <select
                  name="metric_type"
                  value={formData.metric_type}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                >
                  {metricTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Threshold Operator and Value */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Operator *
                  </label>
                  <select
                    name="threshold_operator"
                    value={formData.threshold_operator}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                  >
                    {operators.map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Threshold Value *
                  </label>
                  <input
                    type="number"
                    name="threshold_value"
                    value={formData.threshold_value}
                    onChange={handleChange}
                    step="0.01"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                    placeholder="e.g., 80"
                  />
                </div>
              </div>

              {/* Time Window (only for error_logs) */}
              {formData.metric_type === 'error_logs' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Time Window (minutes)
                  </label>
                  <input
                    type="number"
                    name="time_window_minutes"
                    value={formData.time_window_minutes}
                    onChange={handleChange}
                    min="1"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                  />
                </div>
              )}
            </>
          )}

          {/* Uptime Alert Settings */}
          {formData.alert_type === 'uptime' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Monitor *
                </label>
                {monitors.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl">
                    No uptime monitors available. Create one in the Monitors tab first.
                  </p>
                ) : (
                  <select
                    name="monitor_id"
                    value={formData.monitor_id}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                  >
                    <option value="">Select a monitor...</option>
                    {monitors.map((monitor) => (
                      <option key={monitor.id} value={monitor.id}>
                        {monitor.name} ({monitor.url})
                      </option>
                    ))}
                  </select>
                )}
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  You will be notified when this monitor goes down or recovers.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Failure Threshold
                </label>
                <select
                  name="failure_threshold"
                  value={formData.failure_threshold}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                >
                  {[1, 2, 3, 5].map((t) => (
                    <option key={t} value={t}>
                      {t} consecutive failure{t > 1 ? 's' : ''} before alerting
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  How many consecutive check failures before triggering an alert.
                </p>
              </div>
            </>
          )}

          {/* Severity and Cooldown - only for metric alerts */}
          {formData.alert_type === 'metric' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Severity
                </label>
                <select
                  name="severity"
                  value={formData.severity}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                >
                  {severities.map((sev) => (
                    <option key={sev.value} value={sev.value}>
                      {sev.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Cooldown (minutes)
                </label>
                <input
                  type="number"
                  name="cooldown_minutes"
                  value={formData.cooldown_minutes}
                  onChange={handleChange}
                  min="1"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                />
              </div>
            </div>
          )}

          {/* Notification Channels */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Notification Channels
            </label>
            {channels.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No notification channels available. Create one first.
              </p>
            ) : (
              <div className="space-y-2">
                {channels.map((channel) => (
                  <label
                    key={channel.id}
                    className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={formData.notification_channel_ids.includes(channel.id)}
                      onChange={() => handleChannelToggle(channel.id)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {channel.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {channel.channel_type === 'email' ? 'Email' : 'Webhook'}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => onClose(false)}
              className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : rule ? 'Update Rule' : 'Create Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
