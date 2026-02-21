import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { api } from '../utils/api';
import { System } from '../types';

interface SystemFilterProps {
  className?: string;
}

export default function SystemFilter({ className = '' }: SystemFilterProps) {
  const {
    selectedTenant,
    selectedSite,
    selectedEnvironment,
    selectedSystem,
    setSelectedSystem
  } = useApp();

  const [options, setOptions] = useState<System[]>([]);
  const [loading, setLoading] = useState(false);

  const queryKey = useMemo(() => (
    JSON.stringify({
      tenant_id: selectedTenant || '',
      site_id: selectedSite || '',
      environment_id: selectedEnvironment || ''
    })
  ), [selectedTenant, selectedSite, selectedEnvironment]);

  useEffect(() => {
    const fetchSystems = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedTenant) {
          params.append('tenant_id', selectedTenant);
        }
        if (selectedSite) {
          params.append('site_id', selectedSite);
        }
        if (selectedEnvironment) {
          params.append('environment_id', selectedEnvironment);
        }
        const systems = await api.get<System[]>(`/systems?${params}`);
        const systemsArray = Array.isArray(systems) ? systems : [];
        setOptions(systemsArray);

        // Clear system selection if current system is not in the new list
        if (selectedSystem && systemsArray.length > 0) {
          const systemIds = systemsArray.map(s => String(s.id));
          if (!systemIds.includes(String(selectedSystem))) {
            setSelectedSystem('');
          }
        } else if (!selectedTenant && !selectedSite && !selectedEnvironment) {
          // Clear system when all filters are cleared
          setSelectedSystem('');
        }
      } catch (e) {
        console.error('Failed to fetch systems', e);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSystems();
  }, [queryKey, selectedSystem, setSelectedSystem]);

  return (
    <div className="relative">
      <select
        value={selectedSystem}
        onChange={(e) => setSelectedSystem(e.target.value)}
        disabled={loading}
        className={`input-base w-full ${className}`}
      >
        <option value="">All Systems</option>
        {options.map((system) => (
          <option key={system.id} value={system.id}>
            {system.name}{!selectedEnvironment && system.environment_name ? ` (${system.environment_name})` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
