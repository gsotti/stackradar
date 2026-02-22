import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

import {UserPlus, Users, RefreshCw, X, Mail, User as UserIcon, UserPlus2} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../utils/api';
import { TenantRoleName } from '../../types';
import { getGravatarUrl } from '../../utils/md5';
import RoleSelect from './RoleSelect';

interface AvailableUser {
  id: number;
  email: string;
  name: string | null;
  is_active: boolean;
  created_at: string;
}

interface AvailableUsersListProps {
  tenantId: number;
  onUserAdded: () => void;
  isModalBlocked?: boolean;
  onModalOpen?: () => void;
  onModalClose?: () => void;
}

export default function AvailableUsersList({ tenantId, onUserAdded, isModalBlocked = false, onModalOpen, onModalClose }: AvailableUsersListProps) {
  const { t } = useTranslation('users');
  const { t: tc } = useTranslation('common');
  const { showError, showSuccess } = useNotification();
  const { user } = useAuth();
  const [users, setUsers] = useState<AvailableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingUserId, setAddingUserId] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<AvailableUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<TenantRoleName>('viewer');

  useEffect(() => {
    loadAvailableUsers();
  }, [tenantId]);

  const loadAvailableUsers = async () => {
    try {
      setLoading(true);
      const organizationId = user?.organization_id;

      if (!organizationId) {
        setUsers([]);
        setLoading(false);
        return;
      }

      const data = await api.get<AvailableUser[]>(
        `/organizations/${organizationId}/available-users?tenant_id=${tenantId}`
      );
      setUsers(data);
    } catch (error: any) {
      // Silently fail - might not have access
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (userId: number, role: TenantRoleName) => {
    setAddingUserId(userId);
    try {
      await api.post(`/tenants/${tenantId}/users/${userId}/add`, { role });
      showSuccess(t('messages.add_to_tenant_success'));
      onUserAdded();
      loadAvailableUsers();
      setSelectedUser(null);
    } catch (error: any) {
      showError(error.message || t('messages.add_to_tenant_failed'));
    } finally {
      setAddingUserId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (users.length === 0) {
    return null; // Don't show section if no available users
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-primary-500" />
        <h3 className="text-lg font-bold text-neutral-900 dark:text-white">
          {t('available_list.title')}
        </h3>
        <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-xs font-bold rounded-full">
          {users.length}
        </span>
      </div>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {t('available_list.description')}
      </p>

      <div className="space-y-3">
        {users.map((user) => (
          <div key={user.id} className="card-compact group">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  {user.email && getGravatarUrl(user.email) ? (
                    <img
                      src={getGravatarUrl(user.email, 48)!}
                      alt={user.name || user.email}
                      className="w-12 h-12 rounded-xl shadow-md ring-2 ring-neutral-200 dark:ring-neutral-700"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-gradient-to-br from-primary-600 to-primary-700 rounded-xl flex items-center justify-center shadow-lg">
                      <span className="text-sm font-bold text-white uppercase">
                        {(user.name?.[0] || user.email[0])}
                      </span>
                    </div>
                  )}
                </div>

                {/* User Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-neutral-900 dark:text-white truncate mb-1">
                    {user.name || t('available_list.unnamed_user')}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                    {user.email}
                  </p>
                </div>
              </div>

              {/* Add button */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => {
                    if (isModalBlocked) return;
                    setSelectedUser(user);
                    setSelectedRole('viewer');
                    onModalOpen?.();
                  }}
                  disabled={addingUserId === user.id}
                  className="button-primary button-center !px-2.5 !py-1 text-sm gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingUserId === user.id ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserPlus2 className="w-4 h-4" />
                  )}
                  {t('available_list.add_button')}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add User Modal */}
      {selectedUser && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 animate-fadeIn">
          <div
            className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setSelectedUser(null);
              onModalClose?.();
            }}
          />
          <div className="card relative w-full max-w-md">
            <div className="pb-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
              <h2 className="text-heading-3">{t('available_list.modal_title')}</h2>
              <button
                onClick={() => {
                  setSelectedUser(null);
                  onModalClose?.();
                }}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>

            <div className="pt-4 space-y-4">
              <div className="flex items-center gap-4">
                {selectedUser.email && getGravatarUrl(selectedUser.email) ? (
                  <img
                    src={getGravatarUrl(selectedUser.email, 64)!}
                    alt={selectedUser.name || selectedUser.email}
                    className="w-16 h-16 rounded-xl shadow-md ring-2 ring-neutral-200 dark:ring-neutral-700"
                  />
                ) : (
                  <div className="w-16 h-16 bg-gradient-to-br from-primary-600 to-primary-700 rounded-xl flex items-center justify-center shadow-lg">
                    <span className="text-lg font-bold text-white uppercase">
                      {(selectedUser.name?.[0] || selectedUser.email[0])}
                    </span>
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
                    <UserIcon className="w-4 h-4" />
                    <span className="truncate">{selectedUser.name || t('available_list.unnamed_user')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                    <Mail className="w-4 h-4" />
                    <span className="truncate">{selectedUser.email}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">{t('available_list.role_label')}</label>
                <RoleSelect
                  value={selectedRole}
                  onChange={(role) => setSelectedRole(role)}
                  allowedRoles={['tenant_admin', 'editor', 'viewer']}
                />
              </div>
            </div>

            <div className="modal-actions">
              <button
                onClick={() => {
                  setSelectedUser(null);
                  onModalClose?.();
                }}
                className="button-secondary button-center"
              >
                {t('available_list.cancel')}
              </button>
              <button
                onClick={() => handleAddUser(selectedUser.id, selectedRole)}
                disabled={addingUserId === selectedUser.id}
                className="button-primary button-center"
              >
                {addingUserId === selectedUser.id ? t('available_list.submit_adding') : t('available_list.submit')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
