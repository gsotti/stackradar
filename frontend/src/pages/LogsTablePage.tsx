import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { useApp } from '../contexts/AppContext';
import { api } from '../utils/api';
import SystemFilter from '../components/SystemFilter';
import { LogEntry } from '../types';

interface LogsResponse {
  logs: LogEntry[];
  total: number;
}

export default function LogsTablePage() {
  const {
    selectedSystemId,
    selectedTenant,
    selectedSite,
    selectedEnvironment,
    selectedSystem
  } = useApp();
  const [logs, setLogs] = useState<LogEntry[]>([]);
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
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const lastContextRef = React.useRef([selectedSystemId, selectedTenant, selectedSite, selectedEnvironment, selectedSystem]);

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
      if (v) params.append(k, String(v));
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
      const data = await api.get<LogsResponse>(`/logs?${params}`);
      console.log('✅ [LogsTable] Received logs:', data.logs?.length || 0, 'logs, requestKey:', myKey, 'current:', requestKeyRef.current);
      // Drop stale responses
      if (requestKeyRef.current === myKey) {
        setLogs(data.logs);
        setTotal(data.total);
      } else {
        console.log('⚠️ [LogsTable] Dropped stale response (keys don\'t match)');
      }
    } finally {
      if (requestKeyRef.current === myKey) {
        setLoading(false);
      }
    }
  };

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

  const getLevelBadgeClass = (level: string) => {
    const classes: Record<string, string> = {
      DEBUG: 'bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 text-gray-700 dark:text-gray-300 shadow-sm',
      INFO: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md',
      WARNING: 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-md',
      ERROR: 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-md',
      CRITICAL: 'bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-lg animate-pulse'
    };
    return classes[level] || classes.INFO;
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-[1600px] mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                    <th className="w-10 px-4 py-3"></th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Time</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Level</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Source</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">System</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {logs.map((log) => (
                    <React.Fragment key={log.id}>
                      <tr 
                        className={`hover:bg-blue-50/30 dark:hover:bg-blue-900/10 cursor-pointer transition-colors group ${expandedLog === log.id ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}
                        onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                      >
                        <td className="px-4 py-3 text-center">
                          {expandedLog === log.id ? (
                            <ChevronUp className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-600 dark:text-gray-400">
                          {format(new Date(log.timestamp), 'dd.MM.yyyy HH:mm:ss')}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${getLevelBadgeClass(log.level)}`}>
                            {log.level}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-medium">
                          {log.source || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-gray-900 dark:text-gray-200">{log.system}</span>
                            <span className="text-[10px] text-gray-500 dark:text-gray-500">{log.environment}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 font-mono line-clamp-1">
                          {log.message}
                        </td>
                      </tr>
                      {expandedLog === log.id && (
                        <tr>
                          <td colSpan={6} className="px-8 py-6 bg-gray-50/50 dark:bg-gray-900/30">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                              <div className="space-y-4">
                                <div>
                                  <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Raw Message</h4>
                                  <div className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl font-mono text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-all shadow-inner">
                                    {log.message}
                                  </div>
                                </div>
                                <div className="flex gap-8">
                                  <div>
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Precise Timestamp</h4>
                                    <p className="text-sm font-mono text-gray-700 dark:text-gray-300">{log.timestamp}</p>
                                  </div>
                                  <div>
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">Entry ID</h4>
                                    <p className="text-sm font-mono text-gray-700 dark:text-gray-300">#{log.id}</p>
                                  </div>
                                </div>
                              </div>
                              <div>
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-2">Metadata / Context</h4>
                                {log.metadata ? (
                                  <pre className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl font-mono text-xs text-blue-600 dark:text-blue-400 overflow-x-auto shadow-inner">
                                    {JSON.stringify(log.metadata, null, 2)}
                                  </pre>
                                ) : (
                                  <p className="text-sm italic text-gray-400 dark:text-gray-600 p-4 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">No metadata available</p>
                                )}
                                <div className="mt-4 grid grid-cols-2 gap-4">
                                  <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tenant</p>
                                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{log.tenant || 'default'}</p>
                                  </div>
                                  <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Site</p>
                                    <p className="text-xs font-bold text-gray-700 dark:text-gray-300">{log.site || '-'}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  {logs.length === 0 && !loading && (
                    <tr>
                      <td colSpan={6} className="px-4 py-20 text-center">
                        <div className="max-w-xs mx-auto">
                          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="w-8 h-8 text-gray-300" />
                          </div>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">No logs found</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Try adjusting your search terms or filters.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-gray-50/50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                Showing <span className="text-gray-900 dark:text-white font-bold">{Math.min(total, filters.offset + 1)}-{Math.min(total, filters.offset + filters.limit)}</span> of <span className="text-gray-900 dark:text-white font-bold">{total.toLocaleString()}</span> entries
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={filters.limit}
                  onChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value), offset: 0 })}
                  className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="50">50 per page</option>
                  <option value="100">100 per page</option>
                  <option value="250">250 per page</option>
                  <option value="500">500 per page</option>
                </select>
                <div className="flex gap-1">
                  <button
                    onClick={() => setFilters({ ...filters, offset: Math.max(0, filters.offset - filters.limit) })}
                    disabled={filters.offset === 0 || loading}
                    className="px-4 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setFilters({ ...filters, offset: filters.offset + filters.limit })}
                    disabled={filters.offset + filters.limit >= total || loading}
                    className="px-4 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 shadow-sm z-10">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row gap-4 items-center">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <SystemFilter className="w-full md:w-48" />
            
            <select
              value={filters.level}
              onChange={(e) => setFilters({ ...filters, level: e.target.value, offset: 0 })}
              className="px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none min-w-[120px]"
            >
              <option value="">All Levels</option>
              <option value="DEBUG">DEBUG</option>
              <option value="INFO">INFO</option>
              <option value="WARNING">WARNING</option>
              <option value="ERROR">ERROR</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </div>

          <div className="relative flex-1 w-full group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              placeholder="Search in log messages..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value, offset: 0 })}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all outline-none"
            />
          </div>
          
          <div className="flex items-center w-full md:w-auto">
            <button
              onClick={() => fetchLogs()}
              className={`p-2.5 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-all ${loading ? 'animate-spin' : ''}`}
              title="Refresh logs"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
