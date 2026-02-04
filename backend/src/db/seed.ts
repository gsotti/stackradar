import dotenv from 'dotenv';
import { hashPassword } from '../middleware/auth.js';
import pkg from 'pg';
import { User } from '../types/index.js';

const { Pool } = pkg;

dotenv.config();

// Admin user configuration from environment or defaults
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@stackradar.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin User';
const DEFAULT_TENANT = process.env.DEFAULT_TENANT || 'Default';

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

    // Check if admin user already exists
    const result = await pool.query<Pick<User, 'id'>>(
      'SELECT id FROM users WHERE email = $1',
      [ADMIN_EMAIL]
    );

    if (result.rows.length > 0) {
      console.log(`ℹ️  Admin user '${ADMIN_EMAIL}' already exists (ID: ${result.rows[0].id})`);
      return;
    }

    // Create admin user
    const passwordHash = hashPassword(ADMIN_PASSWORD);
    const userResult = await pool.query<Pick<User, 'id'>>(
      'INSERT INTO users (email, password_hash, name, is_active, is_approved, is_admin) VALUES ($1, $2, $3, true, true, true) RETURNING id',
      [ADMIN_EMAIL, passwordHash, ADMIN_NAME]
    );
    const userId = userResult.rows[0].id;

    console.log('✅ Admin user created successfully!');
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log(`   User ID: ${userId}`);

    // Create default tenant if it doesn't exist
    const tenantResult = await pool.query<{ id: number }>(
      'SELECT id FROM tenants WHERE name = $1',
      [DEFAULT_TENANT]
    );

    let tenantId: number;
    if (tenantResult.rows.length > 0) {
      tenantId = tenantResult.rows[0].id;
      console.log(`ℹ️  Tenant '${DEFAULT_TENANT}' already exists (ID: ${tenantId})`);
    } else {
      const newTenantResult = await pool.query<{ id: number }>(
        'INSERT INTO tenants (name, description) VALUES ($1, $2) RETURNING id',
        [DEFAULT_TENANT, 'Default tenant created during setup']
      );
      tenantId = newTenantResult.rows[0].id;
      console.log(`✅ Tenant '${DEFAULT_TENANT}' created (ID: ${tenantId})`);
    }

    // Associate admin user with the tenant
    const userTenantExists = await pool.query(
      'SELECT 1 FROM user_tenants WHERE user_id = $1 AND tenant_id = $2',
      [userId, tenantId]
    );

    if (userTenantExists.rows.length === 0) {
      await pool.query(
        'INSERT INTO user_tenants (user_id, tenant_id) VALUES ($1, $2)',
        [userId, tenantId]
      );
      console.log(`✅ Admin user associated with tenant '${DEFAULT_TENANT}'`);
    }

    console.log('\n⚠️  IMPORTANT: Change the admin password after first login!');

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
