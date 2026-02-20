import React, { useState, useEffect } from 'react';
import { Shield, Settings, Building2, Users, RefreshCw, Plus, Pencil, Trash2, X, ArrowLeft, UserCog, Edit } from 'lucide-react';
import { api } from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';
import { Organization, User } from '../types';
import { getGravatarUrl } from '../utils/md5';

type TabType = 'organizations' | 'settings';

interface OrganizationFormData {
  name: string;
  description: string;
}

interface OrgUser extends User {
  is_active: boolean;
  is_approved: boolean;
  global_role: string | null;
  email_verified: boolean;
  organization_id: number;
  created_at: string;
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

  // System settings state
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [registryOwner, setRegistryOwner] = useState('gsotti');
  const [appUrl, setAppUrl] = useState('');

  // Organization detail view state
  const [viewingOrg, setViewingOrg] = useState<Organization | null>(null);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [userFormData, setUserFormData] = useState({ email: '', name: '', password: '' });

  useEffect(() => {
    if (activeTab === 'organizations') {
      loadOrganizations();
    } else if (activeTab === 'settings') {
      loadSettings();
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

  const loadSettings = async () => {
    setSettingsLoading(true);
    try {
      const data = await api.get<Record<string, string>>('/superadmin/settings');
      if (data.registry_owner !== undefined) setRegistryOwner(data.registry_owner);
      if (data.app_url !== undefined) setAppUrl(data.app_url);
    } catch (error: any) {
      showError(error.message || 'Failed to load system settings');
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaving(true);
    try {
      await api.put('/superadmin/settings', { registry_owner: registryOwner, app_url: appUrl });
      showSuccess('System settings saved successfully');
    } catch (error: any) {
      showError(error.message || 'Failed to save system settings');
    } finally {
      setSettingsSaving(false);
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

  const loadOrgUsers = async (orgId: number) => {
    setLoadingUsers(true);
    try {
      const data = await api.get<OrgUser[]>(`/organizations/${orgId}/users`);
      setOrgUsers(data);
    } catch (error: any) {
      showError(error.message || 'Failed to load organization users');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleViewOrganization = async (org: Organization) => {
    setViewingOrg(org);
    await loadOrgUsers(org.id);
  };

  const handlePromoteToAdmin = async (user: OrgUser) => {
    if (!viewingOrg) return;

    if (!confirm(`Promote ${user.name || user.email} to Organization Admin?`)) {
      return;
    }

    try {
      await api.post(`/organizations/${viewingOrg.id}/users/${user.id}/set-org-admin`);
      showSuccess('User promoted to Organization Admin');
      await loadOrgUsers(viewingOrg.id);
    } catch (error: any) {
      showError(error.message || 'Failed to promote user');
    }
  };

  const handleCreateOrgUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingOrg) return;

    try {
      await api.post(`/organizations/${viewingOrg.id}/users`, {
        email: userFormData.email,
        name: userFormData.name,
        password: userFormData.password
      });
      showSuccess('User created successfully');
      setShowCreateUserModal(false);
      setUserFormData({ email: '', name: '', password: '' });
      await loadOrgUsers(viewingOrg.id);
    } catch (error: any) {
      showError(error.message || 'Failed to create user');
    }
  };

  const handleDemoteFromAdmin = async (user: OrgUser) => {
    if (!viewingOrg) return;

    if (!confirm(`Remove Organization Admin role from ${user.name || user.email}?`)) {
      return;
    }

    try {
      await api.post(`/organizations/${viewingOrg.id}/users/${user.id}/remove-org-admin`);
      showSuccess('Organization Admin role removed');
      await loadOrgUsers(viewingOrg.id);
    } catch (error: any) {
      showError(error.message || 'Failed to remove admin role');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-heading-2">Superadmin Dashboard</h1>
          <p className="text-body-secondary mt-2">Manage organizations, administrators and system settings</p>
        </div>

        {activeTab === 'organizations' && (
          <div className="flex gap-2">
            <button
              onClick={loadOrganizations}
              className="p-2 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-all"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="button-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Organization
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      {!viewingOrg && (
        <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800/50 p-1 rounded-lg w-fit border border-neutral-200 dark:border-neutral-700">
          <button
            onClick={() => setActiveTab('organizations')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
              activeTab === 'organizations'
                ? 'bg-white dark:bg-neutral-700 text-primary-600 dark:text-primary-400 shadow-sm border border-neutral-200 dark:border-neutral-600'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-300'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Organizations
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
              activeTab === 'settings'
                ? 'bg-white dark:bg-neutral-700 text-accent-success dark:text-accent-success shadow-sm border border-neutral-200 dark:border-neutral-600'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-300'
            }`}
          >
            <Settings className="w-4 h-4" />
            System Settings
          </button>
        </div>
      )}

      {/* Tab Content */}
      <div className="mt-4">
        {/* Organization Detail View */}
        {viewingOrg ? (
          <div className="space-y-4">
            {/* Back button */}
            <button
              onClick={() => {
                setViewingOrg(null);
                setOrgUsers([]);
              }}
              className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Organizations
            </button>

            {/* Organization Header */}
            <div className="card">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <Building2 className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{viewingOrg.name}</h2>
                    {viewingOrg.description && (
                      <p className="text-gray-600 dark:text-gray-400 mt-1">{viewingOrg.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Users className="w-4 h-4" />
                        {viewingOrg.user_count || 0} users
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Building2 className="w-4 h-4" />
                        {viewingOrg.tenant_count || 0} tenants
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => openEditModal(viewingOrg)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all font-medium"
                >
                  <Pencil className="w-4 h-4" />
                  Edit Org
                </button>
              </div>
            </div>

            {/* Users List */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Organization Users</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => loadOrgUsers(viewingOrg.id)}
                      className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all"
                    >
                      <RefreshCw className={`w-5 h-5 ${loadingUsers ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={() => {
                        setUserFormData({ email: '', name: '', password: '' });
                        setShowCreateUserModal(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl shadow-lg transition-all font-medium text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Create User
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {loadingUsers ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                  </div>
                ) : orgUsers.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">No users in this organization</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orgUsers
                      .sort((a, b) => {
                        // Sort by role: superadmin, org_admin, then regular users
                        const roleOrder = { superadmin: 0, org_admin: 1, null: 2, undefined: 2 };
                        const aOrder = roleOrder[a.global_role as keyof typeof roleOrder] ?? 2;
                        const bOrder = roleOrder[b.global_role as keyof typeof roleOrder] ?? 2;
                        if (aOrder !== bOrder) return aOrder - bOrder;
                        // Then sort by name/email
                        const aName = a.name || a.email;
                        const bName = b.name || b.email;
                        return aName.localeCompare(bName);
                      })
                      .map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600"
                      >
                        {getGravatarUrl(user.email) ? (
                          <img
                            src={getGravatarUrl(user.email, 48)!}
                            alt={user.name || user.email}
                            className="w-12 h-12 rounded-full ring-2 ring-gray-200 dark:ring-gray-600"
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                            <span className="text-sm font-bold text-white">
                              {(user.name?.[0] || user.email[0]).toUpperCase()}
                            </span>
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-gray-900 dark:text-white">
                              {user.name || 'Unnamed'}
                            </h4>
                            {user.global_role === 'org_admin' && (
                              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 flex items-center gap-1">
                                <Shield className="w-3 h-3" />
                                Org Admin
                              </span>
                            )}
                            {user.global_role === 'superadmin' && (
                              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                Superadmin
                              </span>
                            )}
                            {user.is_active ? (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                Active
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                Inactive
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                        </div>

                        {user.global_role !== 'superadmin' && (
                          <div className="flex items-center gap-2">
                            {user.global_role === 'org_admin' ? (
                              <button
                                onClick={() => handleDemoteFromAdmin(user)}
                                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-lg transition-all"
                              >
                                <UserCog className="w-4 h-4" />
                                Remove Admin
                              </button>
                            ) : (
                              <button
                                onClick={() => handlePromoteToAdmin(user)}
                                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition-all"
                              >
                                <Shield className="w-4 h-4" />
                                Make Admin
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Create User Modal */}
            {showCreateUserModal && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full">
                  <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      Create User
                    </h2>
                    <button
                      onClick={() => setShowCreateUserModal(false)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <form onSubmit={handleCreateOrgUser} className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Email *
                      </label>
                      <input
                        type="email"
                        required
                        value={userFormData.email}
                        onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="user@example.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Name
                      </label>
                      <input
                        type="text"
                        value={userFormData.name}
                        onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="John Doe"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Password *
                      </label>
                      <input
                        type="password"
                        required
                        value={userFormData.password}
                        onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="Enter password"
                      />
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setShowCreateUserModal(false)}
                        className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl shadow-lg transition-all font-semibold"
                      >
                        Create User
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'organizations' && (
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

                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleViewOrganization(org)}
                        className="flex items-center justify-center gap-2 px-3 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl transition-all font-medium text-sm shadow-lg"
                      >
                        <Users className="w-4 h-4" />
                        Manage Users
                      </button>
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
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-2xl">
            {settingsLoading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-10 h-10 animate-spin text-blue-500" />
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">System Settings</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Configure global system settings for your StackRadar instance.
                  </p>
                </div>

                <form onSubmit={handleSaveSettings} className="p-6 space-y-6">
                  {/* Container Registry Section */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4">
                      Container Registry
                    </h3>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Container Registry Owner
                      </label>
                      <input
                        type="text"
                        value={registryOwner}
                        onChange={(e) => setRegistryOwner(e.target.value)}
                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-white transition-all"
                        placeholder="gsotti"
                        required
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Images will be pulled from{' '}
                        <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-blue-600 dark:text-blue-400 font-mono">
                          ghcr.io/{registryOwner || '<owner>'}/stackradar
                        </code>
                      </p>
                    </div>
                  </div>

                  {/* Application Section */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4">
                      Application
                    </h3>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        App URL
                      </label>
                      <input
                        type="url"
                        value={appUrl}
                        onChange={(e) => setAppUrl(e.target.value)}
                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-gray-900 dark:text-white transition-all"
                        placeholder="https://stackradar.example.com"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Used in invitation emails to generate the correct link. Falls back to the <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded font-mono">APP_URL</code> environment variable if left empty.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={settingsSaving}
                      className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 font-semibold disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      {settingsSaving ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Settings className="w-4 h-4" />
                          Save Settings
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
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
