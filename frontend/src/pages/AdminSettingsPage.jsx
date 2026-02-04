import { useState, useEffect } from 'react';
import { Save, Mail, TestTube, CheckCircle, AlertCircle } from 'lucide-react';
import { useNotification } from '../contexts/NotificationContext';
import { api } from '../utils/api';

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
      const config = await api.get('/alerts/smtp-config');
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
    } catch (error) {
      if (error.message?.includes('not found')) {
        setConfigExists(false);
      } else {
        showError('Failed to load SMTP configuration');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!smtpConfig.host || !smtpConfig.port || !smtpConfig.from_email) {
      showError('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);

      // Only send password if it's been changed
      const payload = { ...smtpConfig };
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
    } catch (error) {
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
    } catch (error) {
      showError(error.message || 'Failed to send test email');
    } finally {
      setTesting(false);
    }
  };

  const handleChange = (e) => {
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
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Configure global settings for stackradar
        </p>
      </div>

      {/* SMTP Configuration */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
          <div className="flex items-center gap-3 text-white">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">SMTP Configuration</h2>
              <p className="text-blue-100 text-sm">Configure email settings for alert notifications</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* SMTP Server */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                SMTP Host *
              </label>
              <input
                type="text"
                name="host"
                value={smtpConfig.host}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                placeholder="smtp.gmail.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Port *
              </label>
              <input
                type="number"
                name="port"
                value={smtpConfig.port}
                onChange={handleChange}
                required
                min="1"
                max="65535"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
              />
            </div>
          </div>

          {/* SSL/TLS */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="secure"
                checked={smtpConfig.secure}
                onChange={handleChange}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Use SSL/TLS
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Enable for port 465 (SSL) or 587 (TLS)
                </p>
              </div>
            </label>
          </div>

          {/* Authentication */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Username
              </label>
              <input
                type="text"
                name="auth_user"
                value={smtpConfig.auth_user}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                placeholder="your-email@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Password {configExists && <span className="text-xs text-gray-500">(leave blank to keep existing)</span>}
              </label>
              <input
                type="password"
                name="auth_password"
                value={smtpConfig.auth_password}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                placeholder={configExists ? '••••••••' : 'Enter password'}
              />
            </div>
          </div>

          {/* From Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                From Email *
              </label>
              <input
                type="email"
                name="from_email"
                value={smtpConfig.from_email}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                placeholder="alerts@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                From Name
              </label>
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

          {/* Save Button */}
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : configExists ? 'Update Configuration' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>

      {/* Test Email */}
      {configExists && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-teal-600 p-6">
            <div className="flex items-center gap-3 text-white">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <TestTube className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Test Email</h2>
                <p className="text-green-100 text-sm">Send a test email to verify your SMTP configuration</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="flex gap-3">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                placeholder="test@example.com"
              />
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || !testEmail}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white rounded-xl font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Send Test Email
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800 dark:text-blue-200">
            <p className="font-semibold mb-2">Common SMTP Settings:</p>
            <ul className="space-y-1 ml-4 list-disc">
              <li><strong>Gmail:</strong> smtp.gmail.com:587 (Use App Password, not regular password)</li>
              <li><strong>Outlook:</strong> smtp-mail.outlook.com:587</li>
              <li><strong>SendGrid:</strong> smtp.sendgrid.net:587</li>
              <li><strong>Mailgun:</strong> smtp.mailgun.org:587</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
