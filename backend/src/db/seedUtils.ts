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
  await pool.query(
    'INSERT INTO users (email, password_hash, name, is_active, is_approved, global_role) VALUES ($1, $2, $3, true, true, \'superadmin\') RETURNING id',
    [ADMIN_EMAIL, passwordHash, ADMIN_NAME]
  );
  console.log('✅ Admin user created');
  console.log(`   Email: ${ADMIN_EMAIL}`);
  console.log(`   Password: ${ADMIN_PASSWORD}`);
}
