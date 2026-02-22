import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { Save, Mail, TestTube, CheckCircle, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNotification } from '../contexts/NotificationContext';
import { api } from '../utils/api';
import { SmtpConfig } from '../types';

export default function AdminSettingsPage() {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const [smtpConfig, setSmtpConfig] = useState({
    host: '',
    port: 587,
    secure: false,
    auth_user: '',
    auth_password: '',
    from_email: '',
    from_name: 'StackRadar Alerts',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [configExists, setConfigExists] = useState(false);
  const { showError, showSuccess } = useNotification();

  useEffect(() => {
    loadSmtpConfig();
  }, []);

  const loadSmtpConfig = async () => {
    try {
      setLoading(true);
      const config = await api.get<SmtpConfig | null>('/alerts/smtp-config');
      if (config) {
        setSmtpConfig({
          host: config.host || '',
          port: config.port || 587,
          secure: config.secure || false,
          auth_user: config.auth_user || '',
          auth_password: '', // Never send password from server
          from_email: config.from_email || '',
          from_name: config.from_name || 'StackRadar Alerts',
        });
        setConfigExists(true);
      } else {
        setConfigExists(false);
      }
    } catch (error: any) {
      showError(t('messages.load_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!smtpConfig.host || !smtpConfig.port || !smtpConfig.from_email) {
      showError(t('messages.fill_required'));
      return;
    }

    try {
      setSaving(true);

      // Only send password if it's been changed
      const payload: Partial<typeof smtpConfig> = { ...smtpConfig };
      if (!payload.auth_password) {
        delete payload.auth_password;
      }

      if (configExists) {
        await api.put('/alerts/smtp-config', payload);
        showSuccess(t('messages.updated'));
      } else {
        await api.post('/alerts/smtp-config', payload);
        showSuccess(t('messages.created'));
        setConfigExists(true);
      }
    } catch (error: any) {
      showError(error.message || t('messages.save_failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail) {
      showError(t('messages.test_email_required'));
      return;
    }

    try {
      setTesting(true);
      await api.post('/alerts/smtp-config/test', { test_email: testEmail });
      showSuccess(t('messages.test_sent', { email: testEmail }));
    } catch (error: any) {
      showError(error.message || t('messages.test_failed'));
    } finally {
      setTesting(false);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setSmtpConfig((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseInt(value) : value,
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-6rem)]">
        <div className="text-center">
          <Mail className="w-12 h-12 text-primary-500 animate-pulse mx-auto mb-4" />
          <p className="text-neutral-600 dark:text-neutral-400">{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-heading-2">{t('page.title')}</h1>
        <p className="text-body-secondary mt-2">{t('page.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Main Settings Form */}
        <div className="space-y-4">
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center gap-2">
              <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                <Mail className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              </div>
              <h2 className="text-heading-4">{t('smtp.section_title')}</h2>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-label mb-2">{t('smtp.host_label')}</label>
                  <input
                    type="text"
                    name="host"
                    value={smtpConfig.host}
                    onChange={handleChange}
                    className="input-base w-full"
                    placeholder={t('smtp.host_placeholder')}
                    required
                  />
                </div>

                <div>
                  <label className="block text-label mb-2">{t('smtp.port_label')}</label>
                  <input
                    type="number"
                    name="port"
                    value={smtpConfig.port}
                    onChange={handleChange}
                    className="input-base w-full"
                    placeholder={t('smtp.port_placeholder')}
                    required
                  />
                </div>

                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        name="secure"
                        checked={smtpConfig.secure}
                        onChange={handleChange}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-6 bg-neutral-300 dark:bg-neutral-700 rounded-full peer-checked:bg-primary-500 peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                    </div>
                    <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300 group-hover:text-primary-600 transition-colors">{t('smtp.secure_label')}</span>
                  </label>
                </div>

                <div>
                  <label className="block text-label mb-2">{t('smtp.username_label')}</label>
                  <input
                    type="text"
                    name="auth_user"
                    value={smtpConfig.auth_user}
                    onChange={handleChange}
                    className="input-base w-full"
                    placeholder={t('smtp.username_placeholder')}
                  />
                </div>

                <div>
                  <label className="block text-label mb-2">{t('smtp.password_label')}</label>
                  <input
                    type="password"
                    name="auth_password"
                    value={smtpConfig.auth_password}
                    onChange={handleChange}
                    className="input-base w-full"
                    placeholder={configExists ? t('smtp.password_unchanged_placeholder') : t('smtp.password_placeholder')}
                  />
                </div>

                <div>
                  <label className="block text-label mb-2">{t('smtp.from_email_label')}</label>
                  <input
                    type="email"
                    name="from_email"
                    value={smtpConfig.from_email}
                    onChange={handleChange}
                    className="input-base w-full"
                    placeholder={t('smtp.from_email_placeholder')}
                    required
                  />
                </div>

                <div>
                  <label className="block text-label mb-2">{t('smtp.from_name_label')}</label>
                  <input
                    type="text"
                    name="from_name"
                    value={smtpConfig.from_name}
                    onChange={handleChange}
                    className="input-base w-full"
                    placeholder={t('smtp.from_name_placeholder')}
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="button-primary flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {configExists ? t('smtp.save_button') : t('smtp.create_button')}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Sidebar Actions */}
        <div className="space-y-4">
          {/* Test SMTP */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-accent-warning/10 dark:bg-accent-warning/10 rounded-lg">
                <TestTube className="w-4 h-4 text-accent-warning" />
              </div>
              <h3 className="font-semibold text-neutral-900 dark:text-white">{t('smtp_test.title')}</h3>
            </div>
            
            <p className="text-body-secondary text-xs mb-4">
              {t('smtp_test.description')}
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-label mb-2">{t('smtp_test.recipient_label')}</label>
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="input-base w-full text-sm"
                  placeholder={t('smtp_test.recipient_placeholder')}
                />
              </div>
              <button
                onClick={handleTest}
                disabled={testing || !configExists}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-accent-warning/30 dark:border-accent-warning/30 text-accent-warning hover:bg-accent-warning/10 dark:hover:bg-accent-warning/10 rounded-lg transition-all font-semibold text-sm disabled:opacity-50"
              >
                {testing ? (
                  <div className="w-4 h-4 border-2 border-accent-warning/30 border-t-accent-warning rounded-full animate-spin"></div>
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                {t('smtp_test.send_button')}
              </button>
              {!configExists && (
                <p className="text-[10px] text-center text-accent-warning">
                  {t('smtp_test.save_first')}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
