import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import dotenv from 'dotenv';
import { CronJob } from 'cron';
import os from 'os';
import cluster from 'cluster';

import { initDatabase } from './db/database.js';
import db from './db/database.js';
import authRoutes from './routes/auth.js';
import siteRoutes from './routes/sites.js';
import systemRoutes from './routes/systems.js';
import logRoutes from './routes/logs.js';
import ingestRoutes from './routes/ingest.js';
import k8sRoutes from './routes/k8s.js';
import adminRoutes from './routes/admin.js';
import tenantRoutes from './routes/tenants.js';
import tenantUsersRoutes from './routes/tenant-users.js';
import environmentRoutes from './routes/environments.js';
import alertRoutes from './routes/alerts.js';
import uptimeRoutes from './routes/uptime.js';
import superadminRoutes from './routes/superadmin.js';
import invitationsRoutes from './routes/invitations.js';
import organizationsRoutes from './routes/organizations.js';
import auditLogsRoutes from './routes/audit-logs.js';
import settingsRoutes from './routes/settings.js';
import { cleanupOldLogs } from './services/cleanup.js';
import { evaluateAllAlerts } from './services/alerting/evaluator.js';
import { runUptimeChecksForInterval } from './services/uptime/checker.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8001;
const CLUSTER_MODE = (process.env.CLUSTER_MODE || 'true').toLowerCase() === 'true';
const WORKERS = Number(process.env.WORKERS || os.cpus().length || 1);

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',').map(o => o.trim());

// Cache the app_url from DB so CORS doesn't hit the DB on every request
let cachedAppUrl = '';
let appUrlCachedAt = 0;
const APP_URL_CACHE_TTL = 60_000; // 60s

async function getEffectiveOrigins(): Promise<string[]> {
  const now = Date.now();
  if (now - appUrlCachedAt > APP_URL_CACHE_TTL) {
    try {
      const result = await db.query(`SELECT value FROM system_settings WHERE key = 'app_url'`);
      cachedAppUrl = result.rows[0]?.value?.trim() || '';
      appUrlCachedAt = now;
    } catch {
      // keep stale cached value on DB error
    }
  }
  const origins = [...ALLOWED_ORIGINS];
  // Use app_url from database, fallback to APP_URL environment variable
  const effectiveAppUrl = cachedAppUrl || process.env.APP_URL || '';
  if (effectiveAppUrl) origins.push(effectiveAppUrl);
  return origins;
}

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: async (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    const allowed = await getEffectiveOrigins();
    if (allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 3600
}));
app.use(express.json({ limit: '10mb' }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/sites', siteRoutes);
app.use('/api/systems', systemRoutes);
app.use('/api/environments', environmentRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/ingest', ingestRoutes);
app.use('/api/k8s', k8sRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/tenants', tenantUsersRoutes);
app.use('/api/organizations', organizationsRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/uptime', uptimeRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/invitations', invitationsRoutes);
app.use('/api/audit-logs', auditLogsRoutes);
app.use('/api/settings', settingsRoutes);

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Serve static frontend files
const staticPath = path.resolve(process.env.STATIC_PATH || path.join(__dirname, '../../static'));
app.use(express.static(staticPath));

// SPA fallback
app.get('*', (req: Request, res: Response) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.resolve(staticPath, 'index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// Error handler
app.use((err: any, _req: Request, res: Response, _next: Function) => {
  console.error('Error:', err);
  const status = err.status || 500;
  res.status(status).json({
    error: status < 500 ? err.message : 'Internal server error'
  });
});

function startHttpServer() {
  app.listen(PORT, () => {
    console.log(`🚀 StackRadar server PID ${process.pid} listening on port ${PORT}`);
  });
}

// Cleanup Cron Job (runs every hour)
function scheduleCleanupJobOnce() {
  const job = new CronJob('0 * * * *', async () => {
    console.log('Running scheduled log cleanup...');
    try {
      const deleted = await cleanupOldLogs();
      console.log(`Cleanup complete. Deleted ${deleted} old log entries.`);
    } catch (error) {
      console.error('Cleanup job failed:', error);
    }
  });

  job.start();
  console.log('📅 Cleanup cron job scheduled (hourly)');
}

// Alert Evaluation Cron Job (runs every 5 minutes)
function scheduleAlertJobOnce() {
  const job = new CronJob('*/5 * * * *', async () => {
    console.log('Running alert evaluation...');
    try {
      await evaluateAllAlerts();
    } catch (error) {
      console.error('Alert evaluation failed:', error);
    }
  });

  job.start();
  console.log('📅 Alert evaluation cron job scheduled (every minute)');
}



// Uptime Monitoring Cron Jobs - one per interval
function scheduleUptimeJobs() {
  // 1 minute interval - runs every minute
  const job1m = new CronJob('0 * * * * *', async () => {
    try {
      await runUptimeChecksForInterval(60);
    } catch (error) {
      console.error('Uptime check (1m) failed:', error);
    }
  });
  job1m.start();

  // 5 minute interval - runs every 5 minutes
  const job5m = new CronJob('0 */5 * * * *', async () => {
    try {
      await runUptimeChecksForInterval(300);
    } catch (error) {
      console.error('Uptime check (5m) failed:', error);
    }
  });
  job5m.start();

  // 15 minute interval - runs every 15 minutes
  const job15m = new CronJob('0 */15 * * * *', async () => {
    try {
      await runUptimeChecksForInterval(900);
    } catch (error) {
      console.error('Uptime check (15m) failed:', error);
    }
  });
  job15m.start();

  // 30 minute interval - runs every 30 minutes
  const job30m = new CronJob('0 */30 * * * *', async () => {
    try {
      await runUptimeChecksForInterval(1800);
    } catch (error) {
      console.error('Uptime check (30m) failed:', error);
    }
  });
  job30m.start();

  // 1 hour interval - runs every hour
  const job1h = new CronJob('0 0 * * * *', async () => {
    try {
      await runUptimeChecksForInterval(3600);
    } catch (error) {
      console.error('Uptime check (1h) failed:', error);
    }
  });
  job1h.start();

  console.log('📅 Uptime monitoring cron jobs scheduled (1m, 5m, 15m, 30m, 1h)');
}

// Cluster bootstrap: utilize multiple CPU cores if enabled
(async () => {
  // Initialize database before starting server
  await initDatabase();

  if (CLUSTER_MODE && cluster.isPrimary) {
    // Primary/master process
    console.log(`Primary process ${process.pid} starting ${WORKERS} worker(s)`);

    // Schedule cleanup and alerts only once in primary
    scheduleCleanupJobOnce();
    scheduleAlertJobOnce();
    scheduleUptimeJobs();

    for (let i = 0; i < WORKERS; i++) {
      cluster.fork();
    }

    cluster.on('exit', (worker) => {
      console.warn(`Worker ${worker.process.pid} exited. Starting a new one...`);
      cluster.fork();
    });
  } else {
    // Worker or single-process mode
    startHttpServer();

    // If not clustering, ensure cleanup and alerts are still scheduled
    if (!CLUSTER_MODE) {
      scheduleCleanupJobOnce();
      scheduleAlertJobOnce();
      scheduleUptimeJobs();
    }
  }
})().catch(error => {
  console.error('❌ Failed to start application:', error);
  process.exit(1);
});

export default app;
