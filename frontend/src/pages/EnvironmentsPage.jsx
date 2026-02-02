import React, { useState, useEffect } from 'react';
import { Globe, Plus, Edit2, Trash2 } from 'lucide-react';
import { useNotification } from '../contexts/NotificationContext';
import { api } from '../utils/api';

export default function EnvironmentsPage() {
  const [environments, setEnvironments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEnv, setEditingEnv] = useState(null);
  const [form, setForm] = useState({ site_id: '', name: '', display_name: '' });
  const [sites, setSites] = useState([]);
  const { showError, showSuccess } = useNotification();

  useEffect(() => {
    loadEnvironments();
    loadSites();
  }, []);

  const loadSites = async () => {
    try {
      const data = await api.get('/sites');
      setSites(data);
    } catch (error) {
      showError(error.message || 'Failed to load sites');
    }
  };

  const loadEnvironments = async () => {
    try {
      setLoading(true);
      const data = await api.get('/environments');
      setEnvironments(data);
    } catch (error) {
      showError(error.message || 'Failed to load environments');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingEnv) {
        await api.put(`/environments/${editingEnv.id}`, {
          name: form.name,
          display_name: form.display_name || null
        });
        showSuccess('Environment updated successfully');
      } else {
        await api.post('/environments', form);
        showSuccess('Environment created successfully');
      }
      setShowForm(false);
      setEditingEnv(null);
      setForm({ site_id: '', name: '', display_name: '' });
      loadEnvironments();
    } catch (error) {
      showError(error.message || 'Failed to save environment');
    }
  };

  const handleEdit = (env) => {
    setEditingEnv(env);
    setForm({ site_id: env.site_id, name: env.name, display_name: env.display_name || '' });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this environment?')) return;
    try {
      await api.delete(`/environments/${id}`);
      showSuccess('Environment deleted successfully');
      loadEnvironments();
    } catch (error) {
      showError(error.message || 'Failed to delete environment');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-6rem)]">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Environments</h1>
        <button
          onClick={() => {
            setEditingEnv(null);
            setForm({ site_id: '', name: '', display_name: '' });
            setShowForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create Environment
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {editingEnv ? 'Edit Environment' : 'Create Environment'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!editingEnv && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Site *
                </label>
                <select
                  value={form.site_id}
                  onChange={(e) => setForm({ ...form, site_id: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select a site</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                placeholder="e.g., dev, staging, prod, qa, uat"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                This is used for matching logs from collectors
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Display Name
              </label>
              <input
                type="text"
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                placeholder="e.g., US West Production, Europe Staging"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Custom display name shown in the UI (optional)
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all"
              >
                {editingEnv ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingEnv(null);
                  setForm({ site_id: '', name: '', display_name: '' });
                }}
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-4">
        {environments.map((env) => (
          <div
            key={env.id}
            className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow p-6"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-600 rounded-xl flex items-center justify-center">
                  <Globe className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {env.display_name || env.name}
                  </h3>
                  {env.display_name && (
                    <p className="text-xs text-gray-500 dark:text-gray-500 mb-1">
                      Environment: {env.name}
                    </p>
                  )}
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Site: {env.site_name || 'Unknown'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(env)}
                  className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  title="Edit"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleDelete(env.id)}
                  className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {environments.length === 0 && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-12 text-center">
          <Globe className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No Environments Yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Create your first environment to get started
          </p>
        </div>
      )}
    </div>
  );
}
