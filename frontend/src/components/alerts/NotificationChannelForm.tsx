import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { X } from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';
import { api } from '../../utils/api';
import { NotificationChannel, ChannelType } from '../../types';

interface NotificationChannelFormProps {
  siteId: string | number;
  channel?: NotificationChannel | null;
  smtpConfigured?: boolean;
  onClose: (updated?: boolean) => void;
}

export default function NotificationChannelForm({ siteId, channel, smtpConfigured = true, onClose }: NotificationChannelFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    channel_type: (smtpConfigured ? 'email' : 'webhook') as ChannelType,
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
        webhook_method: (channel as any).webhook_method || 'POST',
        webhook_headers: channel.webhook_headers
          ? JSON.stringify(channel.webhook_headers, null, 2)
          : '',
      });
    }
  }, [channel]);

  const handleSubmit = async (e: FormEvent) => {
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
      const payload: any = {
        site_id: Number(siteId),
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
    } catch (error: any) {
      showError(error.message || 'Failed to save notification channel');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
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

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Channel Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                placeholder="Internal Support Email"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Channel Type
              </label>
              <select
                name="channel_type"
                value={formData.channel_type}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
              >
                <option value="email" disabled={!smtpConfigured}>
                  Email{!smtpConfigured ? ' (SMTP not configured)' : ''}
                </option>
                <option value="webhook">Webhook</option>
              </select>
            </div>
          </div>

          {formData.channel_type === 'email' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email Recipients *
              </label>
              <textarea
                name="email_recipients"
                value={formData.email_recipients}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                placeholder="user1@example.com, user2@example.com"
                rows={3}
                required
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Comma-separated list of email addresses
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Webhook URL *
                </label>
                <input
                  type="url"
                  name="webhook_url"
                  value={formData.webhook_url}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                  placeholder="https://hooks.slack.com/services/..."
                  required
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
                  <option value="GET">GET (for testing)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Webhook Headers (JSON)
                </label>
                <textarea
                  name="webhook_headers"
                  value={formData.webhook_headers}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm transition-all"
                  placeholder='{ "Authorization": "Bearer token" }'
                  rows={4}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-4 pt-4">
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
              className="px-8 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 font-semibold disabled:opacity-50"
            >
              {loading ? 'Saving...' : channel ? 'Update Channel' : 'Create Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
