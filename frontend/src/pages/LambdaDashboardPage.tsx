import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';

interface LambdaFunctionMetrics {
  function_name: string;
  invocations: number;
  errors: number;
  throttles: number;
  avg_duration_ms: number;
  max_duration_ms: number;
  memory_mb: number | null;
  runtime: string | null;
}

interface LambdaAggregate {
  function_count: number;
  total_invocations: number;
  total_errors: number;
  total_throttles: number;
  avg_duration_ms: number;
  error_rate_percent: number;
}

interface LambdaMetricsResponse {
  functions: LambdaFunctionMetrics[];
  aggregate: LambdaAggregate;
}

type SortKey = keyof LambdaFunctionMetrics;
type SortDir = 'asc' | 'desc';

interface LambdaDashboardProps {
  siteId: string | number;
}

export default function LambdaDashboard({ siteId }: LambdaDashboardProps) {
  const { t } = useTranslation('sites');
  const { showError } = useNotification();
  const [data, setData] = useState<LambdaMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('function_name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const fetchMetrics = useCallback(async () => {
    try {
      const result = await api.get<LambdaMetricsResponse>(`/lambda/metrics?site_id=${siteId}`);
      setData(result || null);
    } catch (error: any) {
      showError(error.message || t('messages.failed_load'));
    } finally {
      setLoading(false);
    }
  }, [siteId, showError, t]);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedFunctions = data
    ? [...data.functions].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        if (typeof av === 'string' && typeof bv === 'string') {
          return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
        }
        return sortDir === 'asc' ? Number(av) - Number(bv) : Number(bv) - Number(av);
      })
    : [];

  const SortIndicator = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <span className="ml-1 text-neutral-300 dark:text-neutral-600">↕</span>;
    return <span className="ml-1 text-primary-500">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  const thClass =
    'px-4 py-3 text-left text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:text-neutral-900 dark:hover:text-white transition-colors';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  const agg = data?.aggregate;
  const safeNum = (v: number | undefined | null, digits = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(digits) : '—';
  };

  return (
    <div className="space-y-4">
      {/* Overview cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card-compact border-t-4 border-t-primary-500">
          <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">
            {t('lambda.dashboard.total_functions')}
          </div>
          <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
            {agg ? safeNum(agg.function_count) : '—'}
          </div>
        </div>

        <div className="card-compact border-t-4 border-t-accent-info">
          <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">
            {t('lambda.dashboard.total_invocations')}
          </div>
          <div className="text-2xl font-bold text-accent-info">
            {agg ? safeNum(agg.total_invocations) : '—'}
          </div>
        </div>

        <div className="card-compact border-t-4 border-t-accent-danger">
          <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">
            {t('lambda.dashboard.error_rate')}
          </div>
          <div className={`text-2xl font-bold ${agg && agg.error_rate_percent > 0 ? 'text-accent-danger' : 'text-accent-success'}`}>
            {agg ? `${safeNum(agg.error_rate_percent, 1)}%` : '—'}
          </div>
        </div>

        <div className="card-compact border-t-4 border-t-accent-warning">
          <div className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-1">
            {t('lambda.dashboard.avg_duration')}
          </div>
          <div className="text-2xl font-bold text-accent-warning">
            {agg ? `${safeNum(agg.avg_duration_ms, 0)} ms` : '—'}
          </div>
        </div>
      </div>

      {/* Functions table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex items-center justify-between">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-white">
            {t('lambda.dashboard.title')}
          </h2>
          <button
            onClick={fetchMetrics}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors text-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t('details.refresh')}
          </button>
        </div>

        {sortedFunctions.length === 0 ? (
          <div className="flex items-center gap-3 p-6 text-sm text-neutral-500 dark:text-neutral-400">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-accent-warning" />
            {t('lambda.dashboard.no_data')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-800/50">
                <tr>
                  <th className={thClass} onClick={() => handleSort('function_name')}>
                    {t('lambda.dashboard.table.function_name')}
                    <SortIndicator col="function_name" />
                  </th>
                  <th className={thClass} onClick={() => handleSort('invocations')}>
                    {t('lambda.dashboard.table.invocations')}
                    <SortIndicator col="invocations" />
                  </th>
                  <th className={thClass} onClick={() => handleSort('errors')}>
                    {t('lambda.dashboard.table.errors')}
                    <SortIndicator col="errors" />
                  </th>
                  <th className={thClass} onClick={() => handleSort('throttles')}>
                    {t('lambda.dashboard.table.throttles')}
                    <SortIndicator col="throttles" />
                  </th>
                  <th className={thClass} onClick={() => handleSort('avg_duration_ms')}>
                    {t('lambda.dashboard.table.avg_duration')}
                    <SortIndicator col="avg_duration_ms" />
                  </th>
                  <th className={thClass} onClick={() => handleSort('max_duration_ms')}>
                    {t('lambda.dashboard.table.max_duration')}
                    <SortIndicator col="max_duration_ms" />
                  </th>
                  <th className={thClass} onClick={() => handleSort('memory_mb')}>
                    {t('lambda.dashboard.table.memory')}
                    <SortIndicator col="memory_mb" />
                  </th>
                  <th className={thClass} onClick={() => handleSort('runtime')}>
                    {t('lambda.dashboard.table.runtime')}
                    <SortIndicator col="runtime" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {sortedFunctions.map((fn) => (
                  <tr
                    key={fn.function_name}
                    className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-sm text-neutral-900 dark:text-white font-medium">
                      {fn.function_name}
                    </td>
                    <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                      {fn.invocations.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {fn.errors > 0 ? (
                        <span className="inline-flex items-center gap-1 text-accent-danger font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {fn.errors.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-accent-success">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {fn.throttles > 0 ? (
                        <span className="text-accent-warning font-semibold">
                          {fn.throttles.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-neutral-500 dark:text-neutral-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                      {fn.avg_duration_ms != null ? `${Number(fn.avg_duration_ms).toFixed(0)} ms` : '—'}
                    </td>
                    <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                      {fn.max_duration_ms != null ? `${Number(fn.max_duration_ms).toFixed(0)} ms` : '—'}
                    </td>
                    <td className="px-4 py-3 text-neutral-700 dark:text-neutral-300">
                      {fn.memory_mb != null ? `${fn.memory_mb} MB` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {fn.runtime ? (
                        <span className="px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-mono">
                          {fn.runtime}
                        </span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
