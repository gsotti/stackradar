import crypto from 'crypto';
import { hashPassword } from '../middleware/auth.js';
import { Pool } from 'pg';

// Generate a random password
export function generatePassword(): string {
  return crypto.randomBytes(16).toString('base64').slice(0, 22);
}

// Shared admin user seeding logic
export async function seedAdminUser(pool: Pool): Promise<void> {
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@stackradar.local';
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || generatePassword();
  const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin User';
  const DEFAULT_TENANT = process.env.DEFAULT_TENANT || 'Default';

  // Check if a superadmin user already exists
  const result = await pool.query(
    'SELECT id, email FROM users WHERE global_role = $1',
    ['superadmin']
  );

  if (result.rows.length > 0) {
    return;
  }

  console.log('🌱 Creating admin user...');

  // Create admin user
  const passwordHash = hashPassword(ADMIN_PASSWORD);
  const userResult = await pool.query(
    'INSERT INTO users (email, password_hash, name, is_active, is_approved, global_role) VALUES ($1, $2, $3, true, true, \'superadmin\') RETURNING id',
    [ADMIN_EMAIL, passwordHash, ADMIN_NAME]
  );
  const userId = userResult.rows[0].id;

  console.log('✅ Admin user created');
  console.log(`   Email: ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);

  // Create default tenant if it doesn't exist
  const tenantResult = await pool.query(
    'SELECT id FROM tenants WHERE name = $1',
    [DEFAULT_TENANT]
  );
  
  let tenantId: number;
  if (tenantResult.rows.length > 0) {
    tenantId = tenantResult.rows[0].id;
    console.log(`ℹ️  Tenant '${DEFAULT_TENANT}' already exists`);
  } else {
    const newTenantResult = await pool.query(
      'INSERT INTO tenants (name, description) VALUES ($1, $2) RETURNING id',
      [DEFAULT_TENANT, 'Default tenant created during setup']
    );
    tenantId = newTenantResult.rows[0].id;
    console.log(`✅ Tenant '${DEFAULT_TENANT}' created`);
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
}
