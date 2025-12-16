import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Settings, Package, Server } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { api } from '../utils/api';
import { useApp } from '../contexts/AppContext';

export default function ApplicationsPage() {
  const { selectedTenant } = useApp();
  const [applications, setApplications] = useState([]);
  const [systems, setSystems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingApplication, setEditingApplication] = useState(null);
  const [form, setForm] = useState({ system_id: '', name: '', description: '' });

  useEffect(() => {
    fetchApplications();
    fetchSystems();
  }, [selectedTenant]);

  const fetchApplications = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedTenant) params.append('tenant_id', selectedTenant);
    const data = await api.get(`/applications?${params}`);
    setApplications(data);
    setLoading(false);
  };

  const fetchSystems = async () => {
    const params = new URLSearchParams();
    if (selectedTenant) params.append('tenant_id', selectedTenant);
    const data = await api.get(`/systems?${params}`);
    setSystems(data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingApplication) {
      await api.put(`/applications/${editingApplication.id}`, form);
    } else {
      await api.post('/applications', form);
    }
    setShowForm(false);
    setEditingApplication(null);
    setForm({ system_id: '', name: '', description: '' });
    fetchApplications();
  };

  const handleEdit = (application) => {
    setEditingApplication(application);
    setForm({
      system_id: application.system_id || '',
      name: application.name || '',
      description: application.description || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this application?')) {
      await api.delete(`/applications/${id}`);
      fetchApplications();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Applications</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your applications across systems</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingApplication(null); setForm({ system_id: '', name: '', description: '' }); }}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Application
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-700 transform transition-all">
            <h2 className="text-xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {editingApplication ? 'Edit Application' : 'Add New Application'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">System</label>
                <select
                  value={form.system_id}
                  onChange={(e) => setForm({ ...form, system_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all hover:border-blue-400 dark:hover:border-blue-500 shadow-sm"
                  required
                >
                  <option value="">Select a system</option>
                  {systems.map(system => (
                    <option key={system.id} value={system.id}>
                      {system.name} {system.tenant_name ? `(${system.tenant_name})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all hover:border-blue-400 dark:hover:border-blue-500 shadow-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all hover:border-blue-400 dark:hover:border-blue-500 shadow-sm"
                  rows={3}
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-medium transition-all hover:scale-105 active:scale-95 shadow-md"
                >
                  {editingApplication ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingApplication(null); }}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-xl font-medium transition-all hover:scale-105 active:scale-95"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Applications Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading applications...</p>
        </div>
      ) : applications.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700">
          <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No applications yet</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">Get started by creating your first application</p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Application
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {applications.map((app) => (
            <div
              key={app.id}
              className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all hover:scale-105 group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-orange-500 to-pink-500 rounded-xl shadow-md">
                    <Package className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white">{app.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {app.created_at && formatDistanceToNow(new Date(app.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(app)}
                    className="p-2 text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                    title="Edit"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(app.id)}
                    className="p-2 text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {app.description && (
                <p className="text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">{app.description}</p>
              )}

              <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 text-sm">
                  <Server className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-gray-700 dark:text-gray-300">System:</span>
                  <span className="text-gray-600 dark:text-gray-400">{app.system_name || 'Unknown'}</span>
                </div>
                {app.tenant_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-md text-xs font-medium">
                      {app.tenant_name}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
