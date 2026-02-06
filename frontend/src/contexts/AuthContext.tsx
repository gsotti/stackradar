import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { api } from '../utils/api';
import { AuthContextType, User, LoginResponse } from '../types';

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.get<User>('/auth/me')
        .then((userData) => {
          // Ensure tenant_roles is always an array
          if (!userData.tenant_roles) {
            userData.tenant_roles = [];
          }
          setUser(userData);
        })
        .catch(() => {
          localStorage.removeItem('token');
          api.setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string): Promise<LoginResponse> => {
    const data = await api.post<LoginResponse>('/auth/login', { email, password });
    api.setToken(data.access_token);

    // Fetch user data after setting token
    const userData = await api.get<User>('/auth/me');
    // Ensure tenant_roles is always an array
    if (!userData.tenant_roles) {
      userData.tenant_roles = [];
    }
    setUser(userData);

    return data;
  };

  const logout = () => {
    api.setToken(null);
    setUser(null);
  };

  const isSuperadmin = (): boolean => {
    return user?.global_role === 'superadmin';
  };

  const isOrgAdmin = (): boolean => {
    return user?.global_role === 'org_admin';
  };

  const getTenantRole = (tenantId: number | string): string | null => {
    if (!user || !user.tenant_roles) return null;

    const numericTenantId = typeof tenantId === 'string' ? parseInt(tenantId, 10) : tenantId;
    if (isNaN(numericTenantId)) return null;

    const tenantRole = user.tenant_roles.find(tr => tr.tenant_id === numericTenantId);
    return tenantRole ? tenantRole.role : null;
  };

  const canManageTenant = (tenantId: number | string): boolean => {
    if (isSuperadmin()) return true;
    if (isOrgAdmin()) return true;

    const role = getTenantRole(tenantId);
    return role === 'tenant_admin';
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      loading,
      isSuperadmin,
      isOrgAdmin,
      getTenantRole,
      canManageTenant
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
