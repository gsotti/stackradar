import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { useApp } from '../contexts/AppContext';
import { api } from '../utils/api';
import SystemFilter from '../components/SystemFilter';

export default function LogsTablePage() {
  const {
    selectedSystemId,
    selectedTenant,
    selectedSite,
    selectedEnvironment,
    selectedSystem
  } = useApp();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  // Guard to drop stale responses
  const requestKeyRef = React.useRef(0);
  const [filters, setFilters] = useState({
    level: '',
    search: '',
    limit: 100,
    offset: 0
  });
  const [expandedLog, setExpandedLog] = useState(null);
  const lastContextRef = React.useRef([selectedSystemId, selectedTenant, selectedSite, selectedEnvironment, selectedSystem]);

  // Combined effect to handle both context and local filters
  useEffect(() => {
    // Reset pagination when context filters change
    const isContextChange = [selectedSystemId, selectedTenant, selectedSite, selectedEnvironment, selectedSystem].some(
      (val, i) => val !== lastContextRef.current[i]
    );

    if (isContextChange) {
      lastContextRef.current = [selectedSystemId, selectedTenant, selectedSite, selectedEnvironment, selectedSystem];
      setFilters(prev => ({ ...prev, offset: 0 }));
      setLogs([]); // Clear logs immediately on context change
      setTotal(0);
    }

    // Debounce: wait 300ms THEN fetch
    const debounceTimeout = setTimeout(() => {
      fetchLogs();
    }, 300);

    return () => {
      clearTimeout(debounceTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSystemId, selectedTenant, selectedSite, selectedEnvironment, selectedSystem, filters]);

  const fetchLogs = async () => {
    setLoading(true);
    const myKey = ++requestKeyRef.current;
    const params = new URLSearchParams();
    if (selectedSystemId) params.append('system_id', selectedSystemId);

    // Add global hierarchy filters from sidebar
    if (selectedTenant) params.append('tenant', selectedTenant);
    if (selectedSite) params.append('site', selectedSite);
    if (selectedEnvironment) params.append('environment', selectedEnvironment);
    if (selectedSystem) params.append('system', selectedSystem);

    // Add local filters
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.append(k, v);
    });

    // Debug: Log filter parameters
    console.log('🔍 [LogsTable] Fetching with filters:', {
      tenant: selectedTenant,
      site: selectedSite,
      environment: selectedEnvironment,
      system: selectedSystem,
      localFilters: filters,
      requestKey: myKey,
      url: `/logs?${params}`
    });

    try {
      const data = await api.get(`/logs?${params}`);
      console.log('✅ [LogsTable] Received logs:', data.logs?.length || 0, 'logs, requestKey:', myKey, 'current:', requestKeyRef.current);
      // Drop stale responses
      if (requestKeyRef.current === myKey) {
        setLogs(data.logs);
        setTotal(data.total);
      } else {
        console.log('⚠️ [LogsTable] Dropped stale response (keys don\'t match)');
      }
    } finally {
      setLoading(false);
    }
  };

  const getLevelBadgeClass = (level) => {
    const classes = {
      DEBUG: 'bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 text-gray-700 dark:text-gray-300 shadow-sm',
      INFO: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md',
      WARNING: 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-md',
      ERROR: 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-md',
      CRITICAL: 'bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-lg animate-pulse'
    };
    return classes[level] || classes.INFO;
  };

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="flex items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <SystemFilter />
        </div>
        <button
          onClick={fetchLogs}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>
      {/* Table View */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-xl transition-shadow" style={{ height: 'calc(100vh - 12rem)' }}>
        <div className="overflow-x-auto overflow-y-auto h-full">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 shadow-sm">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Time</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Level</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Hierarchy</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Message</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                      <span className="text-gray-600 dark:text-gray-400 font-medium">Loading logs...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Search className="w-12 h-12 text-gray-400 dark:text-gray-600" />
                      <span className="text-gray-500 dark:text-gray-400 font-medium">No logs found</span>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <React.Fragment key={log.id}>
                    <tr className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-purple-50/50 dark:hover:from-gray-700/50 dark:hover:to-gray-800/50 transition-all duration-200 group">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 font-mono">
                        {format(new Date(log.timestamp), 'MMM dd HH:mm:ss')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${getLevelBadgeClass(log.level)} transition-transform group-hover:scale-105`}>
                          {log.level}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                        <div className="flex flex-col gap-1">
                          {log.tenant && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Tenant:</span>
                              <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-xs font-medium">{log.tenant}</span>
                            </div>
                          )}
                          {log.system_type && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">System:</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${log.system_type === 'prod' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'}`}>{log.system_type}</span>
                            </div>
                          )}
                          {log.environment && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Env:</span>
                              <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs font-medium">{log.environment}</span>
                            </div>
                          )}
                          {log.system && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">System:</span>
                              <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded text-xs font-medium">{log.system}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {log.message}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                          className="text-gray-600 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors p-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        >
                          {expandedLog === log.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                      </td>
                    </tr>
                    {expandedLog === log.id && (
                      <tr className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50">
                        <td colSpan={5} className="px-6 py-4">
                          <pre className="text-sm whitespace-pre-wrap font-mono bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-600 overflow-x-auto shadow-inner">
                            {log.message}
                            {log.metadata && (
                              <>
                                {'\n\n--- Metadata ---\n'}
                                {log.metadata}
                              </>
                            )}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filter Bar at Bottom */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-xl transition-shadow">
        <div className="flex flex-wrap items-center gap-3">
          {/* Level Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Level:</label>
            <select
              value={filters.level}
              onChange={(e) => setFilters({ ...filters, level: e.target.value, offset: 0 })}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all hover:border-blue-400 dark:hover:border-blue-500 shadow-sm"
            >
              <option value="">All Levels</option>
              <option value="DEBUG">DEBUG</option>
              <option value="INFO">INFO</option>
              <option value="WARNING">WARNING</option>
              <option value="ERROR">ERROR</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value, offset: 0 })}
                placeholder="Search logs..."
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 transition-all hover:border-blue-400 dark:hover:border-blue-500 shadow-sm focus:shadow-lg focus:shadow-blue-500/20"
              />
            </div>
          </div>

          {/* Pagination Info */}
          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
            Showing {filters.offset + 1} - {Math.min(filters.offset + filters.limit, total)} of {total}
          </p>

          {/* Pagination Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilters({ ...filters, offset: Math.max(0, filters.offset - filters.limit) })}
              disabled={filters.offset === 0}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium shadow-sm hover:shadow-md"
            >
              Previous
            </button>
            <button
              onClick={() => setFilters({ ...filters, offset: filters.offset + filters.limit })}
              disabled={filters.offset + filters.limit >= total}
              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-gray-700 dark:hover:to-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium shadow-sm hover:shadow-md"
            >
              Next
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchLogs}
            className="px-4 py-2 text-sm bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl flex items-center gap-2 transition-all shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
