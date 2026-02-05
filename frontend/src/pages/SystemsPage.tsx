import React, { useState, useEffect, FormEvent } from 'react';
import { Plus, Trash2, Settings, Package } from 'lucide-react';
import { api } from '../utils/api';
import { useApp } from '../contexts/AppContext';
import { System, Environment } from '../types';

interface SystemWithDetails extends System {
  environment_name?: string;
  site_name?: string;
  tenant_name?: string;
}

export default function SystemsPage() {
  const { selectedTenant } = useApp();
  const [systems, setSystems] = useState<SystemWithDetails[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSystem, setEditingSystem] = useState<SystemWithDetails | null>(null);
  const [form, setForm] = useState({ environment_id: '', name: '', description: '' });

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
    if (confirm('Are you sure you want to delete this system?')) {
      try {
        await api.delete(`/systems/${id}`);
        fetchSystems();
      } catch (error) {
        console.error('Failed to delete system', error);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Systems</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your systems across environments</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingSystem(null); setForm({ environment_id: '', name: '', description: '' }); }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 font-medium"
        >
          <Plus className="w-4 h-4" />
          Add System
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-700 transform transition-all">
            <h2 className="text-xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {editingSystem ? 'Edit System' : 'Add New System'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Environment</label>
                <select
                  value={form.environment_id}
                  onChange={(e) => setForm({ ...form, environment_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all hover:border-blue-400 dark:hover:border-blue-500 shadow-sm"
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Identifier (Name)</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all hover:border-blue-400 dark:hover:border-blue-500 shadow-sm"
                  placeholder="api-gateway"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all hover:border-blue-400 dark:hover:border-blue-500 shadow-sm"
                  placeholder="Main entry point for API requests"
                  rows={3}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-2 rounded-xl transition-all shadow-lg hover:shadow-xl active:scale-95"
                >
                  {editingSystem ? 'Save Changes' : 'Create System'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold py-2 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all border border-gray-200 dark:border-gray-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {systems.map((system) => (
            <div key={system.id} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-lg transition-all duration-300 p-4 group">
              <div className="flex justify-between items-start mb-3">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg group-hover:scale-110 transition-transform">
                  <Package className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(system)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(system.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                {system.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 min-h-[1.5rem] line-clamp-1">
                {system.description || 'No description provided'}
              </p>
              <div className="pt-3 border-t border-gray-100 dark:border-gray-700 flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Env:</span>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 truncate">{system.environment_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Site:</span>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 truncate">{system.site_name}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && systems.length === 0 && (
        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No systems found</h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-8">
            Create your first system to start collecting logs and monitoring health.
          </p>
          <button
            onClick={() => { setShowForm(true); setEditingSystem(null); setForm({ environment_id: '', name: '', description: '' }); }}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl hover:scale-105"
          >
            <Plus className="w-5 h-5" />
            Create First System
          </button>
        </div>
      )}
    </div>
  );
}
