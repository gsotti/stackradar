import React, { useState } from 'react';
import { Trash2, Shield, Edit2, UserX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../utils/api';
import { TenantUser, TenantRoleName } from '../../types';
import { getGravatarUrl } from '../../utils/md5';
import UserEditModal from './UserEditModal';
import ConfirmDialog from '../common/ConfirmDialog';

interface TenantUserListProps {
  tenantId: number;
  users: TenantUser[];
  onUpdate: () => void;
  isModalBlocked?: boolean;
  onModalOpen?: () => void;
  onModalClose?: () => void;
}

export default function TenantUserList({ tenantId, users, onUpdate, isModalBlocked = false, onModalOpen, onModalClose }: TenantUserListProps) {
  const { t } = useTranslation('users');
  const { t: tc } = useTranslation('common');
  const { user: currentUser } = useAuth();
  const { showError, showSuccess } = useNotification();
  const [editingUser, setEditingUser] = useState<TenantUser | null>(null);
  const [removeTarget, setRemoveTarget] = useState<TenantUser | null>(null);

  // Debug: Log users with their roles
  console.log('Users with roles:', users.map(u => ({ id: u.id, email: u.email, role: u.role })));

  const handleRoleChange = async (userId: number, data: { role: TenantRoleName; name?: string }) => {
    try {
      await api.put(`/tenants/${tenantId}/users/${userId}`, data);
      showSuccess(t('messages.user_updated'));
      onUpdate();
    } catch (error: any) {
      showError(error.message || t('messages.user_update_failed'));
      throw error; // Re-throw so modal knows it failed
    }
  };

  const handleRemoveUser = async (userId: number, userName: string) => {
     try {
       await api.delete(`/tenants/${tenantId}/users/${userId}`);
       showSuccess(t('messages.user_removed'));
       onUpdate();
     } catch (error: any) {
       showError(error.message || t('messages.user_remove_failed'));
     }
   };

  const getRoleBadge = (role: TenantRoleName) => {
    switch (role) {
      case 'tenant_admin':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs font-bold uppercase tracking-wider rounded-lg border border-purple-200 dark:border-purple-800">
            <Shield className="w-3 h-3" />
            {t('tenant_list.role_admin')}
          </span>
        );
      case 'editor':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider rounded-lg border border-blue-200 dark:border-blue-800">
            <Edit2 className="w-3 h-3" />
            {t('tenant_list.role_editor')}
          </span>
        );
      case 'viewer':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs font-bold uppercase tracking-wider rounded-lg border border-gray-200 dark:border-gray-600">
            <UserX className="w-3 h-3" />
            {t('tenant_list.role_viewer')}
          </span>
        );
    }
  };

  if (users.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
        <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3 opacity-50" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{t('tenant_list.empty_title')}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('tenant_list.empty_description')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {users.map((user) => {
        const isCurrentUser = currentUser?.id === user.id;

        return (
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

                {/* User info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-neutral-900 dark:text-white truncate">
                      {user.name || t('available_list.unnamed_user')}
                    </h3>
                    {isCurrentUser && (
                      <span className="px-2 py-0.5 bg-accent-success/10 text-accent-success text-[10px] font-bold uppercase tracking-wider rounded-full">
                        {t('list.you_badge')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                    {user.email}
                  </p>
                </div>
              </div>

              {/* Role Badge */}
              <div className="flex-shrink-0">
                {getRoleBadge(user.role)}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => {
                    if (isModalBlocked) return;
                    setEditingUser(user);
                    onModalOpen?.();
                  }}
                  disabled={isCurrentUser}
                  className="p-2 text-neutral-600 dark:text-neutral-400 hover:bg-primary-50 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-400 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  title={isCurrentUser ? t('tenant_list.cannot_edit_self') : t('tenant_list.edit_user_title')}
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setRemoveTarget(user)}
                  className="px-3 py-1.5 text-xs font-semibold text-accent-danger bg-accent-danger/10 dark:bg-accent-danger/20 hover:bg-accent-danger/20 dark:hover:bg-accent-danger/30 rounded-lg transition-colors"
                >
                  {t('tenant_list.remove_button')}
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* Edit User Modal */}
      {editingUser && (
        <UserEditModal
          user={editingUser}
          onSave={handleRoleChange}
          onClose={() => {
            setEditingUser(null);
            onModalClose?.();
          }}
        />
      )}

      <ConfirmDialog
        isOpen={!!removeTarget}
        title={t('remove_confirm.title')}
        description={removeTarget ? t('remove_confirm.description', { name: removeTarget.name || removeTarget.email }) : undefined}
        confirmLabel={t('remove_confirm.label')}
        variant="danger"
        onCancel={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (!removeTarget) return;
          handleRemoveUser(removeTarget.id, removeTarget.name || removeTarget.email);
          setRemoveTarget(null);
        }}
      />
    </div>
  );
}
