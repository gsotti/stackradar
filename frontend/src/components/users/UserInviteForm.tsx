import React, { useState, FormEvent } from 'react';
import { X, Mail, Send } from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';
import { api } from '../../utils/api';
import { TenantRoleName } from '../../types';
import RoleSelect from './RoleSelect';

interface UserInviteFormProps {
  tenantId: number;
  onClose: (updated?: boolean) => void;
}

export default function UserInviteForm({ tenantId, onClose }: UserInviteFormProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TenantRoleName>('viewer');
  const [loading, setLoading] = useState(false);
  const { showError, showSuccess } = useNotification();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!email) {
      showError('Please enter an email address');
      return;
    }

    try {
      setLoading(true);
      await api.post('/invitations', {
        tenant_id: tenantId,
        email,
        role
      });

      showSuccess('Invitation sent successfully! An email has been sent to the user.');
      onClose(true);
    } catch (error: any) {
      showError(error.message || 'Failed to send invitation');
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
              Invite User
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
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email Address *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
              placeholder="user@example.com"
              required
              disabled={loading}
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              An invitation link will be sent to this email address
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Role *
            </label>
            <RoleSelect
              value={role}
              onChange={setRole}
              allowedRoles={['tenant_admin', 'editor', 'viewer']}
              disabled={loading}
            />
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <button
              type="button"
              onClick={() => onClose(false)}
              disabled={loading}
              className="px-6 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-8 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 font-semibold disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {loading ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
