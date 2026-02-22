import React, { useState, FormEvent } from 'react';
import { X, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNotification } from '../../contexts/NotificationContext';
import { api } from '../../utils/api';
import { User } from '../../types';

interface OrgAdminFormProps {
  admin?: User | null;
  onClose: (updated?: boolean) => void;
}

export default function OrgAdminForm({ admin, onClose }: OrgAdminFormProps) {
  const { t } = useTranslation('superadmin');
  const { t: tc } = useTranslation('common');
  const [formData, setFormData] = useState({
    name: admin?.name || '',
    email: admin?.email || '',
    password: '',
    is_active: admin?.is_active ?? true
  });
  const [loading, setLoading] = useState(false);
  const { showError, showSuccess } = useNotification();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!formData.email) {
      showError(t('messages.org_admin_email_required'));
      return;
    }

    if (!admin && !formData.password) {
      showError(t('messages.org_admin_password_required'));
      return;
    }

    try {
      setLoading(true);
      const payload: any = {
        name: formData.name || null,
        email: formData.email,
        is_active: formData.is_active
      };

      // Only include password if it's provided
      if (formData.password) {
        payload.password = formData.password;
      }

      if (admin) {
        await api.put(`/superadmin/org-admins/${admin.id}`, payload);
        showSuccess(t('messages.org_admin_updated'));
      } else {
        await api.post('/superadmin/org-admins', payload);
        showSuccess(t('messages.org_admin_created'));
      }

      onClose(true);
    } catch (error: any) {
      showError(error.message || t('messages.org_admin_save_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fadeIn">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => onClose(false)} />
      <div className="relative bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-primary-600 dark:text-primary-400">
              {t('org_admin_form.title')}
            </h2>
          </div>
          <button onClick={() => onClose(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors">
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('org_admin_form.name_label')}</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all hover:border-blue-400 dark:hover:border-blue-500 shadow-sm"
              placeholder={t('org_admin_form.name_placeholder')}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">{t('org_admin_form.email_label')}</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all hover:border-blue-400 dark:hover:border-blue-500 shadow-sm"
              placeholder={t('org_admin_form.email_placeholder')}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
              {t('org_admin_form.password_label')} {admin && <span className="font-normal text-xs text-gray-400">{t('org_admin_form.password_keep_current')}</span>}
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all hover:border-blue-400 dark:hover:border-blue-500 shadow-sm"
              placeholder="••••••••"
              required={!admin}
            />
          </div>
          <div className="flex flex-col gap-4 py-2">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-green-600"></div>
              </div>
              <span className="text-sm font-bold text-gray-700 dark:text-gray-300 group-hover:text-green-600 transition-colors">{t('org_admin_form.active_label')}</span>
            </label>
          </div>
          <div className="pt-4 flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="button-primary flex-1"
            >
              {loading ? t('org_admin_form.submit_saving') : admin ? t('org_admin_form.submit_update') : t('org_admin_form.submit_create')}
            </button>
            <button
              type="button"
              onClick={() => onClose(false)}
              className="button-secondary flex-1"
            >
              {t('org_admin_form.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
