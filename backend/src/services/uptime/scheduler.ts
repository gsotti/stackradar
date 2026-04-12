import db from '../../db/database.js';
import { UptimeMonitor } from '../../types/index.js';
import { WorkerPool } from './workerPool.js';
import { processMonitorCheck, updateMonitorStatus } from './checker.js';

const TICK_INTERVAL_MS = parseInt(process.env.UPTIME_TICK_MS || '15000', 10);
const CONCURRENCY = parseInt(process.env.UPTIME_CONCURRENCY || '25', 10);
const STALE_TIMEOUT_MS = parseInt(process.env.UPTIME_STALE_TIMEOUT_MS || '300000', 10);
const PER_CHECK_TIMEOUT_MS = 45000;
const MAX_JITTER_MS = 2000;

let isRunning = false;
let lastRunStart = 0;
const pool = new WorkerPool(CONCURRENCY);
let timer: ReturnType<typeof setInterval> | null = null;

/**
 * Query all monitors that are due for a check based on last_checked_at + interval.
 * Prioritizes monitors that haven't been checked yet or are most overdue.
 */
async function getDueMonitors(): Promise<UptimeMonitor[]> {
  const result = await db.query<UptimeMonitor>(
    `SELECT * FROM uptime_monitors
     WHERE enabled = true
       AND (last_checked_at IS NULL
            OR last_checked_at + (interval_seconds || ' seconds')::interval <= NOW())
     ORDER BY last_checked_at ASC NULLS FIRST`
  );
  return result.rows;
}

/**
 * Wrap processMonitorCheck with a small stagger delay and a timeout
 * so a single hanging check can't permanently consume a worker pool slot.
 */
async function processMonitorCheckSafe(monitor: UptimeMonitor, jitterMs: number): Promise<void> {
  // Small stagger so DNS lookups don't all fire at the same instant
  if (jitterMs > 0) {
    await new Promise(resolve => setTimeout(resolve, jitterMs));
  }

  try {
    await Promise.race([
      processMonitorCheck(monitor),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Check timed out for monitor ${monitor.id} ("${monitor.name}")`)),
          PER_CHECK_TIMEOUT_MS
        )
      ),
    ]);
  } catch (err) {
    console.error(`[UptimeScheduler] Monitor ${monitor.id} ("${monitor.name}") failed:`, err);
    // Update last_checked_at so we don't immediately retry a broken monitor
    try {
      await updateMonitorStatus(monitor.id, { last_checked_at: new Date() });
    } catch {
      // ignore — best effort
    }
  }
}

/**
 * Single tick: fetch due monitors and feed them into the worker pool.
 */
async function tick(): Promise<void> {
  // Overlap protection with staleness escape hatch
  if (isRunning) {
    if (Date.now() - lastRunStart > STALE_TIMEOUT_MS) {
      console.warn('[UptimeScheduler] Previous run appears stale, allowing new tick');
    } else {
      return;
    }
  }

  isRunning = true;
  lastRunStart = Date.now();

  try {
    const monitors = await getDueMonitors();
    if (monitors.length === 0) {
      return;
    }

    console.log(
      `[UptimeScheduler] ${monitors.length} monitor(s) due (pool: ${pool.active} active, ${pool.pending} pending)`
    );

    // Deterministic stagger: spread monitors evenly across MAX_JITTER_MS
    // so DNS lookups are ~(MAX_JITTER_MS / count) apart instead of simultaneous.
    const step = monitors.length > 1 ? MAX_JITTER_MS / (monitors.length - 1) : 0;
    const promises = monitors.map((monitor, i) => {
      const jitterMs = Math.round(step * i);
      return pool.run(() => processMonitorCheckSafe(monitor, jitterMs));
    });

    await Promise.allSettled(promises);
  } catch (err) {
    console.error('[UptimeScheduler] Tick error:', err);
  } finally {
    isRunning = false;
  }
}

export function startUptimeScheduler(): void {
  if (timer) return;
  timer = setInterval(() => {
    tick().catch(console.error);
  }, TICK_INTERVAL_MS);

  console.log(
    `[UptimeScheduler] Started (tick=${TICK_INTERVAL_MS}ms, concurrency=${CONCURRENCY})`
  );

  // Run first tick immediately
  tick().catch(console.error);
}

export function stopUptimeScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log('[UptimeScheduler] Stopped');
  }
}
