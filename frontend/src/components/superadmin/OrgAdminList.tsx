import React, { useState, useEffect } from 'react';
import { Plus, RefreshCw, Shield, UserCheck, UserX, Edit2, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNotification } from '../../contexts/NotificationContext';
import { api } from '../../utils/api';
import { getGravatarUrl } from '../../utils/md5';
import { formatInLocalTime } from '../../utils/dateUtils';
import { User } from '../../types';
import OrgAdminForm from './OrgAdminForm';
import ConfirmDialog from '../common/ConfirmDialog';

export default function OrgAdminList() {
  const { t, i18n } = useTranslation('superadmin');
  const { t: tc } = useTranslation('common');
  const [orgAdmins, setOrgAdmins] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const { showError, showSuccess } = useNotification();

  const loadOrgAdmins = async () => {
    try {
      setLoading(true);
      const data = await api.get<User[]>('/superadmin/org-admins');
      setOrgAdmins(data);
    } catch (error: any) {
      showError(t('messages.org_admin_load_failed', { error: error.message }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrgAdmins();
  }, []);

  const handleToggleActive = async (admin: User) => {
    try {
      await api.put(`/superadmin/org-admins/${admin.id}`, {
        is_active: !admin.is_active
      });
      showSuccess(admin.is_active ? t('messages.org_admin_deactivated') : t('messages.org_admin_activated'));
      loadOrgAdmins();
    } catch (error: any) {
      showError(admin.is_active ? t('messages.org_admin_deactivate_failed', { error: error.message }) : t('messages.org_admin_activate_failed', { error: error.message }));
    }
  };

  const handleDelete = async (admin: User) => {
     try {
       await api.delete(`/superadmin/org-admins/${admin.id}`);
       showSuccess(t('messages.org_admin_deleted'));
       loadOrgAdmins();
     } catch (error: any) {
       showError(t('messages.org_admin_delete_failed', { error: error.message }));
     }
   };

  const handleFormClose = (updated?: boolean) => {
    setShowCreateModal(false);
    setEditingAdmin(null);
    if (updated) {
      loadOrgAdmins();
    }
  };

  if (loading && orgAdmins.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t(`org_admin_list.count_${orgAdmins.length === 1 ? 'one' : 'other'}`, { count: orgAdmins.length })}
        </p>
        <div className="flex gap-2">
          <button
            onClick={loadOrgAdmins}
            className="p-2.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all"
            title={t('org_admin_list.refresh_title')}
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 font-semibold"
          >
            <Plus className="w-5 h-5" />
            {t('org_admin_list.add_admin')}
          </button>
        </div>
      </div>

      {/* Org Admins Grid */}
      {orgAdmins.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t('org_admin_list.empty_title')}</h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
            {t('org_admin_list.empty_description')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {orgAdmins.map((admin) => (
            <div
              key={admin.id}
              className={`group bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 p-6 transition-all duration-300 hover:shadow-xl hover:border-blue-500/50 relative overflow-hidden ${!admin.is_active ? 'opacity-60 grayscale' : ''}`}
            >
              {/* Background accent */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-bl-full -mr-4 -mt-4 transition-all group-hover:scale-150" />

              <div className="relative z-10">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      {admin.email && getGravatarUrl(admin.email) ? (
                        <img
                          src={getGravatarUrl(admin.email, 56)!}
                          alt={admin.name || admin.email}
                          className="w-14 h-14 rounded-2xl shadow-md ring-2 ring-gray-100 dark:ring-gray-700"
                        />
                      ) : (
                        <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                          <span className="text-lg font-bold text-white uppercase">{admin.name?.[0] || admin.email[0]}</span>
                        </div>
                      )}
                      {admin.is_active && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white truncate">{admin.name || tc('meta.anonymous')}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{admin.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-[10px] font-bold uppercase tracking-wider rounded-lg border border-purple-200 dark:border-purple-800 flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      {t('org_admin_list.role_org_admin')}
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div className="flex items-center gap-4 mb-4 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold">{t('org_admin_list.created_label')}</span>
                    <span>{formatInLocalTime(admin.created_at, 'dd.MM.yyyy')}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-semibold">{t('org_admin_list.status_label')}</span>
                    <span className={admin.is_active ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                      {admin.is_active ? t('org_admin_list.status_active') : t('org_admin_list.status_inactive')}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-3 mt-4">
                  <button
                    onClick={() => setEditingAdmin(admin)}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl transition-all font-bold text-sm"
                  >
                    <Edit2 className="w-4 h-4" />
                    {t('org_admin_list.edit')}
                  </button>
                  <button
                    onClick={() => handleToggleActive(admin)}
                    className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl transition-all font-bold text-sm ${
                      admin.is_active
                        ? 'bg-gray-100 dark:bg-gray-700 hover:bg-amber-50 dark:hover:bg-amber-900/30 text-gray-700 dark:text-gray-300 hover:text-amber-600 dark:hover:text-amber-400'
                        : 'bg-green-600 text-white hover:bg-green-700 shadow-lg'
                    }`}
                  >
                    {admin.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                    {admin.is_active ? t('org_admin_list.deactivate') : t('org_admin_list.activate')}
                  </button>
                  <button
                    onClick={() => setDeleteTarget(admin)}
                    className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingAdmin) && (
        <OrgAdminForm
          admin={editingAdmin}
          onClose={handleFormClose}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={t('confirm.delete_admin_title')}
        description={deleteTarget ? t('confirm.delete_admin_description', { name: deleteTarget.name || deleteTarget.email }) : undefined}
        confirmLabel={t('confirm.delete_admin_label')}
        variant="danger"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          handleDelete(deleteTarget);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
