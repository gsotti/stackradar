import React, { useState, useEffect, useRef } from 'react';
import { Activity, Search, X, RefreshCw, ChevronDown, Clock, Calendar, Plus, Minus, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { formatInLocalTime } from '../utils/dateUtils';
import { useApp } from '../contexts/AppContext';
import { api } from '../utils/api';
import { getLogLevelConfig } from '../utils/logLevels';
import SystemFilter from '../components/SystemFilter';
import { LogEntry } from '../types';

interface LogsResponse {
  logs: LogEntry[];
  total: number;
}

export default function LogsLivePage() {
  const { selectedSystemId, selectedTenant, selectedSite, selectedEnvironment, selectedSystem, setSelectedSystem } = useApp();
  const [liveLogs, setLiveLogs] = useState<LogEntry[]>([]);
  const [liveSearchTerm, setLiveSearchTerm] = useState('');
  const [startTime, setStartTime] = useState('');
  const [showTimePopover, setShowTimePopover] = useState(false);
  const [firstLogTimestamp, setFirstLogTimestamp] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [logFontSize, setLogFontSize] = useState(() => {
    const saved = localStorage.getItem('logFontSize');
    return saved ? parseInt(saved, 10) : 14;
  });

  const updateLogFontSize = (newSize: number) => {
    const size = Math.max(8, Math.min(32, newSize));
    setLogFontSize(size);
    localStorage.setItem('logFontSize', size.toString());
  };

  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMoreLogs, setHasMoreLogs] = useState(true);
  const liveLogsEndRef = useRef<HTMLDivElement>(null);
  const liveLogsContainerRef = useRef<HTMLDivElement>(null);
  const oldestLogIdRef = useRef<number | null>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  // Guard to drop stale responses when filters change quickly
  const requestKeyRef = useRef(0);

  // Reset system filter on initial load
  useEffect(() => {
    setSelectedSystem('');
    setLiveLogs([]);
    
    // Fetch first log timestamp to show "Searchable logs begin on..."
    const fetchFirstLogTime = async () => {
      try {
        const params = new URLSearchParams();
        params.append('limit', '1');
        params.append('order', 'asc'); // Need to check if backend supports order
        const data = await api.get<LogsResponse>(`/logs?${params}`);
        if (data.logs && data.logs.length > 0) {
          setFirstLogTimestamp(data.logs[0].timestamp);
        }
      } catch (error) {
        console.error('Failed to fetch first log timestamp:', error);
      }
    };
    fetchFirstLogTime();
  }, []);

  // Live mode polling with smooth log addition
  useEffect(() => {
    // Clear logs immediately when filters change to provide instant feedback
    setLiveLogs([]);
    oldestLogIdRef.current = null;
    setHasMoreLogs(true);

    let isActive = true;
    let pollingInterval: ReturnType<typeof setInterval> | null = null;
    const myKey = ++requestKeyRef.current;
    const abortController = new AbortController();

    // REPLACE logs on initial fetch (don't merge with old data)
    const replaceLogsInitial = (logs: LogEntry[]) => {
      if (!isActive || requestKeyRef.current !== myKey) return; // Double-check before replacing

      const sortedLogs = [...logs].sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      const final = sortedLogs.slice(-500);

      if (final.length > 0) {
        oldestLogIdRef.current = final[0].id;
      }

      setLiveLogs(final); // REPLACE, not merge
    };

    // ADD logs for polling updates (merge with existing)
    const addLogsSequentially = async (logs: LogEntry[]) => {
      if (!isActive || requestKeyRef.current !== myKey) return; // Safety check

      // Sort new logs by timestamp to ensure correct order
      const sortedNewLogs = [...logs].sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      // Add all logs at once to avoid sorting issues
      setLiveLogs(prev => {
        const existingIds = new Set(prev.map(log => log.id));
        const newUniqueLogs = sortedNewLogs.filter(log => !existingIds.has(log.id));

        if (newUniqueLogs.length === 0) return prev;

        const updated = [...prev, ...newUniqueLogs];
        // Sort all logs by timestamp
        const sorted = updated.sort((a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        // Keep only last 500 logs
        const final = sorted.slice(-500);

        return final;
      });
    };

    const pollLogs = async () => {
      const params = new URLSearchParams();
      if (selectedTenant) params.append('tenant', selectedTenant);
      if (selectedSite) params.append('site', selectedSite);
      if (selectedEnvironment) params.append('environment', selectedEnvironment);
      if (selectedSystem) params.append('system', selectedSystem);
      if (selectedSystemId) params.append('system_id', selectedSystemId);
      if (startTime) params.append('start_time', startTime);
      params.append('limit', '20');

      try {
        const data = await api.get<LogsResponse>(`/logs?${params}`, { signal: abortController.signal });
        if (isActive && requestKeyRef.current === myKey && data.logs && data.logs.length > 0) {
          await addLogsSequentially(data.logs);
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          // Request was cancelled, ignore
          return;
        }
        console.error('❌ [LogsLive] Poll failed:', error);
      }
    };

    const initialFetch = async () => {
      const params = new URLSearchParams();
      if (selectedTenant) params.append('tenant', selectedTenant);
      if (selectedSite) params.append('site', selectedSite);
      if (selectedEnvironment) params.append('environment', selectedEnvironment);
      if (selectedSystem) params.append('system', selectedSystem);
      if (selectedSystemId) params.append('system_id', selectedSystemId);
      if (startTime) params.append('start_time', startTime);
      params.append('limit', '100');

      try {
        const data = await api.get<LogsResponse>(`/logs?${params}`, { signal: abortController.signal });
        if (!isActive || requestKeyRef.current !== myKey) return;

        if (data.logs && data.logs.length > 0) {
          replaceLogsInitial(data.logs);
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          // Request was cancelled, ignore
          console.log('⚠️ [LogsLive] Request aborted (filter changed)');
          return;
        }
        console.error('❌ [LogsLive] Failed to fetch initial logs:', error);
      }
    };

    // Debounce: wait 300ms THEN clear and fetch
    const debounceTimeout = setTimeout(() => {
      if (!isActive) return;
      
      // Fetch new logs with new filter
      initialFetch();

      // Start polling every 3 seconds AFTER initial fetch
      pollingInterval = setInterval(pollLogs, 3000);
    }, 300); // Wait 300ms before clearing and fetching

    // Cleanup: Stop polling immediately when filters change
    return () => {
      isActive = false;
      abortController.abort(); // Cancel all in-flight requests immediately
      clearTimeout(debounceTimeout); // Cancel debounce if still waiting
      if (pollingInterval) {
        clearInterval(pollingInterval); // Stop polling interval immediately
      }
    };
  }, [selectedSystemId, selectedTenant, selectedSite, selectedEnvironment, selectedSystem, startTime]);

  // Load older logs function
  const loadOlderLogs = async () => {
    if (isLoadingOlder || !hasMoreLogs) return;

    setIsLoadingOlder(true);
    const myKey = requestKeyRef.current; // Capture current request key
    try {
      const params = new URLSearchParams();
      if (selectedTenant) params.append('tenant', selectedTenant);
      if (selectedSite) params.append('site', selectedSite);
      if (selectedEnvironment) params.append('environment', selectedEnvironment);
      if (selectedSystem) params.append('system', selectedSystem);
      if (selectedSystemId) params.append('system_id', selectedSystemId);
      if (startTime) params.append('start_time', startTime);
      params.append('limit', '50');

      // Get logs older than the oldest log we currently have
      if (oldestLogIdRef.current) {
        params.append('before_id', String(oldestLogIdRef.current));
      }

      const data = await api.get<LogsResponse>(`/logs?${params}`);

      // Drop stale responses - if filters changed, don't update
      if (requestKeyRef.current !== myKey) {
        return;
      }

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
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setShowTimePopover(false);
      }
    };

    if (showTimePopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTimePopover]);

  // Handle scroll event to detect if user manually scrolled and load older logs
  useEffect(() => {
    const container = liveLogsContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      const isAtTop = scrollTop < 100;

      if (isAtBottom) {
        setAutoScroll(true);
      } else if (scrollTop < scrollHeight - clientHeight - 100) {
        // Only disable auto-scroll if user scrolled up significantly
        setAutoScroll(false);
      }

      // Load older logs if at top
      if (isAtTop && !isLoadingOlder && hasMoreLogs && liveLogs.length > 0) {
        loadOlderLogs();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isLoadingOlder, hasMoreLogs, liveLogs.length]);

  // Scroll to bottom when new logs arrive (if auto-scroll enabled)
  useEffect(() => {
    if (autoScroll) {
      liveLogsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [liveLogs, autoScroll]);

  const filteredLogs = liveLogs.filter(log =>
    log.message.toLowerCase().includes(liveSearchTerm.toLowerCase()) ||
    log.system?.toLowerCase().includes(liveSearchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-screen bg-neutral-50 text-neutral-900 dark:bg-gray-950 dark:text-gray-100 overflow-hidden font-mono selection:bg-blue-500/30">
      {/* Terminal View */}
      <div 
        ref={liveLogsContainerRef}
        className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-neutral-300 hover:scrollbar-thumb-neutral-400 dark:scrollbar-thumb-gray-800 dark:hover:scrollbar-thumb-gray-700"
      >
        {isLoadingOlder && (
          <div className="flex items-center justify-center py-4 text-blue-400 gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-xs uppercase tracking-widest font-bold">Loading older logs...</span>
          </div>
        )}

        {!hasMoreLogs && liveLogs.length > 0 && (
          <div className="text-center py-4 text-gray-600 text-xs uppercase tracking-widest">
            Beginning of log history
          </div>
        )}

        {filteredLogs.map((log, index) => {
          const config = getLogLevelConfig(log.level);
          return (
            <div 
              key={log.id} 
              className={`flex gap-3 items-start py-1 px-2 rounded hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors border-l-2 border-transparent hover:border-blue-500/50 ${index === filteredLogs.length - 1 ? 'animate-fadeIn' : ''}`}
              style={{ fontSize: `${logFontSize}px` }}
            >
              <span className="text-neutral-500 dark:text-gray-600 shrink-0 select-none mt-0.5 whitespace-nowrap mr-3" style={{ width: `${logFontSize * 10.5}px` }}>
                {formatInLocalTime(log.timestamp, 'dd.MM.yyyy HH:mm:ss')}
              </span>
              <span 
                className={`shrink-0 font-black uppercase text-[0.75em] px-1 rounded flex items-center justify-center mt-0.5 ${config.color} bg-neutral-100 border border-neutral-200 dark:bg-white/5 dark:border-white/5`}
                style={{ width: `${logFontSize * 5.5}px`, height: `${logFontSize * 1.4}px` }}
              >
                {log.level}
              </span>
              <span className="text-blue-600 dark:text-blue-400/80 shrink-0 font-bold mt-0.5" style={{ minWidth: `${logFontSize * 7.5}px` }}>
                [{log.system}]
              </span>
              <div className="text-neutral-700 dark:text-gray-300 break-all whitespace-pre-wrap group-hover:text-neutral-900 dark:group-hover:text-white transition-colors">
                {log.message}
              </div>
            </div>
          );
        })}

        {filteredLogs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-neutral-500 dark:text-gray-600 space-y-4 opacity-50">
            <Activity className="w-12 h-12" />
            <div className="text-center">
              <p className="text-sm">Listening for incoming logs...</p>
              <p className="text-[10px] uppercase tracking-widest mt-1">Buffer is empty</p>
            </div>
          </div>
        )}
        
        <div ref={liveLogsEndRef} className="h-4" />
      </div>

      {/* Status Bar */}
      <div className="bg-white dark:bg-gray-900 border-t border-neutral-200 dark:border-gray-800 px-4 py-2 flex items-center gap-4 shadow-lg z-10 shrink-0">
        <div className="flex items-center gap-2">
          <SystemFilter className="h-10 text-sm bg-neutral-100 dark:bg-gray-800 text-neutral-900 dark:text-gray-100 border-none focus:ring-1 focus:ring-blue-500" />
        </div>

        <div className="flex items-center gap-2 flex-1 h-10">
          <div className="relative group flex-1 h-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-blue-400" />
            <input
              type="text"
              placeholder="Grep logs..."
              value={liveSearchTerm}
              onChange={(e) => setLiveSearchTerm(e.target.value)}
              className="bg-neutral-100 dark:bg-gray-800 border-none rounded-md pl-10 pr-4 py-2 text-sm w-full h-full focus:ring-1 focus:ring-blue-500 outline-none transition-all text-neutral-900 dark:text-gray-100 placeholder:text-neutral-400 dark:placeholder:text-gray-600"
            />
            {liveSearchTerm && (
              <button 
                onClick={() => setLiveSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4 text-neutral-500 dark:text-gray-500 hover:text-neutral-700 dark:hover:text-white" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 justify-end">
          <div className="relative flex items-center gap-2 h-10" ref={popoverRef}>
            {showTimePopover && (
              <div className="absolute bottom-full right-0 mb-2 w-96 bg-white dark:bg-gray-900 border border-neutral-200 dark:border-gray-800 rounded-xl shadow-2xl p-6 animate-fadeIn z-50">
                <h3 className="text-sm font-bold text-neutral-900 dark:text-white mb-4">Seek to date or time</h3>

                <div className="flex flex-col gap-4 mb-4">
                  <div className="relative">
                    <input
                      ref={dateInputRef}
                      type="datetime-local"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full bg-neutral-100 dark:bg-gray-800 border border-neutral-200 dark:border-gray-700 rounded-lg px-4 py-2.5 text-sm text-neutral-900 dark:text-gray-200 focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                    <button 
                      onClick={() => dateInputRef.current?.showPicker()}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-neutral-200 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      <Calendar className="w-4 h-4 text-neutral-500 dark:text-gray-400" />
                    </button>
                  </div>
                  
                  <button
                    onClick={() => {
                      setShowTimePopover(false);
                      // The useEffect will trigger fetch when startTime changes
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-black py-3 rounded-lg transition-all uppercase tracking-wider shadow-lg active:scale-95"
                  >
                    Seek To
                  </button>
                </div>

                {firstLogTimestamp && (
                  <p className="text-[10px] text-neutral-500 dark:text-gray-500 uppercase tracking-widest leading-relaxed">
                    Searchable logs begin on {formatInLocalTime(firstLogTimestamp, 'dd.MM.yyyy')} at {formatInLocalTime(firstLogTimestamp, 'HH:mm')}
                  </p>
                )}

                <div className="flex justify-between items-center mt-4 pt-4 border-t border-neutral-200 dark:border-gray-800">
                  <button
                    onClick={() => {
                      setStartTime('');
                      setShowTimePopover(false);
                    }}
                    className="text-[10px] text-neutral-500 dark:text-gray-400 hover:text-neutral-700 dark:hover:text-white uppercase tracking-widest font-bold"
                  >
                    Reset to Live
                  </button>
                  <button
                    onClick={() => setShowTimePopover(false)}
                    className="p-1 hover:bg-neutral-200 dark:hover:bg-gray-800 rounded transition-colors"
                  >
                    <X className="w-4 h-4 text-neutral-500 dark:text-gray-500" />
                  </button>
                </div>
              </div>
            )}
            <button
              onClick={() => {
                setShowTimePopover(!showTimePopover);
              }}
              className={`h-full px-4 rounded-md transition-all ${showTimePopover || startTime ? 'bg-blue-600 text-white' : 'bg-neutral-100 text-neutral-500 hover:text-neutral-900 dark:bg-gray-800 dark:text-gray-400 dark:hover:text-white'}`}
              title="Seek back in time"
            >
              <Clock className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center bg-neutral-100 dark:bg-gray-800 rounded-md p-1 gap-1 h-10">
            <button
              onClick={() => updateLogFontSize(logFontSize - 1)}
              className="p-2 hover:bg-neutral-200 dark:hover:bg-gray-700 rounded transition-colors text-neutral-500 dark:text-gray-400 hover:text-neutral-900 dark:hover:text-white"
              title="Decrease text size"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              onClick={() => updateLogFontSize(logFontSize + 1)}
              className="p-2 hover:bg-neutral-200 dark:hover:bg-gray-700 rounded transition-colors text-neutral-500 dark:text-gray-400 hover:text-neutral-900 dark:hover:text-white"
              title="Increase text size"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Auto-scroll Status Overlay */}
      {!autoScroll && filteredLogs.length > 0 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
          <button
            onClick={() => setAutoScroll(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 shadow-2xl animate-bounce border border-blue-400/20"
          >
            <ChevronDown className="w-3 h-3" />
            New Logs Below
          </button>
        </div>
      )}
    </div>
  );
}
