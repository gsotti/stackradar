import React from 'react';
import { TenantRoleName } from '../../types';

interface RoleSelectProps {
  value: TenantRoleName;
  onChange: (role: TenantRoleName) => void;
  allowedRoles?: TenantRoleName[];
  disabled?: boolean;
}

const roleLabels: Record<TenantRoleName, string> = {
  tenant_admin: 'Tenant Admin',
  editor: 'Editor',
  viewer: 'Viewer'
};

const roleDescriptions: Record<TenantRoleName, string> = {
  tenant_admin: 'Full access and user management',
  editor: 'Can create and edit resources',
  viewer: 'Read-only access'
};

export default function RoleSelect({
  value,
  onChange,
  allowedRoles = ['tenant_admin', 'editor', 'viewer'],
  disabled = false
}: RoleSelectProps) {
  return (
    <div className="w-full">
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as TenantRoleName)}
          disabled={disabled}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {allowedRoles.map((role) => (
            <option key={role} value={role}>
              {roleLabels[role]}
            </option>
          ))}
        </select>
      </div>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {roleDescriptions[value]}
      </p>
    </div>
  );
}
