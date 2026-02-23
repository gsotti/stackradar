import React, { useState, useEffect } from 'react';
import { Shield, Settings, Building2, Users, RefreshCw, Plus, Pencil, Trash2, X, ArrowLeft, UserCog, User as UserIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';
import { Organization, User } from '../types';
import { getGravatarUrl } from '../utils/md5';
import { formatInLocalTime } from '../utils/dateUtils';
import ConfirmDialog from '../components/common/ConfirmDialog';

type TabType = 'organizations' | 'settings' | 'profile';

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
  const { t, i18n } = useTranslation('superadmin');
  const { t: tc } = useTranslation('common');
  const [activeTab, setActiveTab] = useState<TabType>('organizations');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [formData, setFormData] = useState<OrganizationFormData>({ name: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [deleteOrgTarget, setDeleteOrgTarget] = useState<Organization | null>(null);
  const { showSuccess, showError } = useNotification();

  // System settings state
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [registryOwner, setRegistryOwner] = useState('gsotti');
  const [appUrl, setAppUrl] = useState('');

  // Profile state
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileEmail, setProfileEmail] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profilePassword, setProfilePassword] = useState('');

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
    } else if (activeTab === 'profile') {
      loadProfile();
    }
  }, [activeTab]);

  const loadOrganizations = async () => {
    setLoading(true);
    try {
      const data = await api.get<Organization[]>('/organizations');
      setOrganizations(data);
    } catch (error: any) {
      showError(error.message || t('messages.load_orgs_failed'));
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
      showError(error.message || t('messages.load_settings_failed'));
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaving(true);
    try {
      await api.put('/superadmin/settings', { registry_owner: registryOwner, app_url: appUrl });
      showSuccess(t('messages.settings_saved'));
    } catch (error: any) {
      showError(error.message || t('messages.save_settings_failed'));
    } finally {
      setSettingsSaving(false);
    }
  };

  const loadProfile = async () => {
    setProfileLoading(true);
    try {
      const data = await api.get<User>('/superadmin/profile');
      setProfileEmail(data.email);
      setProfileName(data.name || '');
      setProfilePassword(''); // Always empty for security
    } catch (error: any) {
      showError(error.message || t('profile.profile_update_failed'));
    } finally {
      setProfileLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      const updateData: any = {
        email: profileEmail,
        name: profileName || null
      };
      // Only include password if it's not empty
      if (profilePassword.trim()) {
        updateData.password = profilePassword;
      }
      await api.put('/superadmin/profile', updateData);
      showSuccess(t('profile.profile_updated'));
      setProfilePassword(''); // Clear password field after successful update
    } catch (error: any) {
      showError(error.message || t('profile.profile_update_failed'));
    } finally {
      setProfileSaving(false);
    }
  };

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/organizations', formData);
      showSuccess(t('messages.org_created'));
      setShowCreateModal(false);
      setFormData({ name: '', description: '' });
      loadOrganizations();
    } catch (error: any) {
      showError(error.message || t('messages.create_org_failed'));
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
      showSuccess(t('messages.org_updated'));
      setEditingOrg(null);
      setFormData({ name: '', description: '' });
      loadOrganizations();
    } catch (error: any) {
      showError(error.message || t('messages.update_org_failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOrganization = async (org: Organization) => {
     try {
       await api.delete(`/organizations/${org.id}`);
       showSuccess(t('messages.org_deleted'));
       loadOrganizations();
     } catch (error: any) {
       showError(error.message || t('messages.delete_org_failed'));
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
      showError(error.message || t('messages.load_users_failed'));
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
     try {
       await api.post(`/organizations/${viewingOrg.id}/users/${user.id}/set-org-admin`, {});
       showSuccess(t('messages.admin_promoted'));
       await loadOrgUsers(viewingOrg.id);
     } catch (error: any) {
       showError(error.message || t('messages.promote_failed'));
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
      showSuccess(t('messages.user_created'));
      setShowCreateUserModal(false);
      setUserFormData({ email: '', name: '', password: '' });
      await loadOrgUsers(viewingOrg.id);
    } catch (error: any) {
      showError(error.message || t('messages.create_user_failed'));
    }
  };

  const handleDemoteFromAdmin = async (user: OrgUser) => {
     if (!viewingOrg) return;
     try {
       await api.post(`/organizations/${viewingOrg.id}/users/${user.id}/remove-org-admin`, {});
       showSuccess(t('messages.admin_removed'));
       await loadOrgUsers(viewingOrg.id);
     } catch (error: any) {
       showError(error.message || t('messages.demote_failed'));
     }
   };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-heading-2">{t('page.title')}</h1>
          <p className="text-body-secondary mt-2">{t('page.subtitle')}</p>
        </div>

        {activeTab === 'organizations' && (
          <div className="flex gap-2">
            <button
              onClick={loadOrganizations}
              className="p-2 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-all"
              title={t('actions.refresh')}
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="button-primary flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {t('actions.create_org')}
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
            {t('tabs.organizations')}
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
            {t('tabs.system_settings')}
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all ${
              activeTab === 'profile'
                ? 'bg-white dark:bg-neutral-700 text-purple-600 dark:text-purple-400 shadow-sm border border-neutral-200 dark:border-neutral-600'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-300'
            }`}
          >
            <UserIcon className="w-4 h-4" />
            {t('tabs.profile')}
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
              {t('actions.back_to_orgs')}
            </button>

            {/* Organization Header */}
            <div className="card">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <Building2 className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">{viewingOrg.name}</h2>
                    {viewingOrg.description && (
                      <p className="text-neutral-600 dark:text-neutral-400 mt-1">{viewingOrg.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-2 text-sm text-neutral-500">
                        <Users className="w-4 h-4" />
                        {t('orgs.users_label', { count: Number(viewingOrg.user_count) || 0 })}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-neutral-500">
                        <Building2 className="w-4 h-4" />
                        {t(`orgs.tenants_label_${viewingOrg.tenant_count === 1 ? 'one' : 'other'}`, { count: viewingOrg.tenant_count || 0 })}
                      </div>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => openEditModal(viewingOrg)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all font-medium"
                >
                  <Pencil className="w-4 h-4" />
                  {t('actions.edit')}
                </button>
              </div>
            </div>

            {/* Users List */}
            <div className="card">
              <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-neutral-900 dark:text-white">{t('org_users.title')}</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => loadOrgUsers(viewingOrg.id)}
                      className="p-2 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-xl transition-all"
                    >
                      <RefreshCw className={`w-5 h-5 ${loadingUsers ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={() => {
                        setUserFormData({ email: '', name: '', password: '' });
                        setShowCreateUserModal(true);
                      }}
                      className="button-primary flex items-center gap-2 text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      {t('org_users.create_user')}
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
                    <Users className="w-12 h-12 text-neutral-300 dark:text-neutral-600 mx-auto mb-3" />
                    <p className="text-neutral-500 dark:text-neutral-400">{t('org_users.empty')}</p>
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
                        className="flex items-center gap-4 p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-700"
                      >
                        {getGravatarUrl(user.email) ? (
                          <img
                            src={getGravatarUrl(user.email, 48)!}
                            alt={user.name || user.email}
                            className="w-12 h-12 rounded-full ring-2 ring-neutral-200 dark:ring-neutral-700"
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
                            <h4 className="font-semibold text-neutral-900 dark:text-white">
                              {user.name || t('org_users.unnamed')}
                            </h4>
                            {user.global_role === 'org_admin' && (
                              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 flex items-center gap-1">
                                <Shield className="w-3 h-3" />
                                {t('org_users.role_org_admin')}
                              </span>
                            )}
                            {user.global_role === 'superadmin' && (
                              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                {tc('roles.superadmin')}
                              </span>
                            )}
                            {user.is_active ? (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                {t('org_users.status_active')}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                                {t('org_users.status_inactive')}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-neutral-500 dark:text-neutral-400">{user.email}</p>
                        </div>

                        {user.global_role !== 'superadmin' && (
                          <div className="flex items-center gap-2">
                            {user.global_role === 'org_admin' ? (
                              <button
                                onClick={() => handleDemoteFromAdmin(user)}
                                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-lg transition-all"
                              >
                                <UserCog className="w-4 h-4" />
                                {t('org_users.remove_admin')}
                              </button>
                            ) : (
                              <button
                                onClick={() => handlePromoteToAdmin(user)}
                                className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition-all"
                              >
                                <Shield className="w-4 h-4" />
                                {t('org_users.make_admin')}
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
                <div className="card max-w-md w-full">
                  <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
                    <h2 className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                      {t('create_user_modal.title')}
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
                      <label className="text-label mb-2">
                        {t('create_user_modal.email_label')}
                      </label>
                      <input
                        type="email"
                        required
                        value={userFormData.email}
                        onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                        className="input-base w-full"
                        placeholder={t('create_user_modal.email_placeholder')}
                      />
                    </div>

                    <div>
                      <label className="text-label mb-2">
                        {t('create_user_modal.name_label')}
                      </label>
                      <input
                        type="text"
                        value={userFormData.name}
                        onChange={(e) => setUserFormData({ ...userFormData, name: e.target.value })}
                        className="input-base w-full"
                        placeholder={t('create_user_modal.name_placeholder')}
                      />
                    </div>

                    <div>
                      <label className="text-label mb-2">
                        {t('create_user_modal.password_label')}
                      </label>
                      <input
                        type="password"
                        required
                        value={userFormData.password}
                        onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                        className="input-base w-full"
                        placeholder={t('create_user_modal.password_placeholder')}
                      />
                    </div>

                    <div className="modal-actions">
                      <button
                        type="button"
                        onClick={() => setShowCreateUserModal(false)}
                        className="button-secondary button-center"
                      >
                        {t('create_user_modal.cancel')}
                      </button>
                      <button
                        type="submit"
                        className="button-primary button-center"
                      >
                        {t('create_user_modal.submit')}
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
              <div className="card text-center py-20 border-2 border-dashed">
                <Building2 className="w-16 h-16 text-neutral-300 dark:text-neutral-600 mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-bold text-neutral-900 dark:text-white">{t('orgs.empty_title')}</h3>
                <p className="text-neutral-500 dark:text-neutral-400 max-w-sm mx-auto mb-6">
                  {t('orgs.empty_description')}
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="button-primary inline-flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  {t('actions.create_org')}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {organizations.map((org) => (
                  <div
                    key={org.id}
                    className="card-hover"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                          <Building2 className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
                            {org.name}
                          </h3>
                        </div>
                      </div>
                    </div>

                    {org.description && (
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4 line-clamp-2">
                        {org.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 mb-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <span className="text-neutral-600 dark:text-neutral-400">
                          {t('orgs.users_label', { count: Number(org.user_count) || 0 })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        <span className="text-neutral-600 dark:text-neutral-400">
                          {t(`orgs.tenants_label_${org.tenant_count === 1 ? 'one' : 'other'}`, { count: org.tenant_count || 0 })}
                        </span>
                      </div>
                    </div>

                    <div className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
                      {t('orgs.created_label', { date: formatInLocalTime(org.created_at, 'dd.MM.yyyy') })}
                    </div>

                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleViewOrganization(org)}
                        className="button-primary flex items-center justify-center gap-2 text-sm"
                      >
                        <Users className="w-4 h-4" />
                        {t('actions.manage_users')}
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(org)}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all font-medium text-sm"
                        >
                          <Pencil className="w-4 h-4" />
                          {t('actions.edit')}
                        </button>
                        <button
                          onClick={() => setDeleteOrgTarget(org)}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-200 dark:hover:bg-red-900/50 transition-all font-medium text-sm"
                        >
                          <Trash2 className="w-4 h-4" />
                          {t('actions.delete')}
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
              <div className="card">
                <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-white">{t('system_settings.title')}</h2>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                    {t('system_settings.description')}
                  </p>
                </div>

                <form onSubmit={handleSaveSettings} className="p-6 space-y-6">
                  {/* Container Registry Section */}
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-4">
                      {t('system_settings.container_registry')}
                    </h3>

                    <div>
                      <label className="text-label mb-2">
                        {t('system_settings.registry_owner_label')}
                      </label>
                      <input
                        type="text"
                        value={registryOwner}
                        onChange={(e) => setRegistryOwner(e.target.value)}
                        className="input-base w-full"
                        placeholder="gsotti"
                        required
                      />
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                        {t('system_settings.registry_help')}{' '}
                        <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-blue-600 dark:text-blue-400 font-mono">
                          ghcr.io/{registryOwner || '<owner>'}/stackradar
                        </code>
                      </p>
                    </div>
                  </div>

                  {/* Application Section */}
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-4">
                      {t('system_settings.application')}
                    </h3>

                    <div>
                      <label className="text-label mb-2">
                        {t('system_settings.app_url_label')}
                      </label>
                      <input
                        type="url"
                        value={appUrl}
                        onChange={(e) => setAppUrl(e.target.value)}
                        className="input-base w-full"
                        placeholder="https://stackradar.example.com"
                      />
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                        {t('system_settings.app_url_help')}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={settingsSaving}
                      className="button-primary flex items-center gap-2"
                    >
                      {settingsSaving ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          {tc('actions.saving')}
                        </>
                      ) : (
                        <>
                          <Settings className="w-4 h-4" />
                          {tc('actions.save')}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="max-w-2xl">
            {profileLoading ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-10 h-10 animate-spin text-blue-500" />
              </div>
            ) : (
              <div className="card">
                <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
                  <h2 className="text-xl font-bold text-neutral-900 dark:text-white">{t('profile.title')}</h2>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                    {t('profile.description')}
                  </p>
                </div>

                <form onSubmit={handleUpdateProfile} className="p-6 space-y-6">
                  {/* Personal Information Section */}
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-4">
                      {t('profile.personal_info')}
                    </h3>

                    <div className="space-y-4">
                      <div>
                        <label className="text-label mb-2">
                          {t('profile.email_label')}
                        </label>
                        <input
                          type="email"
                          value={profileEmail}
                          onChange={(e) => setProfileEmail(e.target.value)}
                          className="input-base w-full"
                          placeholder={t('profile.email_placeholder')}
                          required
                        />
                      </div>

                      <div>
                        <label className="text-label mb-2">
                          {t('profile.name_label')}
                        </label>
                        <input
                          type="text"
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                          className="input-base w-full"
                          placeholder={t('profile.name_placeholder')}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Security Section */}
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider mb-4">
                      {t('profile.security')}
                    </h3>

                    <div>
                      <label className="text-label mb-2">
                        {t('profile.password_label')}
                      </label>
                      <input
                        type="password"
                        value={profilePassword}
                        onChange={(e) => setProfilePassword(e.target.value)}
                        className="input-base w-full"
                        placeholder={t('profile.password_placeholder')}
                      />
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                        {t('profile.password_help')}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={profileSaving}
                      className="button-primary flex items-center gap-2"
                    >
                      {profileSaving ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          {tc('actions.saving')}
                        </>
                      ) : (
                        <>
                          <UserIcon className="w-4 h-4" />
                          {t('profile.update_profile')}
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
          <div className="card max-w-lg w-full">
            <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                {editingOrg ? t('org_form.title_edit') : t('org_form.title_create')}
              </h2>
              <button
                onClick={closeModal}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={editingOrg ? handleUpdateOrganization : handleCreateOrganization} className="p-6 space-y-4">
              <div>
                <label className="text-label mb-2">
                  {t('org_form.name_label')}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-base w-full"
                  placeholder={t('org_form.name_placeholder')}
                  required
                />
              </div>

              <div>
                <label className="text-label mb-2">
                  {t('org_form.description_label')}
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-base w-full resize-none"
                  placeholder={t('org_form.description_placeholder')}
                  rows={3}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={closeModal}
                  className="button-secondary button-center"
                  disabled={submitting}
                >
                  {t('org_form.cancel')}
                </button>
                <button
                  type="submit"
                  className="button-primary button-center"
                  disabled={submitting}
                >
                  {submitting ? tc('actions.saving') : editingOrg ? tc('actions.save') : t('org_form.submit_create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteOrgTarget}
        title={t('confirm.delete_org_title')}
        description={deleteOrgTarget ? t('confirm.delete_org_description', { name: deleteOrgTarget.name }) : undefined}
        confirmLabel={t('confirm.delete_org_label')}
        variant="danger"
        onCancel={() => setDeleteOrgTarget(null)}
        onConfirm={() => {
          if (!deleteOrgTarget) return;
          handleDeleteOrganization(deleteOrgTarget);
          setDeleteOrgTarget(null);
        }}
      />
    </div>
  );
}
