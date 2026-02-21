import React, { useState, useEffect, FormEvent } from 'react';
import { X } from 'lucide-react';
import { UptimeMonitor, HttpMethod, CreateUptimeMonitorRequest } from '../../types';

const intervalOptions = [
  { value: 60, label: '1 minute' },
  { value: 300, label: '5 minutes' },
  { value: 900, label: '15 minutes' },
  { value: 1800, label: '30 minutes' },
  { value: 3600, label: '1 hour' },
];

const methodOptions: HttpMethod[] = ['GET', 'HEAD', 'POST'];

interface UptimeMonitorFormProps {
  monitor?: UptimeMonitor | null;
  onSubmit: (data: Partial<CreateUptimeMonitorRequest>) => void;
  onCancel: () => void;
  loading: boolean;
}

export default function UptimeMonitorForm({ monitor, onSubmit, onCancel, loading }: UptimeMonitorFormProps) {
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
            {monitor ? 'Edit Monitor' : 'Add Monitor'}
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
              Name *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="API Health Check"
              className="input-base w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              URL *
            </label>
            <input
              type="url"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://api.example.com/health"
              className="input-base w-full"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                HTTP Method
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
                Check Interval
              </label>
              <select
                value={form.interval_seconds}
                onChange={(e) => setForm({ ...form, interval_seconds: parseInt(e.target.value) })}
                className="input-base w-full"
              >
                {intervalOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Expected Status
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
                Timeout (seconds)
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
              Main monitor (shows status on site overview)
            </label>
          </div>

          <div className="modal-actions">
            <button
              type="button"
              onClick={onCancel}
              className="button-secondary button-center"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="button-primary button-center"
            >
              {loading ? 'Saving...' : monitor ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
