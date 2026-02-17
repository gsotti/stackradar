import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useApp } from '../contexts/AppContext';
import Layout from './Layout';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
  requireNotViewer?: boolean;
  requireSuperadmin?: boolean;
  requireOrgAdmin?: boolean;
  requireTenantAdmin?: boolean;
  requireEditor?: boolean;
}

export default function ProtectedRoute({
  children,
  requireAdmin = false,
  requireNotViewer = false,
  requireSuperadmin = false,
  requireOrgAdmin = false,
  requireTenantAdmin = false,
  requireEditor = false
}: ProtectedRouteProps) {
  const { user, loading, isSuperadmin, isOrgAdmin, getTenantRole } = useAuth();
  const { selectedTenant } = useApp();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check superadmin requirement
  if (requireSuperadmin && !isSuperadmin()) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-full p-8">
          <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400">You need superadmin privileges to access this page.</p>
        </div>
      </Layout>
    );
  }

  // Check org admin requirement
  if (requireOrgAdmin && !isOrgAdmin() && !isSuperadmin()) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-full p-8">
          <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-gray-600 dark:text-gray-400">You need organization admin privileges to access this page.</p>
        </div>
      </Layout>
    );
  }

  // Get current tenant ID for role checks
  const getCurrentTenantId = (): number | null => {
    if (!selectedTenant || selectedTenant === 'all') return null;
    const tenantId = parseInt(selectedTenant, 10);
    return isNaN(tenantId) ? null : tenantId;
  };

  const currentTenantId = getCurrentTenantId();

  // Check tenant admin requirement
  if (requireTenantAdmin) {
    if (isSuperadmin() || isOrgAdmin()) {
      // Superadmin and org admin have access
    } else if (currentTenantId) {
      const role = getTenantRole(currentTenantId);
      if (role !== 'tenant_admin') {
        return (
          <Layout>
            <div className="flex flex-col items-center justify-center h-full p-8">
              <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
              <p className="text-gray-600 dark:text-gray-400">You need tenant admin privileges to access this page.</p>
            </div>
          </Layout>
        );
      }
    } else {
      return (
        <Layout>
          <div className="flex flex-col items-center justify-center h-full p-8">
            <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
            <p className="text-gray-600 dark:text-gray-400">Please select a tenant to access this page.</p>
          </div>
        </Layout>
      );
    }
  }

  // Check editor requirement
  if (requireEditor) {
    if (isSuperadmin() || isOrgAdmin()) {
      // Superadmin and org admin have access
    } else if (currentTenantId) {
      const role = getTenantRole(currentTenantId);
      const roleHierarchy: Record<string, number> = {
        'tenant_admin': 3,
        'editor': 2,
        'viewer': 1
      };
      const currentLevel = role ? roleHierarchy[role] || 0 : 0;
      const requiredLevel = roleHierarchy['editor'];

      if (currentLevel < requiredLevel) {
        return (
          <Layout>
            <div className="flex flex-col items-center justify-center h-full p-8">
              <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
              <p className="text-gray-600 dark:text-gray-400">You need editor privileges or higher to access this page.</p>
            </div>
          </Layout>
        );
      }
    } else {
      return (
        <Layout>
          <div className="flex flex-col items-center justify-center h-full p-8">
            <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
            <p className="text-gray-600 dark:text-gray-400">Please select a tenant to access this page.</p>
          </div>
        </Layout>
      );
    }
  }

  // Legacy checks for backwards compatibility
  if (requireAdmin && !isSuperadmin() && !isOrgAdmin()) {
    return <Navigate to="/" replace />;
  }

  if (requireNotViewer) {
    // Check new role system
    if (currentTenantId) {
      const role = getTenantRole(currentTenantId);
      if (role === 'viewer') {
        return <Navigate to="/" replace />;
      }
    } else if (!isSuperadmin() && !isOrgAdmin()) {
      return <Navigate to="/" replace />;
    }
  }

  return <Layout>{children}</Layout>;
}
