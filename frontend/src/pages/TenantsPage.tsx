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
        <RefreshCw className="w-10 h-10 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-heading-2">Tenants</h1>
          <p className="text-body-secondary mt-2">Manage organizations and their members</p>
        </div>
        {isOrgAdmin() && (
          <button
            onClick={() => setShowForm(true)}
            className="button-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Tenant
          </button>
        )}
      </div>

      {/* Create Tenant Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="card w-full max-w-md">
            <TenantForm
              mode="create"
              onSubmit={handleCreateTenant}
              onCancel={() => setShowForm(false)}
            />
          </div>
        </div>
      )}

      {tenants.length === 0 ? (
        <div className="text-center py-16 surface rounded-lg border-2 border-dashed border-neutral-300 dark:border-neutral-700">
          <Building2 className="w-16 h-16 text-neutral-400 dark:text-neutral-600 mx-auto mb-3 opacity-50" />
          <h3 className="text-heading-4 mb-2">No tenants found</h3>
          <p className="text-neutral-600 dark:text-neutral-400 max-w-sm mx-auto mb-6">
            Create your first tenant to start organizing your users and sites.
          </p>
          {isOrgAdmin() && (
            <button
              onClick={() => setShowForm(true)}
              className="button-primary inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
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
