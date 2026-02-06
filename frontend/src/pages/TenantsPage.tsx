import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RefreshCw, Building2 } from 'lucide-react';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import TenantCard from '../components/tenants/TenantCard';
import TenantForm from '../components/tenants/TenantForm';
import { Tenant } from '../types';

interface TenantWithUserCount extends Tenant {
  user_count?: number;
}

export default function TenantsPage() {
  const navigate = useNavigate();
  const { isOrgAdmin } = useAuth();
  const { showError, showSuccess } = useNotification();
  const [tenants, setTenants] = useState<TenantWithUserCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const data = await api.get<TenantWithUserCount[]>('/tenants');
      setTenants(data);
    } catch (error: any) {
      showError(error.message || 'Failed to fetch tenants');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTenant = async (data: { name: string; description: string }) => {
    try {
      const newTenant = await api.post<Tenant>('/tenants', data);
      showSuccess('Tenant created successfully');
      setShowForm(false);
      fetchTenants();
      // Navigate to the new tenant's settings page
      navigate(`/tenants/${newTenant.id}/settings`);
    } catch (error: any) {
      showError(error.message || 'Failed to create tenant');
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-6rem)]">
        <RefreshCw className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Tenants
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage organizations and their members
          </p>
        </div>
        {isOrgAdmin() && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95 font-medium"
          >
            <Plus className="w-4 h-4" />
            Create Tenant
          </button>
        )}
      </div>

      {/* Create Tenant Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-700 transform transition-all">
            <TenantForm
              mode="create"
              onSubmit={handleCreateTenant}
              onCancel={() => setShowForm(false)}
            />
          </div>
        </div>
      )}

      {tenants.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
          <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            No tenants found
          </h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-8">
            Create your first tenant to start organizing your users and sites.
          </p>
          {isOrgAdmin() && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl hover:scale-105"
            >
              <Plus className="w-5 h-5" />
              Create Your First Tenant
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tenants.map((tenant) => (
            <TenantCard
              key={tenant.id}
              tenant={tenant}
              userCount={tenant.user_count}
            />
          ))}
        </div>
      )}
    </div>
  );
}
