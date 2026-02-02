import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';
import { api } from '../../utils/api';

export default function AlertRuleForm({ siteId, rule, onClose }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    metric_type: 'cpu_percent',
    threshold_operator: '>',
    threshold_value: '',
    time_window_minutes: 5,
    severity: 'warning',
    cooldown_minutes: 30,
    notification_channel_ids: [],
  });
  const [channels, setChannels] = useState([]);
  const [loading, setLoading] = useState(false);
  const { showError, showSuccess } = useNotification();

  useEffect(() => {
    loadChannels();
    if (rule) {
      setFormData({
        name: rule.name || '',
        description: rule.description || '',
        metric_type: rule.metric_type || 'cpu_percent',
        threshold_operator: rule.threshold_operator || '>',
        threshold_value: rule.threshold_value || '',
        time_window_minutes: rule.time_window_minutes || 5,
        severity: rule.severity || 'warning',
        cooldown_minutes: rule.cooldown_minutes || 30,
        notification_channel_ids: rule.channel_ids || [],
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.threshold_value) {
      showError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        ...formData,
        site_id: siteId,
        threshold_value: parseFloat(formData.threshold_value),
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
                required
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

          {/* Severity and Cooldown */}
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
