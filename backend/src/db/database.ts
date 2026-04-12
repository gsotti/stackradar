import pkg from 'pg';
import dotenv from "dotenv";
import { seedAdminUser } from './seedUtils.js';
const { Pool } = pkg;

export let configApplied = false;
export function setConfigApplied(value: boolean): void { configApplied = value; }

dotenv.config();

const dbConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  user: process.env.POSTGRES_USER || 'stackradar',
  password: process.env.POSTGRES_PASSWORD || 'stackradar_password',
  database: process.env.POSTGRES_DB || 'stackradar',
  max: parseInt(process.env.POSTGRES_POOL_MAX || '30', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

if (process.env.NODE_ENV === 'production' && !process.env.POSTGRES_PASSWORD) {
  console.error('FATAL: POSTGRES_PASSWORD environment variable is required in production. Exiting.');
  process.exit(1);
}

// Create a PostgreSQL connection pool
const pool = new Pool(dbConfig);

// Test connection on startup
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err: Error) => {
  console.error('❌ Unexpected PostgreSQL error:', err);
  process.exit(-1);
});

// Simple initialization - test connection and seed admin user if needed
export async function initDatabase(): Promise<void> {
  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection verified');
    
    // Seed admin user if config was not applied
    if (!configApplied) {
      try {
        await seedAdminUser(pool);
      } catch (error) {
        console.log('ℹ️  Skipping admin user seeding (tables may not exist yet)');
        console.error('   Seed error details:', error);
      }
    } else {
      console.log('ℹ️  Skipping admin seed — configuration file was applied');
    }
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

export { pool };
export default pool;
