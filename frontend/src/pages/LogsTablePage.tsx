import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { formatInLocalTime } from '../utils/dateUtils';
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
      DEBUG: 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300',
      INFO: 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300',
      WARNING: 'bg-accent-warning/10 dark:bg-accent-warning/10 text-accent-warning',
      ERROR: 'bg-accent-danger/10 dark:bg-accent-danger/10 text-accent-danger',
      CRITICAL: 'bg-accent-danger/20 dark:bg-accent-danger/20 text-accent-danger animate-pulse'
    };
    return classes[level] || classes.INFO;
  };

  return (
    <div className="flex flex-col h-screen bg-neutral-50 dark:bg-neutral-900 overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-[1600px] mx-auto">
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-neutral-100 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
                    <th className="w-10 px-4 py-3"></th>
                    <th className="px-4 py-3 text-left text-label">Time</th>
                    <th className="px-4 py-3 text-left text-label">Level</th>
                    <th className="px-4 py-3 text-left text-label">Source</th>
                    <th className="px-4 py-3 text-left text-label">System</th>
                    <th className="px-4 py-3 text-left text-label">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700/50">
                  {logs.map((log) => (
                    <React.Fragment key={log.id}>
                      <tr 
                        className={`hover:bg-primary-50/30 dark:hover:bg-primary-900/10 cursor-pointer transition-colors group ${expandedLog === log.id ? 'bg-primary-50/50 dark:bg-primary-900/20' : ''}`}
                        onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                      >
                        <td className="px-4 py-3 text-center">
                          {expandedLog === log.id ? (
                            <ChevronUp className="w-4 h-4 text-neutral-400 group-hover:text-primary-500" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-neutral-400 group-hover:text-primary-500" />
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-neutral-600 dark:text-neutral-400">
                          {formatInLocalTime(log.timestamp, 'dd.MM.yyyy HH:mm:ss')}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider ${getLevelBadgeClass(log.level)}`}>
                            {log.level}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400 font-medium">
                          {log.source || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-200">{log.system}</span>
                            <span className="text-[10px] text-neutral-500 dark:text-neutral-500">{log.environment}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-neutral-700 dark:text-neutral-300 font-mono line-clamp-1">
                          {log.message}
                        </td>
                      </tr>
                      {expandedLog === log.id && (
                        <tr>
                          <td colSpan={6} className="px-8 py-6 bg-neutral-100 dark:bg-neutral-800/50">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              <div className="space-y-3">
                                <div>
                                  <h4 className="text-label mb-2">Raw Message</h4>
                                  <div className="p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg font-mono text-xs text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap break-all">
                                    {log.message}
                                  </div>
                                </div>
                                <div className="flex gap-6">
                                  <div>
                                    <h4 className="text-label mb-1">Precise Timestamp</h4>
                                    <p className="text-xs font-mono text-neutral-700 dark:text-neutral-300">{log.timestamp}</p>
                                  </div>
                                  <div>
                                    <h4 className="text-label mb-1">Entry ID</h4>
                                    <p className="text-xs font-mono text-neutral-700 dark:text-neutral-300">#{log.id}</p>
                                  </div>
                                </div>
                              </div>
                              <div>
                                <h4 className="text-label mb-2">Metadata / Context</h4>
                                {log.metadata ? (
                                  <pre className="p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg font-mono text-xs text-primary-600 dark:text-primary-400 overflow-x-auto">
                                    {JSON.stringify(log.metadata, null, 2)}
                                  </pre>
                                ) : (
                                  <p className="text-xs italic text-neutral-400 dark:text-neutral-600 p-3 border border-dashed border-neutral-200 dark:border-neutral-700 rounded-lg">No metadata available</p>
                                )}
                                <div className="mt-3 grid grid-cols-2 gap-3">
                                  <div className="p-2.5 bg-neutral-200 dark:bg-neutral-800 rounded-lg">
                                    <p className="text-[10px] font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1">Tenant</p>
                                    <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-300">{log.tenant || 'default'}</p>
                                  </div>
                                  <div className="p-2.5 bg-neutral-200 dark:bg-neutral-800 rounded-lg">
                                    <p className="text-[10px] font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wider mb-1">Site</p>
                                    <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-300">{log.site || '-'}</p>
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
                      <td colSpan={6} className="px-4 py-16 text-center">
                        <div className="max-w-xs mx-auto">
                          <div className="w-16 h-16 bg-neutral-200 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Search className="w-8 h-8 text-neutral-400 dark:text-neutral-600" />
                          </div>
                          <h3 className="text-heading-4 mb-1">No logs found</h3>
                          <p className="text-body-secondary text-sm">Try adjusting your search terms or filters.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="bg-neutral-100 dark:bg-neutral-800/50 border-t border-neutral-200 dark:border-neutral-700 p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-sm text-neutral-600 dark:text-neutral-400 font-medium">
                Showing <span className="text-neutral-900 dark:text-white font-semibold">{Math.min(total, filters.offset + 1)}-{Math.min(total, filters.offset + filters.limit)}</span> of <span className="text-neutral-900 dark:text-white font-semibold">{total.toLocaleString()}</span> entries
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={filters.limit}
                  onChange={(e) => setFilters({ ...filters, limit: parseInt(e.target.value), offset: 0 })}
                  className="input-base text-sm"
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
                    className="button-secondary button-sm disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setFilters({ ...filters, offset: filters.offset + filters.limit })}
                    disabled={filters.offset + filters.limit >= total || loading}
                    className="button-secondary button-sm disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700 p-3 shadow-sm z-10">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row gap-3 items-center">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <SystemFilter className="w-full md:w-48" />
            
            <select
              value={filters.level}
              onChange={(e) => setFilters({ ...filters, level: e.target.value, offset: 0 })}
              className="input-base text-sm"
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 group-focus-within:text-primary-500 transition-colors" />
            <input
              type="text"
              placeholder="Search in log messages..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value, offset: 0 })}
              className="input-base w-full pl-9"
            />
          </div>
          
          <div className="flex items-center w-full md:w-auto">
            <button
              onClick={() => fetchLogs()}
              className={`p-2 text-neutral-600 dark:text-neutral-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-all ${loading ? 'animate-spin' : ''}`}
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
