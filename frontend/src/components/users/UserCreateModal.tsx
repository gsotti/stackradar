import React, { useState } from 'react';
import { User, Mail, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TenantRoleName } from '../../types';
import RoleSelect from './RoleSelect';
import Modal from '../ui/Modal';

interface UserCreateModalProps {
  tenantId: number;
  onSave: (data: { email: string; password: string; name: string; role: TenantRoleName }) => Promise<void>;
  onClose: () => void;
}

export default function UserCreateModal({ tenantId, onSave, onClose }: UserCreateModalProps) {
  const { t } = useTranslation('users');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'viewer' as TenantRoleName
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!formData.email) {
      setError(t('messages.invite_email_required'));
      return;
    }
    if (!formData.password || formData.password.length < 8) {
      setError(t('messages.password_min_length'));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(formData);
      onClose();
    } catch (err: any) {
      setError(err.message || t('messages.create_failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t('actions.create_user')}
      footer={
        <>
          <button onClick={onClose} disabled={saving} className="button-secondary button-center">
            {t('create_modal.cancel')}
          </button>
          <button onClick={handleSave} disabled={saving} className="button-primary button-center disabled:opacity-50">
            {saving ? t('create_modal.submit_creating') : t('create_modal.submit')}
          </button>
        </>
      }
    >
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">{t('create_modal.name_label')}</label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="input-base w-full pl-10 pr-4"
            placeholder={t('create_modal.name_placeholder')}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">{t('create_modal.email_label')}</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className="input-base w-full pl-10 pr-4"
            placeholder={t('create_modal.email_placeholder')}
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">{t('create_modal.password_label')}</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
          <input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="input-base w-full pl-10 pr-4"
            placeholder="Minimum 8 characters"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">{t('invite.role_label')}</label>
        <RoleSelect
          value={formData.role}
          onChange={(role) => setFormData({ ...formData, role })}
          allowedRoles={['tenant_admin', 'editor', 'viewer']}
        />
      </div>
    </Modal>
  );
}
