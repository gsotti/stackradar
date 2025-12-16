export const LOG_LEVEL_CONFIG = {
  DEBUG: { color: 'text-gray-500 dark:text-gray-400', symbol: '○' },
  INFO: { color: 'text-cyan-600 dark:text-cyan-400', symbol: '●' },
  WARNING: { color: 'text-yellow-600 dark:text-yellow-400', symbol: '⚠' },
  ERROR: { color: 'text-red-600 dark:text-red-500', symbol: '✗' },
  CRITICAL: { color: 'text-red-700 dark:text-red-600', symbol: '✗✗' }
};

export function getLogLevelConfig(level) {
  return LOG_LEVEL_CONFIG[level] || LOG_LEVEL_CONFIG.INFO;
}
