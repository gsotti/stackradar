import React, { useState, useEffect, useMemo } from 'react';
import { Plus, RefreshCw, Users, Search, Trash2, X, Edit } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { getGravatarUrl } from '../utils/md5';

interface OrgUser {
  id: number;
  email: string;
  name: string | null;
  is_active: boolean;
  is_approved: boolean;
  global_role: string | null;
  email_verified: boolean;
  organization_id: number;
  created_at: string;
}

export default function OrgUsersPage() {
  const { t, i18n } = useTranslation('users');
  const { t: tc } = useTranslation('common');
  const { user } = useAuth();
  const { showError, showSuccess } = useNotification();
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<OrgUser | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
    is_active: true
  });

  useEffect(() => {
    fetchUsers();
  }, [user]);

  // Sort: own user first, then filter by search
  const sortedAndFilteredUsers = useMemo(() => {
    let list = users;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(u =>
        u.email.toLowerCase().includes(term) ||
        (u.name && u.name.toLowerCase().includes(term))
      );
    }
    return [...list].sort((a, b) => {
      if (a.id === user?.id) return -1;
      if (b.id === user?.id) return 1;
      return 0;
    });
  }, [searchTerm, users, user?.id]);

  const fetchUsers = async () => {
    if (!user?.organization_id) return;

    try {
      setLoading(true);
      const data = await api.get<OrgUser[]>(`/organizations/${user.organization_id}/users`);
      setUsers(data);
    } catch (error: any) {
      showError(error.response?.data?.detail || t('messages.fetch_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.organization_id) return;

    try {
      await api.post(`/organizations/${user.organization_id}/users`, {
        email: formData.email,
        name: formData.name,
        password: formData.password
      });
      showSuccess(t('messages.org_user_created'));
      setShowCreateModal(false);
      setFormData({ email: '', name: '', password: '', is_active: true });
      fetchUsers();
    } catch (error: any) {
      showError(error.response?.data?.detail || t('messages.create_failed'));
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.organization_id || !selectedUser) return;

    try {
      const updateData: any = {};
      if (formData.email !== selectedUser.email) updateData.email = formData.email;
      if (formData.name !== (selectedUser.name || '')) updateData.name = formData.name;
      if (formData.password) updateData.password = formData.password;
      if (formData.is_active !== selectedUser.is_active) updateData.is_active = formData.is_active;

      if (Object.keys(updateData).length === 0) {
        showError(t('messages.no_changes'));
        return;
      }

      await api.put(`/organizations/${user.organization_id}/users/${selectedUser.id}`, updateData);
      showSuccess(t('messages.org_user_updated'));
      setShowEditModal(false);
      setSelectedUser(null);
      setFormData({ email: '', name: '', password: '', is_active: true });
      fetchUsers();
    } catch (error: any) {
      showError(error.response?.data?.detail || t('messages.user_update_failed'));
    }
  };

  const handleDeleteUser = async () => {
    if (!user?.organization_id || !selectedUser) return;

    try {
      await api.delete(`/organizations/${user.organization_id}/users/${selectedUser.id}`);
      showSuccess(t('messages.org_user_deleted'));
      setShowDeleteModal(false);
      setShowEditModal(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      showError(error.response?.data?.detail || t('messages.delete_failed'));
    }
  };

  const openEditModal = (targetUser: OrgUser) => {
    if (!canModifyUser(targetUser)) return;
    setSelectedUser(targetUser);
    setFormData({
      email: targetUser.email,
      name: targetUser.name || '',
      password: '',
      is_active: targetUser.is_active
    });
    setShowEditModal(true);
  };

  const canModifyUser = (targetUser: OrgUser) => {
    if (targetUser.id === user?.id) return false;
    if (targetUser.global_role === 'superadmin' || targetUser.global_role === 'org_admin') return false;
    return true;
  };

  const getRoleBadge = (role: string | null) => {
    if (role === 'superadmin') {
      return <span className="px-1.5 py-0.5 text-xs font-medium rounded-full bg-accent-danger/10 text-accent-danger dark:bg-accent-danger/10 dark:text-accent-danger">{tc('roles.superadmin')}</span>;
    }
    if (role === 'org_admin') {
      return <span className="px-1.5 py-0.5 text-xs font-medium rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">{tc('roles.org_admin')}</span>;
    }
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading-2">{t('page.org_title')}</h1>
          <p className="text-body-secondary mt-2">{t('page.org_subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="p-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-all"
            title={tc('actions.refresh')}
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => {
              setFormData({ email: '', name: '', password: '', is_active: true });
              setShowCreateModal(true);
            }}
            className="button-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t('actions.create_user')}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          type="text"
          placeholder={t('list.search_placeholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-base w-full pl-9"
        />
      </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-10 h-10 animate-spin text-primary-500" />
          </div>
        ) : sortedAndFilteredUsers.length === 0 ? (
          <div className="surface rounded-lg border-2 border-dashed border-neutral-300 dark:border-neutral-700 p-12">
            <div className="text-center">
              <Users className="w-16 h-16 text-neutral-400 dark:text-neutral-600 mx-auto mb-3" />
              <h3 className="text-heading-4 mb-2">
                {searchTerm ? t('list.empty_title') : t('list.empty_no_users')}
              </h3>
              <p className="text-neutral-600 dark:text-neutral-400 mb-6">
                {searchTerm ? t('list.empty_search_hint') : t('list.empty_create_first')}
              </p>
              {!searchTerm && (
                <button
                  onClick={() => {
                    setFormData({ email: '', name: '', password: '', is_active: true });
                    setShowCreateModal(true);
                  }}
                  className="button-primary inline-flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span className="font-semibold">{t('actions.create_user')}</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedAndFilteredUsers.map((targetUser) => {
              const modifiable = canModifyUser(targetUser);
              const isSelf = targetUser.id === user?.id;
              return (
                <div
                  key={targetUser.id}
                  className="card-hover"
                >
                  <div className="flex items-center gap-4">
                    {getGravatarUrl(targetUser.email) ? (
                      <img
                        src={getGravatarUrl(targetUser.email, 40)!}
                        alt={targetUser.name || targetUser.email}
                        className="w-10 h-10 rounded-full ring-2 ring-gray-200 dark:ring-gray-600 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center ring-2 ring-gray-200 dark:ring-gray-600 flex-shrink-0">
                        <span className="text-sm font-bold text-white">
                          {(targetUser.name?.[0] || targetUser.email[0]).toUpperCase()}
                        </span>
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate text-sm">
                          {targetUser.name || tc('meta.unnamed')}
                        </h3>
                        {isSelf && (
                          <span className="px-1.5 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{t('list.you_badge')}</span>
                        )}
                        {getRoleBadge(targetUser.global_role)}
                        {targetUser.is_active ? (
                          <span className="px-1.5 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                            {t('list.status_active')}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                            {t('list.status_inactive')}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {targetUser.email}
                      </p>
                    </div>

                    <span className="text-xs text-gray-400 whitespace-nowrap hidden sm:block flex-shrink-0">
                      {new Date(targetUser.created_at).toLocaleDateString(i18n.language)}
                    </span>

                    {modifiable && (
                      <button
                        onClick={() => openEditModal(targetUser)}
                        className="p-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all flex-shrink-0"
                        title={t('tenant_list.edit_user_title')}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create User Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full">
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                  {t('actions.create_user')}
                </h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {t('create_modal.email_label')}
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder={t('create_modal.email_placeholder')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {t('create_modal.name_label')}
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder={t('create_modal.name_placeholder')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {t('create_modal.password_label')}
                  </label>
                  <input
                    type="password"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder={t('create_modal.password_placeholder')}
                  />
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="button-secondary button-center"
                  >
                    {tc('actions.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="button-primary button-center"
                  >
                    {t('actions.create_user')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {showEditModal && selectedUser && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full">
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                  {t('edit_modal.title')}
                </h2>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleEditUser} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {t('edit_modal.email_label')}
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder={t('edit_modal.email_label')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {t('edit_modal.name_label')}
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder={t('edit_modal.name_placeholder')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    {t('edit_modal.password_label')}
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder={t('edit_modal.password_placeholder')}
                  />
                </div>

                <div className="flex items-center justify-between py-2">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('edit_modal.active_label')}</label>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      formData.is_active ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.is_active ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                <div className="modal-actions border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false);
                      setShowDeleteModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all font-semibold text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    {t('actions.delete')}
                  </button>
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="button-secondary button-center"
                  >
                    {tc('actions.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="button-primary button-center"
                  >
                    {tc('actions.save')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete User Modal */}
        {showDeleteModal && selectedUser && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full">
              <div className="p-6">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>

                <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
                  {t('org_delete_confirm.title')}
                </h2>

                <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
                  {t('org_delete_confirm.description', { name: selectedUser.name || selectedUser.email })}
                </p>

                <div className="modal-actions">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="button-secondary button-center"
                  >
                    {tc('actions.cancel')}
                  </button>
                  <button
                    onClick={handleDeleteUser}
                    className="button-danger button-center"
                  >
                    {t('org_delete_confirm.label')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
