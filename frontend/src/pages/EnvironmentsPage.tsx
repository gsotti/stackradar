import React, { useState, useEffect, FormEvent } from 'react';
import { Globe, Plus, Edit2, Trash2 } from 'lucide-react';
import { useNotification } from '../contexts/NotificationContext';
import { useApp } from '../contexts/AppContext';
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
  const { selectedTenant } = useApp();

  useEffect(() => {
    loadEnvironments();
    loadSites();
  }, [selectedTenant]);

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
      const params = new URLSearchParams();
      if (selectedTenant) params.append('tenant_id', selectedTenant);
      const data = await api.get<EnvironmentWithDetails[]>(`/environments?${params}`);
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
        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-heading-2">Environments</h1>
          <p className="text-body-secondary mt-2">Manage environment configurations for your sites</p>
        </div>
        <button
          onClick={() => {
            setEditingEnv(null);
            setForm({ site_id: '', name: '', display_name: '' });
            setShowForm(true);
          }}
          className="button-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Environment
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="card w-full max-w-md">
            <h2 className="text-heading-3 mb-6">
              {editingEnv ? 'Edit Environment' : 'Create Environment'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!editingEnv && (
                <div>
                  <label className="block text-label mb-2">Site</label>
                  <select
                    value={form.site_id}
                    onChange={(e) => setForm({ ...form, site_id: e.target.value })}
                    className="input-base w-full"
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
                <label className="block text-label mb-2">Identifier (Name)</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input-base w-full"
                  placeholder="prod, staging, dev"
                  required
                />
              </div>
              <div>
                <label className="block text-label mb-2">Display Name (Optional)</label>
                <input
                  type="text"
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  className="input-base w-full"
                  placeholder="Production, Staging Cluster"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="button-primary flex-1"
                >
                  {editingEnv ? 'Save Changes' : 'Create Environment'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingEnv(null);
                  }}
                  className="button-secondary flex-1"
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
          <div key={env.id} className="card-hover group">
            <div className="flex justify-between items-start mb-3">
              <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg group-hover:scale-110 transition-transform">
                <Globe className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleEdit(env)}
                  className="p-1.5 text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(env.id)}
                  className="p-1.5 text-neutral-400 hover:text-accent-danger transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div>
              <h3 className="text-heading-4 truncate text-neutral-900 dark:text-white">
                {env.display_name || env.name}
              </h3>
              <p className="text-body-secondary text-xs">ID: {env.name}</p>
              <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-700/50 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-label text-xs">Site:</span>
                  <span className="text-body text-sm truncate">{env.site_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-label text-xs">Tenant:</span>
                  <span className="text-body text-sm truncate">{env.tenant_name}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {environments.length === 0 && (
        <div className="text-center py-12 surface rounded-2xl border-2 border-dashed border-neutral-300 dark:border-neutral-700">
          <Globe className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mx-auto mb-4" />
          <p className="text-neutral-500 dark:text-neutral-400">No environments found. Create one to get started.</p>
        </div>
      )}
    </div>
  );
}
