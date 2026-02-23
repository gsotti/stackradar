import dotenv from 'dotenv';
import pkg from 'pg';
import fs from 'fs';
import path from 'path';
import { Migration, User } from '../types';

const { Pool } = pkg;

dotenv.config();

async function runMigrations(): Promise<void> {
  const connectionConfig = {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USER || 'logpilot',
    password: process.env.POSTGRES_PASSWORD || 'logpilot_password',
    database: process.env.POSTGRES_DB || 'logpilot',
  };

  const pool = new Pool(connectionConfig);

  try {
    console.log('🔄 Running database migrations...\n');

    // Create a migrations table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get all migration files
    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('ℹ️  No migration files found');
      return;
    }

    // Get already executed migrations
    const executedResult = await pool.query<Migration>('SELECT name FROM migrations');
    const executed = new Set(executedResult.rows.map(r => r.name));

    let appliedCount = 0;

    // Run pending migrations
    for (const file of files) {
      if (executed.has(file)) {
        console.log(`⏭️  Skipping ${file} (already applied)`);
        continue;
      }

      console.log(`📝 Applying ${file}...`);

      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      // Execute migration in a transaction
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Remove comments
        const cleanedSql = sql
          .split('\n')
          .filter(line => !line.trim().startsWith('--'))
          .join('\n');

        // Smart split: handle DO $$ blocks that contain semicolons
        const statements: string[] = [];
        let currentStatement = '';
        let inDollarQuote = false;
        let dollarTag = '';

        for (let i = 0; i < cleanedSql.length; i++) {
          const char = cleanedSql[i];
          currentStatement += char;

          // Check for dollar-quoted strings (DO $$, $body$, etc.)
          if (char === '$') {
            const nextChars = cleanedSql.slice(i, i + 10);
            const dollarMatch = nextChars.match(/^\$\w*\$/);

            if (dollarMatch) {
              const tag = dollarMatch[0];

              if (!inDollarQuote) {
                // Starting a dollar-quoted block
                inDollarQuote = true;
                dollarTag = tag;
                currentStatement += tag.slice(1); // Add the rest of the tag
                i += tag.length - 1;
              } else if (tag === dollarTag) {
                // Ending the dollar-quoted block
                inDollarQuote = false;
                currentStatement += tag.slice(1);
                i += tag.length - 1;
                dollarTag = '';
              }
            }
          }

          // Split on semicolon only if not inside dollar-quoted block
          if (char === ';' && !inDollarQuote) {
            const trimmed = currentStatement.trim();
            if (trimmed.length > 0) {
              statements.push(trimmed);
            }
            currentStatement = '';
          }
        }

        // Add any remaining statement
        const trimmed = currentStatement.trim();
        if (trimmed.length > 0) {
          statements.push(trimmed);
        }

        // Execute each statement
        for (const statement of statements) {
          await client.query(statement);
        }

        // Record migration
        await client.query(
          'INSERT INTO migrations (name) VALUES ($1)',
          [file]
        );

        await client.query('COMMIT');
        console.log(`✅ Applied ${file}`);
        appliedCount++;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }

    console.log(`\n✅ Migration completed! Applied ${appliedCount} migration(s).`);

    // Show current users
    if (appliedCount > 0) {
      console.log('\nCurrent users:');
      const users = await pool.query<Partial<User>>(`
        SELECT id, email, name, is_active, is_approved, global_role
        FROM users
        ORDER BY id
      `);
      console.table(users.rows);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('\n❌ Migration failed:', errorMessage);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations().catch(error => {
  console.error('❌ Migration script failed:', error);
  process.exit(1);
});
