import React, { useState, useEffect, FormEvent } from 'react';
import { X, Mail, Send, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNotification } from '../../contexts/NotificationContext';
import { api } from '../../utils/api';
import { TenantRoleName, SmtpConfig } from '../../types';
import RoleSelect from './RoleSelect';

interface UserInviteFormProps {
  tenantId: number;
  onClose: (updated?: boolean) => void;
}

export default function UserInviteForm({ tenantId, onClose }: UserInviteFormProps) {
  const { t } = useTranslation('users');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TenantRoleName>('viewer');
  const [loading, setLoading] = useState(false);
  const [smtpConfigured, setSmtpConfigured] = useState<boolean | null>(null);
  const { showError, showSuccess } = useNotification();

  useEffect(() => {
    checkSmtpConfig();
  }, []);

  const checkSmtpConfig = async () => {
    try {
      const config = await api.get<SmtpConfig | null>('/alerts/smtp-config');
      setSmtpConfigured(!!config);
    } catch {
      setSmtpConfigured(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!email) {
      showError(t('messages.invite_email_required'));
      return;
    }

    try {
      setLoading(true);
      await api.post('/invitations', {
        tenant_id: tenantId,
        email,
        role
      });

      showSuccess(t('messages.invite_sent'));
      onClose(true);
    } catch (error: any) {
      showError(error.message || t('messages.invite_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              {t('invite.title')}
            </h2>
          </div>
          <button
            onClick={() => onClose(false)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {smtpConfigured === false && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-800 dark:text-amber-200">
                  {t('invite.smtp_warning_title')}
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                  {t('invite.smtp_warning_text')}
                </p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('invite.email_label')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-base w-full"
              placeholder={t('invite.email_placeholder')}
              required
              disabled={loading}
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {t('invite.email_help')}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('invite.role_label')}
            </label>
            <RoleSelect
              value={role}
              onChange={setRole}
              allowedRoles={['tenant_admin', 'editor', 'viewer']}
              disabled={loading}
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              onClick={() => onClose(false)}
              disabled={loading}
              className="button-secondary button-center"
            >
              {t('invite.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading || smtpConfigured === false}
              className="button-primary button-center"
            >
              <Send className="w-4 h-4" />
              {loading ? t('invite.submit_sending') : t('invite.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
