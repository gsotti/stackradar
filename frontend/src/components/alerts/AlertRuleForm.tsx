import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { X, BarChart2, Radio } from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';
import { api } from '../../utils/api';
import { 
  AlertRule, 
  AlertType, 
  MetricType, 
  ThresholdOperator, 
  AlertSeverity, 
  NotificationChannel, 
  UptimeMonitor 
} from '../../types';

interface AlertRuleFormProps {
  siteId: string | number;
  rule?: (AlertRule & { channel_ids?: number[] }) | null;
  onClose: (updated?: boolean) => void;
}

export default function AlertRuleForm({ siteId, rule, onClose }: AlertRuleFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    alert_type: 'metric' as AlertType,
    metric_type: 'cpu_percent' as MetricType,
    threshold_operator: '>' as ThresholdOperator,
    threshold_value: '' as string | number,
    time_window_minutes: 5,
    severity: 'warning' as AlertSeverity,
    cooldown_minutes: 30,
    failure_threshold: 3,
    notification_channel_ids: [] as number[],
    monitor_id: '' as string | number,
  });
  const [channels, setChannels] = useState<NotificationChannel[]>([]);
  const [monitors, setMonitors] = useState<UptimeMonitor[]>([]);
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
        metric_type: (rule.metric_type || 'cpu_percent') as MetricType,
        threshold_operator: (rule.threshold_operator || '>') as ThresholdOperator,
        threshold_value: rule.threshold_value ?? '',
        time_window_minutes: rule.time_window_minutes || 5,
        severity: rule.severity || 'warning',
        cooldown_minutes: rule.cooldown_minutes || 30,
        failure_threshold: rule.failure_threshold || 3,
        notification_channel_ids: rule.channel_ids || [],
        monitor_id: rule.monitor_id || '',
      });
    }
  }, [rule, siteId]);

  const loadChannels = async () => {
    try {
      const data = await api.get<NotificationChannel[]>(`/alerts/channels?site_id=${siteId}`);
      setChannels(data.filter((c) => c.enabled));
    } catch (error) {
      console.error('Failed to load channels:', error);
    }
  };

  const loadMonitors = async () => {
    try {
      const data = await api.get<UptimeMonitor[]>(`/uptime/monitors?site_id=${siteId}`);
      setMonitors(data || []);
    } catch (error) {
      console.error('Failed to load monitors:', error);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      showError('Please enter a rule name');
      return;
    }

    if (formData.alert_type === 'metric' && formData.threshold_value === '') {
      showError('Please enter a threshold value');
      return;
    }

    if (formData.alert_type === 'uptime' && !formData.monitor_id) {
      showError('Please select a monitor');
      return;
    }

    try {
      setLoading(true);
      const payload: any = {
        ...formData,
        site_id: Number(siteId),
        threshold_value: formData.alert_type === 'metric' ? parseFloat(String(formData.threshold_value)) : null,
        monitor_id: formData.alert_type === 'uptime' ? parseInt(String(formData.monitor_id)) : null,
        failure_threshold: formData.alert_type === 'uptime' ? parseInt(String(formData.failure_threshold)) : Number(formData.failure_threshold),
      };

      if (rule) {
        await api.put(`/alerts/rules/${rule.id}`, payload);
        showSuccess('Alert rule updated successfully');
      } else {
        await api.post('/alerts/rules', payload);
        showSuccess('Alert rule created successfully');
      }

      onClose(true);
    } catch (error: any) {
      showError(error.message || 'Failed to save alert rule');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleChannelToggle = (channelId: number) => {
    setFormData((prev) => {
      const ids = [...prev.notification_channel_ids];
      const index = ids.indexOf(channelId);
      if (index > -1) {
        ids.splice(index, 1);
      } else {
        ids.push(channelId);
      }
      return { ...prev, notification_channel_ids: ids };
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto transform transition-all border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <BarChart2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {rule ? 'Edit Alert Rule' : 'Create Alert Rule'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Define conditions for your alerts</p>
            </div>
          </div>
          <button
            onClick={() => onClose(false)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {/* Rule Type Selection */}
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, alert_type: 'metric' }))}
              className={`flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${
                formData.alert_type === 'metric'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 shadow-md'
                  : 'border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 text-gray-500'
              }`}
            >
              <BarChart2 className="w-5 h-5" />
              <span className="font-bold">Metric-based</span>
            </button>
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, alert_type: 'uptime' }))}
              className={`flex items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${
                formData.alert_type === 'uptime'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 shadow-md'
                  : 'border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 text-gray-500'
              }`}
            >
              <Radio className="w-5 h-5" />
              <span className="font-bold">Uptime-based</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Rule Name *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all hover:border-blue-400 dark:hover:border-blue-500 shadow-sm"
                  placeholder="CPU high usage alert"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all hover:border-blue-400 dark:hover:border-blue-500 shadow-sm"
                  placeholder="Alert when cluster CPU usage exceeds 80%"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Severity
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['info', 'warning', 'critical'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, severity: s as AlertSeverity }))}
                      className={`px-3 py-2 rounded-lg text-xs font-bold uppercase transition-all border ${
                        formData.severity === s
                          ? s === 'critical' ? 'bg-red-100 border-red-500 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : s === 'warning' ? 'bg-yellow-100 border-yellow-500 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                            : 'bg-blue-100 border-blue-500 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-gray-50 border-gray-200 text-gray-500 dark:bg-gray-900 dark:border-gray-700'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6 bg-gray-50 dark:bg-gray-900/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-700">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                Conditions
              </h3>

              {formData.alert_type === 'metric' ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                      Metric
                    </label>
                    <select
                      name="metric_type"
                      value={formData.metric_type}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm shadow-sm"
                    >
                      <option value="cpu_percent">CPU Usage (%)</option>
                      <option value="memory_percent">Memory Usage (%)</option>
                      <option value="error_logs">Error Log Rate</option>
                      <option value="pod_failed">Failed Pod Count</option>
                      <option value="pod_pending">Pending Pod Count</option>
                      <option value="deployment_readiness">Deployment Ready %</option>
                      <option value="pvc_bound">PVC Bound %</option>
                      <option value="node_health">Healthy Node %</option>
                    </select>
                  </div>

                  <div className="flex gap-3">
                    <div className="w-1/3">
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                        Op
                      </label>
                      <select
                        name="threshold_operator"
                        value={formData.threshold_operator}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono shadow-sm"
                      >
                        <option value=">">{'>'}</option>
                        <option value=">=">{'>='}</option>
                        <option value="<">{'<'}</option>
                        <option value="<=">{'<='}</option>
                        <option value="=">{'='}</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                        Value
                      </label>
                      <input
                        type="number"
                        name="threshold_value"
                        value={formData.threshold_value}
                        onChange={handleChange}
                        step="0.1"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono shadow-sm"
                        placeholder="80"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                        Window (m)
                      </label>
                      <input
                        type="number"
                        name="time_window_minutes"
                        value={formData.time_window_minutes}
                        onChange={handleChange}
                        min="1"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm shadow-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                        Cooldown (m)
                      </label>
                      <input
                        type="number"
                        name="cooldown_minutes"
                        value={formData.cooldown_minutes}
                        onChange={handleChange}
                        min="1"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm shadow-sm"
                        required
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                      Select Monitor
                    </label>
                    <select
                      name="monitor_id"
                      value={formData.monitor_id}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm shadow-sm"
                      required
                    >
                      <option value="">Choose a monitor...</option>
                      {monitors.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.url})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                      Failure Threshold
                    </label>
                    <input
                      type="number"
                      name="failure_threshold"
                      value={formData.failure_threshold}
                      onChange={handleChange}
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm shadow-sm"
                      placeholder="e.g. 3 consecutive failures"
                      required
                    />
                    <p className="mt-1 text-[10px] text-gray-500">Alert after this many consecutive check failures</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Notification Channels */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-4">
              Notification Channels
            </label>
            {channels.length === 0 ? (
              <div className="p-4 bg-amber-50 dark:bg-yellow-900/20 border border-amber-200 dark:border-yellow-800 rounded-xl text-sm text-amber-700 dark:text-yellow-400">
                No active notification channels found. Please create one in the Notification Channels tab first.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {channels.map((channel) => (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => handleChannelToggle(channel.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                      formData.notification_channel_ids.includes(channel.id)
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${formData.notification_channel_ids.includes(channel.id) ? 'bg-blue-500' : 'bg-gray-300'}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{channel.name}</p>
                      <p className="text-[10px] uppercase tracking-wider font-semibold opacity-70">{channel.channel_type}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => onClose(false)}
              className="px-6 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-10 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 font-bold disabled:opacity-50"
            >
              {loading ? 'Saving...' : rule ? 'Update Rule' : 'Create Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
