import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';

export function usePermissions() {
  const { user, isSuperadmin, isOrgAdmin, getTenantRole } = useAuth();
  const { selectedTenant } = useApp();

  // Get the current tenant ID from context
  const getCurrentTenantId = (): number | null => {
    if (!selectedTenant || selectedTenant === 'all') return null;
    const tenantId = parseInt(selectedTenant, 10);
    return isNaN(tenantId) ? null : tenantId;
  };

  // Get role for the current tenant or specified tenant
  const getCurrentRole = (tenantId?: number | string): string | null => {
    const targetTenantId = tenantId ?? getCurrentTenantId();
    if (!targetTenantId) return null;
    return getTenantRole(targetTenantId);
  };

  // Check if user has a minimum role level
  const hasMinimumRole = (requiredRole: string, tenantId?: number | string): boolean => {
    if (isSuperadmin()) return true;
    if (isOrgAdmin()) return true;

    const currentRole = getCurrentRole(tenantId);
    if (!currentRole) return false;

    // Role hierarchy: tenant_admin > editor > viewer
    const roleHierarchy: Record<string, number> = {
      'tenant_admin': 3,
      'editor': 2,
      'viewer': 1
    };

    const currentLevel = roleHierarchy[currentRole] || 0;
    const requiredLevel = roleHierarchy[requiredRole] || 0;

    return currentLevel >= requiredLevel;
  };

  return {
    // Site permissions
    canCreateSite: (tenantId?: number | string): boolean => {
      return hasMinimumRole('editor', tenantId);
    },

    canEditSite: (tenantId?: number | string): boolean => {
      return hasMinimumRole('editor', tenantId);
    },

    canDeleteSite: (tenantId?: number | string): boolean => {
      return hasMinimumRole('tenant_admin', tenantId);
    },

    // User management permissions
    canManageUsers: (tenantId?: number | string): boolean => {
      return hasMinimumRole('tenant_admin', tenantId);
    },

    // Tenant management permissions
    canCreateTenant: (): boolean => {
      return isOrgAdmin();
    },

    canEditTenant: (tenantId?: number | string): boolean => {
      if (isOrgAdmin()) return true;
      return hasMinimumRole('tenant_admin', tenantId);
    },

    canDeleteTenant: (): boolean => {
      return isOrgAdmin();
    },

    // Superadmin permissions
    canAccessSuperadmin: (): boolean => {
      return isSuperadmin();
    },

    // Alert and notification permissions
    canCreateAlert: (tenantId?: number | string): boolean => {
      return hasMinimumRole('editor', tenantId);
    },

    canEditAlert: (tenantId?: number | string): boolean => {
      return hasMinimumRole('editor', tenantId);
    },

    canDeleteAlert: (tenantId?: number | string): boolean => {
      return hasMinimumRole('tenant_admin', tenantId);
    },

    canCreateNotificationChannel: (tenantId?: number | string): boolean => {
      return hasMinimumRole('editor', tenantId);
    },

    canEditNotificationChannel: (tenantId?: number | string): boolean => {
      return hasMinimumRole('editor', tenantId);
    },

    canDeleteNotificationChannel: (tenantId?: number | string): boolean => {
      return hasMinimumRole('tenant_admin', tenantId);
    },

    // Uptime monitor permissions
    canCreateUptimeMonitor: (tenantId?: number | string): boolean => {
      return hasMinimumRole('editor', tenantId);
    },

    canEditUptimeMonitor: (tenantId?: number | string): boolean => {
      return hasMinimumRole('editor', tenantId);
    },

    canDeleteUptimeMonitor: (tenantId?: number | string): boolean => {
      return hasMinimumRole('tenant_admin', tenantId);
    },

    // View permissions (all authenticated users can view)
    canViewLogs: (): boolean => {
      return !!user;
    },

    canViewMonitors: (): boolean => {
      return !!user;
    },

    // General role checks
    isViewer: (tenantId?: number | string): boolean => {
      if (isSuperadmin() || isOrgAdmin()) return false;

      // If a specific tenant is provided, check that tenant's role
      if (tenantId) {
        const role = getCurrentRole(tenantId);
        return role === 'viewer';
      }

      // If no tenant specified, check if user is viewer in ALL their tenants
      // (i.e., they have no higher role anywhere)
      const tenantRoles = user?.tenant_roles || [];
      if (tenantRoles.length === 0) return true; // No roles = treat as viewer

      // Check if any role is higher than viewer
      const hasHigherRole = tenantRoles.some(tr =>
        tr.role === 'tenant_admin' || tr.role === 'editor'
      );
      return !hasHigherRole;
    },

    isEditor: (tenantId?: number | string): boolean => {
      const role = getCurrentRole(tenantId);
      return role === 'editor';
    },

    isTenantAdmin: (tenantId?: number | string): boolean => {
      const role = getCurrentRole(tenantId);
      return role === 'tenant_admin';
    }
  };
}
