import React, { useState, useEffect } from 'react';
import { Mail, Clock, X, Copy, Check, RefreshCw, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNotification } from '../../contexts/NotificationContext';
import { api } from '../../utils/api';
import { Invitation, SmtpConfig } from '../../types';
import ConfirmDialog from '../common/ConfirmDialog';

interface PendingInvitationsProps {
  tenantId: number;
  invitations: Invitation[];
  onUpdate: () => void;
}

export default function PendingInvitations({ tenantId, invitations, onUpdate }: PendingInvitationsProps) {
  const { t, i18n } = useTranslation('users');
  const { t: tc } = useTranslation('common');
  const { showError, showSuccess } = useNotification();
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [smtpConfigured, setSmtpConfigured] = useState<boolean | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Invitation | null>(null);

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

  const handleCancelInvitation = async (invitationId: number, email: string) => {
    try {
      await api.delete(`/invitations/${invitationId}`);
      showSuccess(t('messages.invitation_cancelled'));
      onUpdate();
    } catch (error: any) {
      showError(error.message || t('messages.invitation_cancel_failed'));
    }
  };

  const handleResendInvitation = async (invitationId: number, email: string) => {
    try {
      await api.post(`/invitations/${invitationId}/resend`, {});
      showSuccess(t('messages.invitation_resent', { email }));
      onUpdate(); // Refresh the list
    } catch (error: any) {
      showError(error.message || t('messages.invitation_resend_failed'));
    }
  };

  const copyInvitationLink = async (token: string, invitationId: number) => {
    const url = `${window.location.origin}/invitation/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(invitationId);
      showSuccess(t('messages.link_copied'));
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      showError(t('messages.link_copy_failed'));
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'tenant_admin':
        return t('role_select.tenant_admin');
      case 'editor':
        return t('role_select.editor');
      case 'viewer':
        return t('role_select.viewer');
      default:
        return role;
    }
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'tenant_admin':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800';
      case 'editor':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800';
      case 'viewer':
        return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600';
    }
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  if (invitations.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 text-amber-500" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          {t('pending_invitations.title')}
        </h3>
        <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-xs font-bold rounded-full">
          {invitations.length}
        </span>
      </div>

      <div className="space-y-3">
        {invitations.map((invitation) => {
          const expired = isExpired(invitation.expires_at);
          const copied = copiedId === invitation.id;
          const invitationId = invitation.id;
          const email = invitation.email;

          return (
            <div
              key={invitation.id}
              className={`group bg-white dark:bg-gray-800 rounded-2xl border p-4 transition-all ${
                expired
                  ? 'border-red-200 dark:border-red-800/50 opacity-60'
                  : 'border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-amber-500/50'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {/* Icon */}
                  <div className={`p-2 rounded-lg flex-shrink-0 ${
                    expired
                      ? 'bg-red-100 dark:bg-red-900/30'
                      : 'bg-amber-100 dark:bg-amber-900/30'
                  }`}>
                    <Mail className={`w-5 h-5 ${
                      expired ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
                    }`} />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-gray-900 dark:text-white truncate">
                        {invitation.email}
                      </p>
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-lg border ${getRoleBadgeClass(invitation.role)}`}>
                        {getRoleLabel(invitation.role)}
                      </span>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t('pending_invitations.invited_by', { name: invitation.invited_by_name || tc('meta.unknown') })}
                      </p>
                      <p className={`text-xs font-medium ${
                        expired
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {expired ? t('pending_invitations.expired_label') : t('pending_invitations.expires_label')} {new Date(invitation.expires_at).toLocaleDateString(i18n.language)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {!expired && (
                    <>
                      <button
                        onClick={() => copyInvitationLink(invitation.token, invitation.id)}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg transition-all"
                        title={t('pending_invitations.copy_link_title')}
                      >
                        {copied ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleResendInvitation(invitationId, email)}
                        disabled={smtpConfigured === false}
                        className={`p-2 transition-all rounded-lg ${
                          smtpConfigured === false
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-600 dark:hover:text-green-400'
                        }`}
                        title={smtpConfigured === false ? t('pending_invitations.smtp_disabled_title') : t('pending_invitations.resend_title')}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => setCancelTarget(invitation)}
                    className="p-2 text-neutral-400 hover:text-accent-danger hover:bg-accent-danger/10 rounded-lg transition-colors"
                    title={t('pending_invitations.cancel_title')}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        isOpen={!!cancelTarget}
        title={t('cancel_invite_confirm.title')}
        description={cancelTarget ? t('cancel_invite_confirm.description', { email: cancelTarget.email }) : undefined}
        confirmLabel={t('cancel_invite_confirm.label')}
        variant="danger"
        onCancel={() => setCancelTarget(null)}
        onConfirm={() => {
          if (!cancelTarget) return;
          handleCancelInvitation(cancelTarget.id, cancelTarget.email);
          setCancelTarget(null);
        }}
      />
    </div>
  );
}
