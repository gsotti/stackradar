import React, { useState } from 'react';
import { X, User, Mail, Shield } from 'lucide-react';
import { TenantUser, TenantRoleName } from '../../types';
import { getGravatarUrl } from '../../utils/md5';
import RoleSelect from './RoleSelect';

interface UserEditModalProps {
  user: TenantUser;
  onSave: (userId: number, data: { role: TenantRoleName; name?: string }) => Promise<void>;
  onClose: () => void;
}

export default function UserEditModal({ user, onSave, onClose }: UserEditModalProps) {
  const [role, setRole] = useState<TenantRoleName>(user.role);
  const [name, setName] = useState<string>(user.name || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(user.id, { role, name: name || undefined });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit User</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* User Info */}
          <div className="flex items-center gap-4">
            {user.email && getGravatarUrl(user.email) ? (
              <img
                src={getGravatarUrl(user.email, 64)!}
                alt={user.name || user.email}
                className="w-16 h-16 rounded-xl shadow-md"
              />
            ) : (
              <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-xl font-bold text-white uppercase">
                  {user.name?.[0] || user.email[0]}
                </span>
              </div>
            )}
            <div className="flex-1">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Email</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{user.email}</p>
            </div>
          </div>

          {/* Name Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
              placeholder="User name"
            />
          </div>

          {/* Role Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Role
            </label>
            <RoleSelect
              value={role}
              onChange={setRole}
              allowedRoles={['tenant_admin', 'editor', 'viewer']}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (role === user.role && name === (user.name || ''))}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
