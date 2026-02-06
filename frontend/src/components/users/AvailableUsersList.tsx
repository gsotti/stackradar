import React, { useState, useEffect } from 'react';
import { UserPlus, Users, RefreshCw } from 'lucide-react';
import { useNotification } from '../../contexts/NotificationContext';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../utils/api';
import { TenantRoleName } from '../../types';

interface AvailableUser {
  id: number;
  email: string;
  name: string | null;
  is_active: boolean;
  created_at: string;
}

interface AvailableUsersListProps {
  tenantId: number;
  onUserAdded: () => void;
}

export default function AvailableUsersList({ tenantId, onUserAdded }: AvailableUsersListProps) {
  const { showError, showSuccess } = useNotification();
  const { user } = useAuth();
  const [users, setUsers] = useState<AvailableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingUserId, setAddingUserId] = useState<number | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Record<number, TenantRoleName>>({});

  useEffect(() => {
    loadAvailableUsers();
  }, [tenantId]);

  const loadAvailableUsers = async () => {
    try {
      setLoading(true);
      const organizationId = user?.organization_id;

      if (!organizationId) {
        setUsers([]);
        setLoading(false);
        return;
      }

      const data = await api.get<AvailableUser[]>(
        `/organizations/${organizationId}/available-users?tenant_id=${tenantId}`
      );
      setUsers(data);
    } catch (error: any) {
      // Silently fail - might not have access
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (userId: number) => {
    const role = selectedRoles[userId] || 'viewer';
    setAddingUserId(userId);
    try {
      await api.post(`/tenants/${tenantId}/users/${userId}/add`, { role });
      showSuccess('User added to tenant successfully');
      onUserAdded();
      loadAvailableUsers();
    } catch (error: any) {
      showError(error.message || 'Failed to add user');
    } finally {
      setAddingUserId(null);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'tenant_admin': return 'Admin';
      case 'editor': return 'Editor';
      case 'viewer': return 'Viewer';
      default: return role;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (users.length === 0) {
    return null; // Don't show section if no available users
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-green-500" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
          Organization Members
        </h3>
        <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs font-bold rounded-full">
          {users.length}
        </span>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        These users are in your organization but not yet added to this tenant.
      </p>

      <div className="space-y-2">
        {users.map((user) => (
          <div
            key={user.id}
            className="group bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 flex items-center justify-between gap-4 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-white">
                  {(user.name?.[0] || user.email[0]).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white truncate">
                  {user.name || 'Unnamed User'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {user.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <select
                value={selectedRoles[user.id] || 'viewer'}
                onChange={(e) => setSelectedRoles(prev => ({ ...prev, [user.id]: e.target.value as TenantRoleName }))}
                className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500"
              >
                <option value="viewer">{getRoleLabel('viewer')}</option>
                <option value="editor">{getRoleLabel('editor')}</option>
                <option value="tenant_admin">{getRoleLabel('tenant_admin')}</option>
              </select>
              <button
                onClick={() => handleAddUser(user.id)}
                disabled={addingUserId === user.id}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white text-sm font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingUserId === user.id ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                Add
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
