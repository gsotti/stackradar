import React from 'react';
import { Mail, Clock, X, Copy, Check, RefreshCw } from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';
import { api } from '../../utils/api';
import { Invitation } from '../../types';

interface PendingInvitationsProps {
  tenantId: number;
  invitations: Invitation[];
  onUpdate: () => void;
}

export default function PendingInvitations({ tenantId, invitations, onUpdate }: PendingInvitationsProps) {
  const { showError, showSuccess } = useNotification();
  const [copiedId, setCopiedId] = React.useState<number | null>(null);

  const handleCancelInvitation = async (invitationId: number, email: string) => {
    if (!confirm(`Are you sure you want to cancel the invitation to ${email}?`)) {
      return;
    }

    try {
      await api.delete(`/invitations/${invitationId}`);
      showSuccess('Invitation cancelled successfully');
      onUpdate();
    } catch (error: any) {
      showError(error.message || 'Failed to cancel invitation');
    }
  };

  const handleResendInvitation = async (invitationId: number, email: string) => {
    try {
      await api.post(`/invitations/${invitationId}/resend`, {});
      showSuccess(`Invitation resent to ${email}`);
      onUpdate(); // Refresh the list
    } catch (error: any) {
      showError(error.message || 'Failed to resend invitation');
    }
  };

  const copyInvitationLink = async (token: string, invitationId: number) => {
    const url = `${window.location.origin}/invitation/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(invitationId);
      showSuccess('Invitation link copied to clipboard');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      showError('Failed to copy link');
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'tenant_admin':
        return 'Tenant Admin';
      case 'editor':
        return 'Editor';
      case 'viewer':
        return 'Viewer';
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
          Pending Invitations
        </h3>
        <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-xs font-bold rounded-full">
          {invitations.length}
        </span>
      </div>

      <div className="space-y-3">
        {invitations.map((invitation) => {
          const expired = isExpired(invitation.expires_at);
          const copied = copiedId === invitation.id;

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
                        Invited by {invitation.invited_by_name || 'Unknown'}
                      </p>
                      <p className={`text-xs font-medium ${
                        expired
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}>
                        {expired ? 'Expired' : 'Expires'} {new Date(invitation.expires_at).toLocaleDateString()}
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
                        title="Copy invitation link"
                      >
                        {copied ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleResendInvitation(invitation.id, invitation.email)}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:bg-green-50 dark:hover:bg-green-900/30 hover:text-green-600 dark:hover:text-green-400 rounded-lg transition-all"
                        title="Resend invitation"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleCancelInvitation(invitation.id, invitation.email)}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-all"
                    title={expired ? 'Delete expired invitation' : 'Cancel invitation'}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
