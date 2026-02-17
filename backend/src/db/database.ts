import pkg from 'pg';
import dotenv from "dotenv";
const { Pool } = pkg;

dotenv.config();

const dbConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  user: process.env.POSTGRES_USER || 'stackradar',
  password: process.env.POSTGRES_PASSWORD || 'stackradar_password',
  database: process.env.POSTGRES_DB || 'stackradar',
  max: 20,
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

// Simple initialization - just test connection
export async function initDatabase(): Promise<void> {
  try {
    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection verified');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

export { pool };
export default pool;
