import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { api } from '../utils/api';

export default function EnvironmentFilter({ className = '' }) {
  const {
    selectedTenant,
    selectedSystemId,
    selectedApplicationId,
    selectedEnvironment,
    setSelectedEnvironment
  } = useApp();

  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  const queryKey = useMemo(() => (
    JSON.stringify({
      tenant_id: selectedTenant || '',
      system_id: selectedSystemId || '',
      application_id: selectedApplicationId || ''
    })
  ), [selectedTenant, selectedSystemId, selectedApplicationId]);

  useEffect(() => {
    const fetchEnvs = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedApplicationId) {
          params.append('application_id', selectedApplicationId);
        } else if (selectedSystemId) {
          params.append('system_id', selectedSystemId);
        } else if (selectedTenant) {
          params.append('tenant_id', selectedTenant);
        }
        const envs = await api.get(`/environments?${params}`);
        const names = Array.isArray(envs) ? envs.map(e => e.name).filter(Boolean) : [];
        setOptions(names);

        // Prefill: if current selection not in list, choose single option or set to All ('')
        if (!names.includes(selectedEnvironment)) {
          if (names.length === 1) {
            setSelectedEnvironment(names[0]);
          } else {
            setSelectedEnvironment('');
          }
        }
      } catch (e) {
        console.error('Failed to fetch environments', e);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEnvs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  return (
    <div className={`relative ${className}`}>
      <select
        value={selectedEnvironment}
        onChange={(e) => setSelectedEnvironment(e.target.value)}
        className="min-w-[160px] px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all hover:border-green-400 dark:hover:border-green-500 shadow-sm hover:shadow-md"
        disabled={loading}
      >
        <option value="">All environments</option>
        {options.map((name) => (
          <option key={name} value={name}>{name}</option>
        ))}
      </select>
    </div>
  );
}
