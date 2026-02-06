import React, { useState, useEffect, FormEvent } from 'react';
import { Globe, Plus, Edit2, Trash2 } from 'lucide-react';
import { useNotification } from '../contexts/NotificationContext';
import { api } from '../utils/api';
import { Environment, Site } from '../types';

interface EnvironmentWithDetails extends Environment {
  site_name?: string;
  tenant_name?: string;
}

export default function EnvironmentsPage() {
  const [environments, setEnvironments] = useState<EnvironmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEnv, setEditingEnv] = useState<EnvironmentWithDetails | null>(null);
  const [form, setForm] = useState({ site_id: '', name: '', display_name: '' });
  const [sites, setSites] = useState<Site[]>([]);
  const { showError, showSuccess } = useNotification();

  useEffect(() => {
    loadEnvironments();
    loadSites();
  }, []);

  const loadSites = async () => {
    try {
      const data = await api.get<Site[]>('/sites');
      setSites(data);
    } catch (error: any) {
      showError(error.message || 'Failed to load sites');
    }
  };

  const loadEnvironments = async () => {
    try {
      setLoading(true);
      const data = await api.get<EnvironmentWithDetails[]>('/environments');
      setEnvironments(data);
    } catch (error: any) {
      showError(error.message || 'Failed to load environments');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
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
    } catch (error: any) {
      showError(error.message || 'Failed to save environment');
    }
  };

  const handleEdit = (env: EnvironmentWithDetails) => {
    setEditingEnv(env);
    setForm({ site_id: String(env.site_id), name: env.name, display_name: env.display_name || '' });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this environment?')) return;
    try {
      await api.delete(`/environments/${id}`);
      showSuccess('Environment deleted successfully');
      loadEnvironments();
    } catch (error: any) {
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Environments</h1>
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-700 transform transition-all">
            <h2 className="text-xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {editingEnv ? 'Edit Environment' : 'Create Environment'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingEnv && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Site</label>
                  <select
                    value={form.site_id}
                    onChange={(e) => setForm({ ...form, site_id: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    required
                  >
                    <option value="">Select a site</option>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>{site.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Identifier (Name)</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="prod, staging, dev"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Name (Optional)</label>
                <input
                  type="text"
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Production, Staging Cluster"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-2 rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95"
                >
                  {editingEnv ? 'Save Changes' : 'Create Environment'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingEnv(null);
                  }}
                  className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold py-2 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all border border-gray-200 dark:border-gray-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {environments.map((env) => (
          <div key={env.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleEdit(env)}
                  className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(env.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                {env.display_name || env.name}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">ID: {env.name}</p>
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-400 uppercase">Site:</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-medium truncate">{env.site_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-400 uppercase">Tenant:</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-medium truncate">{env.tenant_name}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {environments.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
          <Globe className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">No environments found. Create one to get started.</p>
        </div>
      )}
    </div>
  );
}
