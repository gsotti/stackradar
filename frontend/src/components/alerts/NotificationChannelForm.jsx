import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';
import { api } from '../../utils/api';

export default function NotificationChannelForm({ systemId, channel, onClose }) {
  const [formData, setFormData] = useState({
    name: '',
    channel_type: 'email',
    email_recipients: '',
    webhook_url: '',
    webhook_method: 'POST',
    webhook_headers: '',
  });
  const [loading, setLoading] = useState(false);
  const { showError, showSuccess } = useNotification();

  useEffect(() => {
    if (channel) {
      setFormData({
        name: channel.name || '',
        channel_type: channel.channel_type || 'email',
        email_recipients: channel.email_recipients ? channel.email_recipients.join(', ') : '',
        webhook_url: channel.webhook_url || '',
        webhook_method: channel.webhook_method || 'POST',
        webhook_headers: channel.webhook_headers
          ? JSON.stringify(channel.webhook_headers, null, 2)
          : '',
      });
    }
  }, [channel]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name) {
      showError('Please fill in all required fields');
      return;
    }

    if (formData.channel_type === 'email' && !formData.email_recipients) {
      showError('Email recipients are required for email channels');
      return;
    }

    if (formData.channel_type === 'webhook' && !formData.webhook_url) {
      showError('Webhook URL is required for webhook channels');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        system_id: systemId,
        name: formData.name,
        channel_type: formData.channel_type,
      };

      if (formData.channel_type === 'email') {
        payload.email_recipients = formData.email_recipients
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean);
      } else {
        payload.webhook_url = formData.webhook_url;
        payload.webhook_method = formData.webhook_method;
        if (formData.webhook_headers) {
          try {
            payload.webhook_headers = JSON.parse(formData.webhook_headers);
          } catch (error) {
            showError('Invalid JSON format for webhook headers');
            setLoading(false);
            return;
          }
        }
      }

      if (channel) {
        await api.put(`/alerts/channels/${channel.id}`, payload);
        showSuccess('Notification channel updated successfully');
      } else {
        await api.post('/alerts/channels', payload);
        showSuccess('Notification channel created successfully');
      }

      onClose(true);
    } catch (error) {
      showError(error.message || 'Failed to save notification channel');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {channel ? 'Edit Notification Channel' : 'Create Notification Channel'}
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
              Channel Name *
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
              placeholder="e.g., Engineering Team Email"
            />
          </div>

          {/* Channel Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Channel Type *
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label
                className={`flex items-center justify-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  formData.channel_type === 'email'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                }`}
              >
                <input
                  type="radio"
                  name="channel_type"
                  value="email"
                  checked={formData.channel_type === 'email'}
                  onChange={handleChange}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="font-medium text-gray-900 dark:text-white">Email</span>
              </label>
              <label
                className={`flex items-center justify-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  formData.channel_type === 'webhook'
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                }`}
              >
                <input
                  type="radio"
                  name="channel_type"
                  value="webhook"
                  checked={formData.channel_type === 'webhook'}
                  onChange={handleChange}
                  className="w-4 h-4 text-purple-600"
                />
                <span className="font-medium text-gray-900 dark:text-white">Webhook</span>
              </label>
            </div>
          </div>

          {/* Email-specific fields */}
          {formData.channel_type === 'email' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email Recipients *
              </label>
              <textarea
                name="email_recipients"
                value={formData.email_recipients}
                onChange={handleChange}
                required={formData.channel_type === 'email'}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                placeholder="email1@example.com, email2@example.com"
              />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Comma-separated email addresses
              </p>
            </div>
          )}

          {/* Webhook-specific fields */}
          {formData.channel_type === 'webhook' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Webhook URL *
                </label>
                <input
                  type="url"
                  name="webhook_url"
                  value={formData.webhook_url}
                  onChange={handleChange}
                  required={formData.channel_type === 'webhook'}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all font-mono text-sm"
                  placeholder="https://hooks.example.com/..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  HTTP Method
                </label>
                <select
                  name="webhook_method"
                  value={formData.webhook_method}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                >
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Custom Headers (JSON)
                </label>
                <textarea
                  name="webhook_headers"
                  value={formData.webhook_headers}
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all font-mono text-sm"
                  placeholder={'{\n  "Content-Type": "application/json"\n}'}
                />
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Optional custom HTTP headers in JSON format
                </p>
              </div>
            </>
          )}

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
              {loading ? 'Saving...' : channel ? 'Update Channel' : 'Create Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
