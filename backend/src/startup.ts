#!/usr/bin/env node

/**
 * Startup script that runs migrations before starting the application
 * Migrations only run once in the primary process when clustering is enabled
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cluster from 'cluster';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CLUSTER_MODE = (process.env.CLUSTER_MODE || 'true').toLowerCase() === 'true';

async function runMigrations(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log('🔄 Running database migrations...\n');

    // Run migrations
    const migrateFile = join(__dirname, 'db/migrate.js');

    const migrate = spawn('node', [migrateFile], {
      stdio: 'inherit',
      env: process.env
    });

    migrate.on('close', (code) => {
      if (code === 0) {
        console.log('\n✅ Migrations completed successfully\n');
        resolve();
      } else {
        reject(new Error(`Migration process exited with code ${code}`));
      }
    });

    migrate.on('error', (error) => {
      reject(error);
    });
  });
}

async function startApp(): Promise<void> {
  console.log('🚀 Starting application...\n');

  // Import and start the main application
  await import('./index.js');
}

async function main() {
  try {
    // Only run migrations if:
    // 1. Not in cluster mode, OR
    // 2. In cluster mode AND this is the primary process
    const shouldRunMigrations = !CLUSTER_MODE || cluster.isPrimary;

    if (shouldRunMigrations) {
      console.log('📍 Running as primary process - will run migrations');
      await runMigrations();
    } else {
      console.log('📍 Running as worker process - skipping migrations');
    }

    // Start the application (handles clustering internally)
    await startApp();
  } catch (error) {
    console.error('❌ Startup failed:', error);
    process.exit(1);
  }
}

main();
