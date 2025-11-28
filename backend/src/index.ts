import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { CronJob } from 'cron';

import { initDatabase } from './db/database.js';
import authRoutes from './routes/auth.js';
import systemRoutes from './routes/systems.js';
import logRoutes from './routes/logs.js';
import ingestRoutes from './routes/ingest.js';
import k8sRoutes from './routes/k8s.js';
import adminRoutes from './routes/admin.js';
import { cleanupOldLogs } from './services/cleanup.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize database
initDatabase();

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/systems', systemRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/ingest', ingestRoutes);
app.use('/api/k8s', k8sRoutes);
app.use('/api/admin', adminRoutes);

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

// Start server
app.listen(PORT, () => {
  console.log(`🚀 LogPilot server running on port ${PORT}`);
});

// Cleanup Cron Job (runs every hour)
const cleanupJob = new CronJob('0 * * * *', async () => {
  console.log('Running scheduled log cleanup...');
  try {
    const deleted = await cleanupOldLogs();
    console.log(`Cleanup complete. Deleted ${deleted} old log entries.`);
  } catch (error) {
    console.error('Cleanup job failed:', error);
  }
});

cleanupJob.start();
console.log('📅 Cleanup cron job scheduled (hourly)');

export default app;
