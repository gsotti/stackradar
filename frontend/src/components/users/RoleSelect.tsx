import React from 'react';
import { useTranslation } from 'react-i18next';
import { TenantRoleName } from '../../types';

interface RoleSelectProps {
  value: TenantRoleName;
  onChange: (role: TenantRoleName) => void;
  allowedRoles?: TenantRoleName[];
  disabled?: boolean;
}

export default function RoleSelect({
  value,
  onChange,
  allowedRoles = ['tenant_admin', 'editor', 'viewer'],
  disabled = false
}: RoleSelectProps) {
  const { t } = useTranslation('users');

  const roleLabels: Record<TenantRoleName, string> = {
    tenant_admin: t('role_select.tenant_admin'),
    editor: t('role_select.editor'),
    viewer: t('role_select.viewer')
  };

  const roleDescriptions: Record<TenantRoleName, string> = {
    tenant_admin: t('role_select.tenant_admin_description'),
    editor: t('role_select.editor_description'),
    viewer: t('role_select.viewer_description')
  };

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
