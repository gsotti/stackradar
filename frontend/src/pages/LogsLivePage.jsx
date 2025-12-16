import React, { useState, useEffect, useRef } from 'react';
import { Activity, Search, X, RefreshCw, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { useApp } from '../contexts/AppContext';
import { api } from '../utils/api';
import { getLogLevelConfig } from '../utils/logLevels';
import EnvironmentFilter from '../components/EnvironmentFilter';

export default function LogsLivePage() {
  const { selectedSystemId, selectedTenant, selectedApplication, selectedApplicationId, sidebarCollapsed, selectedEnvironment, setSelectedEnvironment } = useApp();
  const [liveLogs, setLiveLogs] = useState([]);
  const [isLiveMode, setIsLiveMode] = useState(true);
  const [liveSearchTerm, setLiveSearchTerm] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMoreLogs, setHasMoreLogs] = useState(true);
  const liveLogsEndRef = useRef(null);
  const liveLogsContainerRef = useRef(null);
  const isUserScrollingRef = useRef(false);
  const oldestLogIdRef = useRef(null);
  // Guard to drop stale responses when filters change quickly
  const requestKeyRef = useRef(0);

  // Live mode polling with smooth log addition
  useEffect(() => {
    // Clear logs and reset oldest log ID when filters change
    setLiveLogs([]);
    oldestLogIdRef.current = null;
    setHasMoreLogs(true);

    if (isLiveMode) {
      let isActive = true;
      let timeoutIds = [];
      const myKey = ++requestKeyRef.current;

      const addLogsSequentially = async (logs) => {
        // Sort new logs by timestamp to ensure correct order
        const sortedNewLogs = [...logs].sort((a, b) =>
          new Date(a.timestamp) - new Date(b.timestamp)
        );

        // Add all logs at once to avoid sorting issues
        setLiveLogs(prev => {
          const existingIds = new Set(prev.map(log => log.id));
          const newUniqueLogs = sortedNewLogs.filter(log => !existingIds.has(log.id));

          if (newUniqueLogs.length === 0) return prev;

          const updated = [...prev, ...newUniqueLogs];
          // Sort all logs by timestamp
          const sorted = updated.sort((a, b) =>
            new Date(a.timestamp) - new Date(b.timestamp)
          );

          // Keep only last 500 logs
          const final = sorted.slice(-500);

          // ONLY set oldest log ID if we don't have one yet (initial load)
          // Don't update it when streaming new logs, as that would make us lose track of older logs
          if (!oldestLogIdRef.current && final.length > 0) {
            oldestLogIdRef.current = final[0].id;
          }

          return final;
        });
      };

      const pollLogs = async () => {
        const params = new URLSearchParams();
        if (selectedSystemId) params.append('system_id', selectedSystemId);
        if (selectedTenant) params.append('tenant', selectedTenant);
        if (selectedEnvironment) params.append('environment', selectedEnvironment);
        if (selectedApplicationId) {
          params.append('application_id', selectedApplicationId);
        } else if (selectedApplication) {
          params.append('application', selectedApplication);
        }
        params.append('limit', '20');

        try {
          const data = await api.get(`/logs?${params}`);
          if (isActive && requestKeyRef.current === myKey && data.logs && data.logs.length > 0) {
            await addLogsSequentially(data.logs);
          }
        } catch (error) {
          console.error('Failed to fetch live logs:', error);
        }
      };

      // Initial fetch with more logs to fill the screen
      const initialFetch = async () => {
        const params = new URLSearchParams();
        if (selectedSystemId) params.append('system_id', selectedSystemId);
        if (selectedTenant) params.append('tenant', selectedTenant);
        if (selectedEnvironment) params.append('environment', selectedEnvironment);
        if (selectedApplicationId) {
          params.append('application_id', selectedApplicationId);
        } else if (selectedApplication) {
          params.append('application', selectedApplication);
        }
        params.append('limit', '100');

        try {
          const data = await api.get(`/logs?${params}`);
          if (isActive && requestKeyRef.current === myKey && data.logs && data.logs.length > 0) {
            await addLogsSequentially(data.logs);
          }
        } catch (error) {
          console.error('Failed to fetch initial logs:', error);
        }
      };

      // Initial fetch
      initialFetch();

      // Poll every 3 seconds (increased to account for sequential delays)
      const interval = setInterval(pollLogs, 3000);

      return () => {
        isActive = false;
        clearInterval(interval);
        timeoutIds.forEach(id => clearTimeout(id));
      };
    }
  }, [isLiveMode, selectedSystemId, selectedTenant, selectedEnvironment, selectedApplication, selectedApplicationId]);

  // Load older logs function
  const loadOlderLogs = async () => {
    if (isLoadingOlder || !hasMoreLogs) return;

    setIsLoadingOlder(true);
    try {
      const params = new URLSearchParams();
      if (selectedSystemId) params.append('system_id', selectedSystemId);
      if (selectedTenant) params.append('tenant', selectedTenant);
      if (selectedEnvironment) params.append('environment', selectedEnvironment);
      if (selectedApplicationId) {
        params.append('application_id', selectedApplicationId);
      } else if (selectedApplication) {
        params.append('application', selectedApplication);
      }
      params.append('limit', '50');

      // Get logs older than the oldest log we currently have
      if (oldestLogIdRef.current) {
        params.append('before_id', oldestLogIdRef.current);
      }

      const data = await api.get(`/logs?${params}`);

      if (data.logs && data.logs.length > 0) {
        // Save scroll position
        const container = liveLogsContainerRef.current;
        const scrollHeightBefore = container?.scrollHeight || 0;
        const scrollTopBefore = container?.scrollTop || 0;

        setLiveLogs(prev => {
          // Filter out duplicates
          const existingIds = new Set(prev.map(log => log.id));
          const newLogs = data.logs.filter(log => !existingIds.has(log.id));

          if (newLogs.length === 0) {
            return prev;
          }

          const combined = [...newLogs.reverse(), ...prev];

          // Sort all logs by timestamp
          const sorted = combined.sort((a, b) =>
            new Date(a.timestamp) - new Date(b.timestamp)
          );

          // Update oldest log ID to the actual oldest log in the sorted array
          if (sorted.length > 0) {
            oldestLogIdRef.current = sorted[0].id;
          }

          return sorted;
        });

        // Restore scroll position after adding older logs
        setTimeout(() => {
          if (container) {
            const scrollHeightAfter = container.scrollHeight;
            const newScrollTop = scrollTopBefore + (scrollHeightAfter - scrollHeightBefore);
            container.scrollTop = newScrollTop;
          }
        }, 0);

        // If we got fewer logs than requested, there are no more
        if (data.logs.length < 50) {
          setHasMoreLogs(false);
        }
      } else {
        setHasMoreLogs(false);
      }
    } catch (error) {
      console.error('Failed to load older logs:', error);
    } finally {
      setIsLoadingOlder(false);
    }
  };

  // Handle scroll event to detect if user manually scrolled and load older logs
  useEffect(() => {
    const container = liveLogsContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      const isAtTop = scrollTop < 100;

      // Update autoScroll based on scroll position
      setAutoScroll(isAtBottom);

      // Load older logs when scrolling near the top
      if (isAtTop && !isLoadingOlder && hasMoreLogs) {
        loadOlderLogs();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isLoadingOlder, hasMoreLogs, selectedSystemId]);

  // Auto-scroll in live mode when new logs arrive
  useEffect(() => {
    if (isLiveMode && autoScroll && liveLogsEndRef.current) {
      liveLogsEndRef.current.scrollIntoView({ behavior: 'auto', block: 'end' });
    }
  }, [liveLogs, isLiveMode, autoScroll]);

  return (
    <>
      {/* Live View - Embedded Terminal */}
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-[#0a0a0a] dark:to-gray-900 overflow-hidden border-t border-gray-200 dark:border-gray-800 pb-[3.5rem]">
        <div ref={liveLogsContainerRef} className="h-[calc(100vh-3.5rem)] overflow-y-auto bg-gradient-to-br from-gray-50 to-gray-100 dark:from-[#0a0a0a] dark:to-gray-900 px-4 py-2 font-mono text-sm">
          <div className="min-h-full">
            {isLoadingOlder && (
              <div className="text-center py-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl mb-2 border border-blue-200 dark:border-blue-800">
                <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-blue-500" />
                <span className="text-blue-600 dark:text-blue-400 text-xs font-medium">Loading older logs...</span>
              </div>
            )}
            {!hasMoreLogs && liveLogs.length > 0 && (
              <div className="text-center py-2 text-gray-600 dark:text-gray-400 text-xs font-medium">
                ─── No more logs ───
              </div>
            )}
            {liveLogs.length === 0 ? (
              <div className="text-gray-600 dark:text-gray-400 text-center py-12 bg-white/50 dark:bg-gray-800/30 backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-gray-700">
                <Activity className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-gray-600 animate-pulse" />
                <p className="font-medium">{isLiveMode ? 'Waiting for logs...' : 'Click "Start" to begin live streaming'}</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {liveLogs.filter(log => {
                  if (!liveSearchTerm) return true;
                  try {
                    const regex = new RegExp(liveSearchTerm, 'i');
                    return regex.test(log.message) || regex.test(log.source || '') || regex.test(log.level);
                  } catch {
                    // If regex is invalid, fall back to simple string search
                    const term = liveSearchTerm.toLowerCase();
                    return log.message.toLowerCase().includes(term) ||
                           (log.source || '').toLowerCase().includes(term) ||
                           log.level.toLowerCase().includes(term);
                  }
                }).map((log, index) => {
                  const config = getLogLevelConfig(log.level);

                  return (
                    <div
                      key={`${log.id}-${index}`}
                      className="hover:bg-white/80 dark:hover:bg-gray-800/60 hover:shadow-sm px-3 py-1 transition-all duration-200 font-mono text-xs rounded-lg hover:scale-[1.01] hover:border-l-2 hover:border-blue-500"
                    >
                      <span className="text-gray-600 dark:text-gray-400 select-none">
                        {format(new Date(log.timestamp), 'MMM dd HH:mm:ss')}
                      </span>
                      {' '}
                      <span className="text-purple-600 dark:text-purple-400 select-none font-medium">
                        {log.source || 'unknown'}
                      </span>
                      {' '}
                      <span className={`${config.color} select-none font-bold inline-block w-4 text-center relative top-[-1px]`}>
                        {config.symbol}
                      </span>
                      {' '}
                      <span className="text-gray-700 dark:text-gray-300 leading-relaxed">{log.message}</span>
                    </div>
                  );
                })}
                <div ref={liveLogsEndRef} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Controls and Filter - Fixed at Bottom of Viewport */}
      <div className={`fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl border-t border-gray-200 dark:border-gray-700 px-4 py-3 z-20 transition-all shadow-xl ${sidebarCollapsed ? 'lg:left-20' : 'lg:left-64'}`}>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Environment Filter (inline) */}
          <EnvironmentFilter />

          {/* Search Filter */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Filter logs... (supports regex)"
              value={liveSearchTerm}
              onChange={(e) => setLiveSearchTerm(e.target.value)}
              className="w-full pl-10 pr-10 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 transition-all hover:border-blue-400 dark:hover:border-blue-500 shadow-sm hover:shadow-md focus:shadow-lg focus:shadow-blue-500/20"
            />
            {liveSearchTerm && (
              <button
                onClick={() => setLiveSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Status Indicator */}
          <div className={`flex items-center gap-2 border-l border-gray-200 dark:border-gray-700 pl-3 px-4 py-1.5 rounded-xl transition-all ${isLiveMode ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-100 dark:bg-gray-700'}`}>
            <Activity className={`w-4 h-4 ${isLiveMode ? 'text-green-500 animate-pulse' : 'text-gray-400'}`} />
            <span className={`text-xs font-medium ${isLiveMode ? 'text-green-700 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
              {isLiveMode ? 'Streaming' : 'Paused'}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
