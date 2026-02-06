import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { CronJob } from 'cron';
import os from 'os';
import cluster from 'cluster';

import { initDatabase } from './db/database.js';
import authRoutes from './routes/auth.js';
import siteRoutes from './routes/sites.js';
import systemRoutes from './routes/systems.js';
import logRoutes from './routes/logs.js';
import ingestRoutes from './routes/ingest.js';
import k8sRoutes from './routes/k8s.js';
import adminRoutes from './routes/admin.js';
import tenantRoutes from './routes/tenants.js';
import environmentRoutes from './routes/environments.js';
import alertRoutes from './routes/alerts.js';
import uptimeRoutes from './routes/uptime.js';
import { cleanupOldLogs } from './services/cleanup.js';
import { evaluateAllAlerts } from './services/alerting/evaluator.js';
import { runUptimeChecksForInterval } from './services/uptime/checker.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8001;
const CLUSTER_MODE = (process.env.CLUSTER_MODE || 'true').toLowerCase() === 'true';
const WORKERS = Number(process.env.WORKERS || os.cpus().length || 1);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize database
initDatabase();

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
app.use('/api/alerts', alertRoutes);
app.use('/api/uptime', uptimeRoutes);

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Serve static frontend files
const staticPath = process.env.STATIC_PATH || path.join(__dirname, '../../static');
app.use(express.static(staticPath));

// SPA fallback
app.get('*', (req: Request, res: Response) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(staticPath, 'index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// Error handler
app.use((err: any, _req: Request, res: Response) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
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
  const job = new CronJob('* * * * *', async () => {
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

export default app;
