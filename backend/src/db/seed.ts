import dotenv from 'dotenv';
import pkg from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { seedAdminUser } from './seedUtils.js';

const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file in the backend directory
dotenv.config({ path: join(__dirname, '../../.env') });

async function seedPostgres(): Promise<void> {
  const pool = new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USER || 'stackradar',
    password: process.env.POSTGRES_PASSWORD || 'stackradar_password',
    database: process.env.POSTGRES_DB || 'stackradar',
  });

  try {
    console.log('🌱 Seeding PostgreSQL database...');
    console.log(`   Host: ${process.env.POSTGRES_HOST || 'localhost'}`);
    console.log(`   Database: ${process.env.POSTGRES_DB || 'stackradar'}`);

    // Use shared seeding logic
    await seedAdminUser(pool);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Error seeding database:', errorMessage);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedPostgres().catch(error => {
  console.error('❌ Seed script failed:', error);
  process.exit(1);
});
