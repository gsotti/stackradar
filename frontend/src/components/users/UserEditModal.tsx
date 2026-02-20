import React, { useState } from 'react';
import { X } from 'lucide-react';
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="card relative w-full max-w-md">
        <div className="pb-4 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <h2 className="text-heading-3">Edit User</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-neutral-500" />
          </button>
        </div>

        <div className="pt-4 space-y-6">
          <div className="flex items-center gap-4">
            {user.email && getGravatarUrl(user.email) ? (
              <img
                src={getGravatarUrl(user.email, 64)!}
                alt={user.name || user.email}
                className="w-16 h-16 rounded-xl shadow-md ring-2 ring-neutral-200 dark:ring-neutral-700"
              />
            ) : (
              <div className="w-16 h-16 bg-gradient-to-br from-primary-600 to-primary-700 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-lg font-bold text-white uppercase">
                  {(user.name?.[0] || user.email[0])}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Email</p>
              <p className="text-sm font-medium text-neutral-900 dark:text-white truncate">{user.email}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-base w-full"
              placeholder="User name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Role
            </label>
            <RoleSelect
              value={role}
              onChange={(nextRole) => setRole(nextRole)}
              allowedRoles={['tenant_admin', 'editor', 'viewer']}
            />
          </div>
        </div>

        <div className="pt-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="button-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (role === user.role && name === (user.name || ''))}
            className="button-primary"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
