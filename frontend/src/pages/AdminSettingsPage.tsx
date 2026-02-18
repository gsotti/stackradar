import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { Save, Mail, TestTube, CheckCircle, AlertCircle } from 'lucide-react';
import { useNotification } from '../contexts/NotificationContext';
import { api } from '../utils/api';
import { SmtpConfig } from '../types';

export default function AdminSettingsPage() {
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
      showError('Failed to load SMTP configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!smtpConfig.host || !smtpConfig.port || !smtpConfig.from_email) {
      showError('Please fill in all required fields');
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
        showSuccess('SMTP configuration updated successfully');
      } else {
        await api.post('/alerts/smtp-config', payload);
        showSuccess('SMTP configuration created successfully');
        setConfigExists(true);
      }
    } catch (error: any) {
      showError(error.message || 'Failed to save SMTP configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail) {
      showError('Please enter a test email address');
      return;
    }

    try {
      setTesting(true);
      await api.post('/alerts/smtp-config/test', { test_email: testEmail });
      showSuccess(`Test email sent successfully to ${testEmail}`);
    } catch (error: any) {
      showError(error.message || 'Failed to send test email');
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
          <Mail className="w-12 h-12 text-blue-500 animate-pulse mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Admin Settings
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Configure platform-wide settings — these apply to all organizations</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Main Settings Form */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Email Configuration (SMTP)</h2>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">SMTP Host *</label>
                  <input
                    type="text"
                    name="host"
                    value={smtpConfig.host}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                    placeholder="smtp.example.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">SMTP Port *</label>
                  <input
                    type="number"
                    name="port"
                    value={smtpConfig.port}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                    placeholder="587"
                    required
                  />
                </div>

                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        name="secure"
                        checked={smtpConfig.secure}
                        onChange={handleChange}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-blue-600 transition-colors">Use SSL/TLS (Secure)</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Username</label>
                  <input
                    type="text"
                    name="auth_user"
                    value={smtpConfig.auth_user}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                    placeholder="user@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Password</label>
                  <input
                    type="password"
                    name="auth_password"
                    value={smtpConfig.auth_password}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                    placeholder={configExists ? '•••••••• (unchanged)' : 'Enter password'}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">From Email *</label>
                  <input
                    type="email"
                    name="from_email"
                    value={smtpConfig.from_email}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                    placeholder="alerts@stackradar.io"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">From Name</label>
                  <input
                    type="text"
                    name="from_name"
                    value={smtpConfig.from_name}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                    placeholder="StackRadar Alerts"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-8 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 font-bold disabled:opacity-50"
                >
                  {saving ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <Save className="w-5 h-5" />
                  )}
                  {configExists ? 'Save Configuration' : 'Create Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Sidebar Actions */}
        <div className="space-y-6">
          {/* Test SMTP */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-lg">
                <TestTube className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white">Test Connection</h3>
            </div>
            
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Verify your SMTP settings by sending a test email to yourself.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Test Recipient</label>
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder="your-email@example.com"
                />
              </div>
              <button
                onClick={handleTest}
                disabled={testing || !configExists}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-amber-300 dark:border-amber-700 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-xl transition-all font-bold text-sm disabled:opacity-50"
              >
                {testing ? (
                  <div className="w-4 h-4 border-2 border-amber-600/30 border-t-amber-600 rounded-full animate-spin"></div>
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                Send Test Email
              </button>
              {!configExists && (
                <p className="text-[10px] text-center text-amber-600 dark:text-amber-400">
                  Save configuration before testing
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
