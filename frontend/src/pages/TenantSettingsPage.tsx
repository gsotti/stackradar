import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Building2, RefreshCw, Trash2, Users, Settings, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import TenantForm from '../components/tenants/TenantForm';
import TenantUserList from '../components/users/TenantUserList';
import PendingInvitations from '../components/users/PendingInvitations';
import UserInviteForm from '../components/users/UserInviteForm';
import UserCreateModal from '../components/users/UserCreateModal';
import AvailableUsersList from '../components/users/AvailableUsersList';
import { Tenant, TenantUser, Invitation, TenantRoleName } from '../types';
import ConfirmDialog from '../components/common/ConfirmDialog';

type TabType = 'settings' | 'users';

export default function TenantSettingsPage() {
  const { t, i18n } = useTranslation('tenants');
  const { t: tc } = useTranslation('common');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { isOrgAdmin, canManageTenant } = useAuth();
  const { showError, showSuccess } = useNotification();

  // Derive active tab from URL path
  const activeTab: TabType = location.pathname.endsWith('/users') ? 'users' : 'settings';

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  // User management state
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [showDeleteTenantModal, setShowDeleteTenantModal] = useState(false);

  useEffect(() => {
    fetchTenant();
  }, [id]);

  // Load users when switching to users tab
  useEffect(() => {
    if (activeTab === 'users' && id) {
      loadUsersData();
    }
  }, [activeTab, id]);

  const setActiveTab = (tab: TabType) => {
    if (tab === 'users') {
      navigate(`/tenants/${id}/settings/users`);
    } else {
      navigate(`/tenants/${id}/settings`);
    }
  };

  const fetchTenant = async () => {
    setLoading(true);
    try {
      const data = await api.get<Tenant>(`/tenants/${id}`);
      setTenant(data);
    } catch (error: any) {
      showError(error.message || tc('errors.load_failed'));
    } finally {
      setLoading(false);
    }
  };

  const loadUsersData = async () => {
    if (!id) return;

    setUsersLoading(true);
    try {
      const [usersData, invitationsData] = await Promise.all([
        api.get<TenantUser[]>(`/tenants/${id}/users`),
        api.get<Invitation[]>(`/invitations?tenant_id=${id}`)
      ]);
      setUsers(usersData);
      setInvitations(invitationsData);
    } catch (error: any) {
      showError(error.message || tc('errors.load_failed'));
    } finally {
      setUsersLoading(false);
    }
  };

  const handleUpdateTenant = async (data: { name: string; description: string }) => {
    try {
      const updated = await api.put<Tenant>(`/tenants/${id}`, data);
      setTenant(updated);
      showSuccess(t('messages.updated'));
    } catch (error: any) {
      showError(error.message || tc('errors.save_failed'));
      throw error;
    }
  };

  const handleDeleteTenant = async () => {
     try {
       await api.delete(`/tenants/${id}`, { confirm: true });
       showSuccess(t('messages.deleted'));
       navigate('/tenants');
     } catch (error: any) {
       showError(error.message || tc('errors.delete_failed'));
     }
   };

  const handleInviteClose = (updated?: boolean) => {
    setShowInviteForm(false);
    if (updated) {
      loadUsersData();
    }
  };

  const handleCreateUser = async (data: { email: string; password: string; name: string; role: TenantRoleName }) => {
    await api.post(`/tenants/${id}/users`, data);
    showSuccess(t('messages.user_created'));
    loadUsersData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-6rem)]">
        <div className="text-center">
          <RefreshCw className="w-10 h-10 animate-spin text-primary-500 mx-auto mb-3" />
          <p className="text-neutral-600 dark:text-neutral-400">{t('settings.loading')}</p>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-6rem)]">
        <Building2 className="w-16 h-16 text-neutral-400 dark:text-neutral-600 mb-3" />
        <h2 className="text-heading-4 mb-2">{t('settings.not_found')}</h2>
        <Link
          to="/tenants"
          className="text-primary-600 dark:text-primary-400 hover:underline"
        >
          {t('settings.return_to_list')}
        </Link>
      </div>
    );
  }

  const canManage = canManageTenant(tenant.id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/tenants"
            className="text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-700 rounded-lg flex items-center justify-center shadow-lg">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-heading-3 text-neutral-900 dark:text-white">{tenant.name}</h1>
            <p className="text-body-secondary text-sm">{t('settings.subtitle')}</p>
          </div>
        </div>

        {/* Action buttons for Users tab */}
        {activeTab === 'users' && (
          <div className="flex gap-2">
            <button
              onClick={loadUsersData}
              className="p-2 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-all"
              title={tc('actions.refresh')}
            >
              <RefreshCw className={`w-5 h-5 ${usersLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowCreateForm(true)}
              className="button-primary flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              {t('settings.create_user')}
            </button>
            <button
              onClick={() => setShowInviteForm(true)}
              className="button-primary flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              {t('settings.invite_user')}
            </button>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('settings')}
            className={`
              flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors
              ${
                activeTab === 'settings'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300'
              }
            `}
          >
            <Settings className="w-4 h-4" />
            {t('settings.tab_settings')}
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`
              flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors
              ${
                activeTab === 'users'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:border-gray-300'
              }
            `}
          >
            <Users className="w-4 h-4" />
            {t('settings.tab_users')}
            {users.length > 0 && (
              <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-full">
                {users.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'settings' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Column - Tenant Settings Form */}
          <div className="card transition-none">
            <TenantForm
              mode="edit"
              initialData={{
                name: tenant.name,
                description: tenant.description || ''
              }}
              onSubmit={handleUpdateTenant}
              submitLabel={canManage ? tc('actions.save') : t('settings.view_only')}
            />
          </div>

          {/* Right Column - Danger Zone */}
          {isOrgAdmin() && (
            <div className="space-y-4">
              <div className="card border-l-4 border-l-accent-danger">
                <h2 className="text-lg font-semibold text-accent-danger mb-2 flex items-center gap-2">
                  <Trash2 className="w-5 h-5" />
                  {t('danger_zone.title')}
                </h2>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                  {t('danger_zone.delete_description')}
                </p>
                <button
                  onClick={() => setShowDeleteTenantModal(true)}
                  className="button-danger w-full justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {t('danger_zone.delete_button')}
                </button>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800">
                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
                  {t('settings.info_title')}
                </h3>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-blue-700 dark:text-blue-400 font-medium">{t('settings.created_label')}</dt>
                    <dd className="text-blue-900 dark:text-blue-200">
                      {new Date(tenant.created_at).toLocaleDateString(i18n.language, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-blue-700 dark:text-blue-400 font-medium">{t('settings.updated_label')}</dt>
                    <dd className="text-blue-900 dark:text-blue-200">
                      {new Date(tenant.updated_at).toLocaleDateString(i18n.language, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-blue-700 dark:text-blue-400 font-medium">{t('settings.id_label')}</dt>
                    <dd className="text-blue-900 dark:text-blue-200 font-mono">{tenant.id}</dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {usersLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-10 h-10 animate-spin text-blue-500" />
            </div>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="card-compact">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
                      <Users className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('settings.active_users_label')}</p>
                      <p className="text-2xl font-bold text-neutral-900 dark:text-white">{users.length}</p>
                    </div>
                  </div>
                </div>
                <div className="card-compact">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
                      <UserPlus className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{t('settings.pending_invitations_label')}</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{invitations.length}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pending Invitations */}
              {invitations.length > 0 && (
                <div className="card">
                  <PendingInvitations
                    tenantId={parseInt(id!, 10)}
                    invitations={invitations}
                    onUpdate={loadUsersData}
                  />
                </div>
              )}

              {/* Users List */}
              <div className="card">
                <div className="flex items-center gap-2 mb-6">
                  <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {t('settings.members_title')}
                  </h3>
                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold rounded-full">
                    {users.length}
                  </span>
                </div>
                <TenantUserList
                  tenantId={parseInt(id!, 10)}
                  users={users}
                  onUpdate={loadUsersData}
                  isModalBlocked={userModalOpen}
                  onModalOpen={() => setUserModalOpen(true)}
                  onModalClose={() => setUserModalOpen(false)}
                />
              </div>

              {/* Available Organization Users */}
              <div className="card">
                <AvailableUsersList
                  tenantId={parseInt(id!, 10)}
                  onUserAdded={loadUsersData}
                  isModalBlocked={userModalOpen}
                  onModalOpen={() => setUserModalOpen(true)}
                  onModalClose={() => setUserModalOpen(false)}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Invite Form Modal */}
      {showInviteForm && (
        <UserInviteForm
          tenantId={parseInt(id!, 10)}
          onClose={handleInviteClose}
        />
      )}

      {/* Create User Modal */}
      {showCreateForm && (
        <UserCreateModal
          tenantId={parseInt(id!, 10)}
          onSave={handleCreateUser}
          onClose={() => setShowCreateForm(false)}
        />
      )}

      <ConfirmDialog
        isOpen={showDeleteTenantModal}
        title={t('confirm.delete_title')}
        description={t('confirm.delete_description', { name: tenant?.name })}
        confirmLabel={t('confirm.delete_label')}
        variant="danger"
        onCancel={() => setShowDeleteTenantModal(false)}
        onConfirm={() => {
          setShowDeleteTenantModal(false);
          handleDeleteTenant();
        }}
      />
    </div>
  );
}
