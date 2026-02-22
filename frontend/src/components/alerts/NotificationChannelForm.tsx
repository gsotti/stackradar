import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('alerts');
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
      showError(t('channels_messages.required_fields'));
      return;
    }

    if (formData.channel_type === 'email' && !formData.email_recipients) {
      showError(t('channels_messages.recipients_required'));
      return;
    }

    if (formData.channel_type === 'webhook' && !formData.webhook_url) {
      showError(t('channels_messages.webhook_url_required'));
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
            showError(t('channels_messages.invalid_json_headers'));
            setLoading(false);
            return;
          }
        }
      }

      if (channel) {
        await api.put(`/alerts/channels/${channel.id}`, payload);
        showSuccess(t('channels_messages.updated'));
      } else {
        await api.post('/alerts/channels', payload);
        showSuccess(t('channels_messages.created'));
      }

      onClose(true);
    } catch (error: any) {
      showError(error.message || t('channels_messages.save_failed'));
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
          <h2 className="text-2xl font-bold text-primary-600 dark:text-primary-400">
            {channel ? t('channels_form.title_edit') : t('channels_form.title_create')}
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
                {t('channels_form.name_label')}
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="input-base w-full"
                placeholder={t('channels_form.name_placeholder')}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('channels_form.type_label')}
              </label>
              <select
                name="channel_type"
                value={formData.channel_type}
                onChange={handleChange}
                className="input-base w-full"
              >
                <option value="email" disabled={!smtpConfigured}>
                  {!smtpConfigured ? t('channels_form.type_email_no_smtp') : t('channels_form.type_email')}
                </option>
                <option value="webhook">{t('channels_form.type_webhook')}</option>
              </select>
            </div>
          </div>

          {formData.channel_type === 'email' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('channels_form.recipients_label')}
              </label>
              <textarea
                name="email_recipients"
                value={formData.email_recipients}
                onChange={handleChange}
                className="input-base w-full"
                placeholder={t('channels_form.recipients_placeholder')}
                rows={3}
                required
              />
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {t('channels_form.recipients_help')}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('channels_form.webhook_url_label')}
                </label>
                <input
                  type="url"
                  name="webhook_url"
                  value={formData.webhook_url}
                  onChange={handleChange}
                  className="input-base w-full"
                  placeholder={t('channels_form.webhook_url_placeholder')}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('channels_form.http_method_label')}
                </label>
                <select
                  name="webhook_method"
                  value={formData.webhook_method}
                  onChange={handleChange}
                  className="input-base w-full"
                >
                  <option value="POST">{t('channels_form.method_post')}</option>
                  <option value="PUT">{t('channels_form.method_put')}</option>
                  <option value="GET">{t('channels_form.method_get')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('channels_form.headers_label')}
                </label>
                <textarea
                  name="webhook_headers"
                  value={formData.webhook_headers}
                  onChange={handleChange}
                  className="input-base w-full font-mono text-sm"
                  placeholder={t('channels_form.headers_placeholder')}
                  rows={4}
                />
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              onClick={() => onClose(false)}
              className="button-secondary button-center"
            >
              {t('channels_form.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="button-primary button-center"
            >
              {loading ? t('channels_form.submit_saving') : channel ? t('channels_form.submit_update') : t('channels_form.submit_create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
