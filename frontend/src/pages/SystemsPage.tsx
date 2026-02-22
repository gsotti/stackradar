import React, { useState, useEffect, FormEvent } from 'react';
import { Plus, Trash2, Settings, Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../utils/api';
import { useApp } from '../contexts/AppContext';
import { System, Environment } from '../types';
import ConfirmDialog from '../components/common/ConfirmDialog';

interface SystemWithDetails extends System {
  environment_name?: string;
  site_name?: string;
  tenant_name?: string;
}

export default function SystemsPage() {
  const { t } = useTranslation('sites');
  const { t: tc } = useTranslation('common');
  const { selectedTenant } = useApp();
  const [systems, setSystems] = useState<SystemWithDetails[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSystem, setEditingSystem] = useState<SystemWithDetails | null>(null);
  const [form, setForm] = useState({ environment_id: '', name: '', description: '' });
  const [deleteTarget, setDeleteTarget] = useState<SystemWithDetails | null>(null);

  useEffect(() => {
    fetchSystems();
    fetchEnvironments();
  }, [selectedTenant]);

  const fetchSystems = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedTenant) params.append('tenant_id', selectedTenant);
    try {
      const data = await api.get<SystemWithDetails[]>(`/systems?${params}`);
      setSystems(data);
    } catch (error) {
      console.error('Failed to fetch systems', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEnvironments = async () => {
    const params = new URLSearchParams();
    if (selectedTenant) params.append('tenant_id', selectedTenant);
    try {
      const data = await api.get<Environment[]>(`/environments?${params}`);
      setEnvironments(data);
    } catch (error) {
      console.error('Failed to fetch environments', error);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editingSystem) {
        await api.put(`/systems/${editingSystem.id}`, form);
      } else {
        await api.post('/systems', form);
      }
      setShowForm(false);
      setEditingSystem(null);
      setForm({ environment_id: '', name: '', description: '' });
      fetchSystems();
    } catch (error) {
      console.error('Failed to save system', error);
    }
  };

  const handleEdit = (system: SystemWithDetails) => {
    setEditingSystem(system);
    setForm({
      environment_id: String(system.environment_id || ''),
      name: system.name || '',
      description: system.description || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/systems/${id}`);
      fetchSystems();
    } catch (error) {
      console.error('Failed to delete system', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading-2">{t('page.title')}</h1>
          <p className="text-body-secondary mt-2">Manage your systems across environments</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingSystem(null); setForm({ environment_id: '', name: '', description: '' }); }}
          className="button-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add System
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="card w-full max-w-md">
            <h2 className="text-heading-3 mb-6">
              {editingSystem ? 'Edit System' : 'Add New System'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-label mb-2">Environment</label>
                <select
                  value={form.environment_id}
                  onChange={(e) => setForm({ ...form, environment_id: e.target.value })}
                  className="input-base w-full"
                  required
                >
                  <option value="">Select an environment</option>
                  {environments.map(env => (
                    <option key={env.id} value={env.id}>
                      {env.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-label mb-2">Identifier (Name)</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input-base w-full"
                  placeholder="api-gateway"
                  required
                />
              </div>
              <div>
                <label className="block text-label mb-2">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="input-base w-full"
                  placeholder="Main entry point for API requests"
                  rows={3}
                />
              </div>
              <div className="modal-actions">
                <button
                  type="submit"
                  className="button-primary button-center"
                >
                  {editingSystem ? tc('actions.save') : 'Create System'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="button-secondary button-center"
                >
                  {tc('actions.cancel')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {systems.map((system) => (
            <div key={system.id} className="card-hover group">
              <div className="flex justify-between items-start mb-3">
                <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg group-hover:scale-110 transition-transform">
                  <Package className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(system)}
                    className="p-1.5 text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(system)}
                    className="p-1.5 text-neutral-400 hover:text-accent-danger transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <h3 className="text-heading-4 mb-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate text-neutral-900 dark:text-white">
                {system.name}
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4 min-h-[1.5rem] line-clamp-1">
                {system.description || tc('meta.no_description')}
              </p>
              <div className="pt-3 border-t border-neutral-200 dark:border-neutral-700/50 flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-label text-xs">Env:</span>
                  <span className="text-body text-sm truncate">{system.environment_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-label text-xs">Site:</span>
                  <span className="text-body text-sm truncate">{system.site_name}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && systems.length === 0 && (
        <div className="text-center py-20 surface rounded-2xl border-2 border-dashed border-neutral-300 dark:border-neutral-700">
          <Package className="w-16 h-16 text-neutral-300 dark:text-neutral-600 mx-auto mb-4 opacity-50" />
          <h3 className="text-heading-4 mb-2">No systems found</h3>
          <p className="text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto mb-8">
            Create your first system to start collecting logs and monitoring health.
          </p>
          <button
            onClick={() => { setShowForm(true); setEditingSystem(null); setForm({ environment_id: '', name: '', description: '' }); }}
            className="button-primary inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Create First System
          </button>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete system?"
        description={tc('confirm_dialog.cannot_be_undone')}
        confirmLabel={tc('actions.delete')}
        variant="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          handleDelete(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
