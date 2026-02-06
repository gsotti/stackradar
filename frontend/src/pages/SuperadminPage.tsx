import React, { useState, useEffect } from 'react';
import { Shield, Settings, Building2, Users, RefreshCw, Plus, Pencil, Trash2, X } from 'lucide-react';
import OrgAdminList from '../components/superadmin/OrgAdminList';
import { api } from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';
import { Organization } from '../types';

type TabType = 'organizations' | 'org-admins' | 'settings';

interface OrganizationFormData {
  name: string;
  description: string;
}

export default function SuperadminPage() {
  const [activeTab, setActiveTab] = useState<TabType>('organizations');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [formData, setFormData] = useState<OrganizationFormData>({ name: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const { showSuccess, showError } = useNotification();

  useEffect(() => {
    if (activeTab === 'organizations') {
      loadOrganizations();
    }
  }, [activeTab]);

  const loadOrganizations = async () => {
    setLoading(true);
    try {
      const data = await api.get<Organization[]>('/organizations');
      setOrganizations(data);
    } catch (error: any) {
      showError(error.message || 'Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/organizations', formData);
      showSuccess('Organization created successfully');
      setShowCreateModal(false);
      setFormData({ name: '', description: '' });
      loadOrganizations();
    } catch (error: any) {
      showError(error.message || 'Failed to create organization');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrg) return;

    setSubmitting(true);
    try {
      await api.put(`/organizations/${editingOrg.id}`, formData);
      showSuccess('Organization updated successfully');
      setEditingOrg(null);
      setFormData({ name: '', description: '' });
      loadOrganizations();
    } catch (error: any) {
      showError(error.message || 'Failed to update organization');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOrganization = async (org: Organization) => {
    if (!confirm(`Are you sure you want to delete "${org.name}"? This will affect ${org.user_count || 0} users and ${org.tenant_count || 0} tenants.`)) {
      return;
    }

    try {
      await api.delete(`/organizations/${org.id}`);
      showSuccess('Organization deleted successfully');
      loadOrganizations();
    } catch (error: any) {
      showError(error.message || 'Failed to delete organization');
    }
  };

  const openEditModal = (org: Organization) => {
    setEditingOrg(org);
    setFormData({
      name: org.name,
      description: org.description || ''
    });
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setEditingOrg(null);
    setFormData({ name: '', description: '' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Superadmin Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage organizations, administrators and system settings</p>
        </div>

        {activeTab === 'organizations' && (
          <div className="flex gap-2">
            <button
              onClick={loadOrganizations}
              className="p-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 font-semibold"
            >
              <Plus className="w-5 h-5" />
              Create Organization
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800/50 p-1 rounded-2xl w-fit border border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('organizations')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'organizations'
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm border border-gray-200 dark:border-gray-600'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Organizations
        </button>
        <button
          onClick={() => setActiveTab('org-admins')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'org-admins'
              ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm border border-gray-200 dark:border-gray-600'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Shield className="w-4 h-4" />
          Organization Admins
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'settings'
              ? 'bg-white dark:bg-gray-700 text-green-600 dark:text-green-400 shadow-sm border border-gray-200 dark:border-gray-600'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Settings className="w-4 h-4" />
          System Settings
        </button>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'organizations' && (
          <div>
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-10 h-10 animate-spin text-blue-500" />
              </div>
            ) : organizations.length === 0 ? (
              <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">No Organizations</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-6">
                  Get started by creating your first organization.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all font-semibold"
                >
                  <Plus className="w-5 h-5" />
                  Create Organization
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {organizations.map((org) => (
                  <div
                    key={org.id}
                    className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                          <Building2 className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                            {org.name}
                          </h3>
                        </div>
                      </div>
                    </div>

                    {org.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                        {org.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 mb-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span className="text-gray-600 dark:text-gray-400">
                          {org.user_count || 0} users
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        <span className="text-gray-600 dark:text-gray-400">
                          {org.tenant_count || 0} tenants
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                      Created {new Date(org.created_at).toLocaleDateString()}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditModal(org)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all font-medium text-sm"
                      >
                        <Pencil className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteOrganization(org)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-200 dark:hover:bg-red-900/50 transition-all font-medium text-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'org-admins' && <OrgAdminList />}

        {activeTab === 'settings' && (
          <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
            <Settings className="w-16 h-16 text-gray-300 mx-auto mb-4 opacity-50" />
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">System Settings</h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
              System configuration and settings will be available here.
            </p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingOrg) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingOrg ? 'Edit Organization' : 'Create Organization'}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={editingOrg ? handleUpdateOrganization : handleCreateOrganization} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-white transition-all"
                  placeholder="Enter organization name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-white transition-all resize-none"
                  placeholder="Enter description (optional)"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all font-medium"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : editingOrg ? 'Save Changes' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
