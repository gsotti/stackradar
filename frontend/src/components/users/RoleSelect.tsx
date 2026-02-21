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
          className="input-base w-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {allowedRoles.map((role) => (
            <option key={role} value={role}>
              {roleLabels[role]}
            </option>
          ))}
        </select>
      </div>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        {roleDescriptions[value]}
      </p>
    </div>
  );
}
