import React, { useState, useEffect, FormEvent } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { UptimeMonitor, HttpMethod, CreateUptimeMonitorRequest } from '../../types';

const intervalOptions = [
  { value: 60, labelKey: 'form.interval_1m' },
  { value: 300, labelKey: 'form.interval_5m' },
  { value: 900, labelKey: 'form.interval_15m' },
  { value: 1800, labelKey: 'form.interval_30m' },
  { value: 3600, labelKey: 'form.interval_1h' },
];

const methodOptions: HttpMethod[] = ['GET', 'HEAD', 'POST'];

interface UptimeMonitorFormProps {
  monitor?: UptimeMonitor | null;
  onSubmit: (data: Partial<CreateUptimeMonitorRequest>) => void;
  onCancel: () => void;
  loading: boolean;
}

export default function UptimeMonitorForm({ monitor, onSubmit, onCancel, loading }: UptimeMonitorFormProps) {
  const { t } = useTranslation('uptime');
  const { t: tc } = useTranslation('common');
  const [form, setForm] = useState({
    name: '',
    url: '',
    method: 'GET' as HttpMethod,
    interval_seconds: 300,
    expected_status: 200,
    timeout_ms: 10000,
    is_main: false,
  });

  useEffect(() => {
    if (monitor) {
      setForm({
        name: monitor.name || '',
        url: monitor.url || '',
        method: monitor.method || 'GET',
        interval_seconds: monitor.interval_seconds || 300,
        expected_status: monitor.expected_status || 200,
        timeout_ms: monitor.timeout_ms || 10000,
        is_main: monitor.is_main || false,
      });
    }
  }, [monitor]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            {monitor ? t('form.title_edit') : t('form.title_create')}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('form.name_label')}
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t('form.name_placeholder')}
              className="input-base w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('form.url_label')}
            </label>
            <input
              type="url"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder={t('form.url_placeholder')}
              className="input-base w-full"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('form.method_label')}
              </label>
              <select
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value as HttpMethod })}
                className="input-base w-full"
              >
                {methodOptions.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('form.interval_label')}
              </label>
              <select
                value={form.interval_seconds}
                onChange={(e) => setForm({ ...form, interval_seconds: parseInt(e.target.value) })}
                className="input-base w-full"
              >
                {intervalOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('form.expected_status_label')}
              </label>
              <input
                type="number"
                value={form.expected_status}
                onChange={(e) => setForm({ ...form, expected_status: parseInt(e.target.value) })}
                className="input-base w-full"
                min={100}
                max={599}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('form.timeout_label')}
              </label>
              <input
                type="number"
                value={form.timeout_ms / 1000}
                onChange={(e) => setForm({ ...form, timeout_ms: parseInt(e.target.value) * 1000 })}
                className="input-base w-full"
                min={1}
                max={30}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="is_main"
              checked={form.is_main}
              onChange={(e) => setForm({ ...form, is_main: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="is_main" className="text-sm text-gray-700 dark:text-gray-300">
              {t('form.is_main_label')}
            </label>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              onClick={onCancel}
              className="button-secondary button-center"
            >
              {t('form.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="button-primary button-center"
            >
              {loading ? t('form.submit_saving') : monitor ? t('form.submit_update') : t('form.submit_create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
