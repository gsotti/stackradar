# Database Migrations

LogPilot uses a simple SQL-based migration system to manage database schema changes.

## How It Works

1. **Migration Files**: SQL files in `src/db/migrations/` with numbered prefixes (01_*, 02_*, etc.)
2. **Tracking**: A `migrations` table tracks which migrations have been executed
3. **Idempotent**: Running migrations multiple times is safe - already applied migrations are skipped
4. **Transactional**: Each migration runs in a transaction for safety

## Migration File Format

Migration files must:
- Be in `src/db/migrations/` directory
- Have a `.sql` extension
- Start with a number prefix (01_, 02_, 03_, etc.)
- Be named descriptively (e.g., `01_add_user_approval.sql`)

Example:
```
backend/src/db/migrations/
├── 01_add_user_approval.sql
├── 02_add_log_indexes.sql
└── 03_add_timestamps.sql
```

## Creating a New Migration

1. **Create the SQL file** with the next number:
   ```bash
   touch backend/src/db/migrations/02_your_migration_name.sql
   ```

2. **Write your SQL** (use `IF NOT EXISTS` for safety):
   ```sql
   -- Migration: Description of what this does
   -- Description: More detailed explanation

   -- Add new column
   ALTER TABLE table_name
   ADD COLUMN IF NOT EXISTS column_name TYPE DEFAULT value;

   -- Create index
   CREATE INDEX IF NOT EXISTS idx_name ON table_name(column);

   -- Update existing data
   UPDATE table_name
   SET column = value
   WHERE condition;
   ```

3. **Run the migration**:
   ```bash
   docker compose exec logpilot npm run db:migrate
   ```

## Running Migrations

### Apply Pending Migrations
```bash
docker compose exec logpilot npm run db:migrate
```

This will:
- Check which migrations have already been applied
- Run only new migrations in order
- Track each applied migration in the `migrations` table

### Reset Database (Complete Fresh Start)
```bash
# WARNING: This deletes ALL data!
docker compose down -v
docker compose up -d
sleep 10
docker compose exec logpilot npm run db:migrate
docker compose exec logpilot npm run db:seed
```

Or use the shortcut (from the backend directory):
```bash
cd backend
npm run db:reset
```

## Example Migration Files

### 01_add_user_approval.sql (Current)
```sql
-- Migration: Add user approval system
-- Description: Adds is_approved and is_admin columns to users table

ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;

ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

UPDATE users
SET is_approved = TRUE
WHERE is_approved IS NULL OR is_approved = FALSE;

UPDATE users
SET is_admin = TRUE
WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM users WHERE is_admin = TRUE);
```

### Example: 02_add_log_indexes.sql (Future)
```sql
-- Migration: Add performance indexes for logs
-- Description: Creates indexes to improve log query performance

CREATE INDEX IF NOT EXISTS idx_logs_created_at
ON log_entries(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_logs_level_timestamp
ON log_entries(level, timestamp DESC);
```

## Checking Migration Status

### List Applied Migrations
```bash
docker compose exec postgres psql -U logpilot -d logpilot \
  -c "SELECT id, name, executed_at FROM migrations ORDER BY id;"
```

### Check if Migration Was Applied
```bash
docker compose exec postgres psql -U logpilot -d logpilot \
  -c "SELECT * FROM migrations WHERE name = '01_add_user_approval.sql';"
```

## Best Practices

1. **Always use `IF NOT EXISTS`** to make migrations idempotent
2. **Number migrations sequentially** (01, 02, 03, etc.)
3. **Never modify executed migrations** - create a new migration instead
4. **Use descriptive names** that explain what the migration does
5. **Add comments** at the top explaining the purpose
6. **Test locally first** before deploying to production
7. **Keep migrations small** - one logical change per migration
8. **Use transactions** - the system does this automatically

## Troubleshooting

### Migration Failed
If a migration fails, it will rollback automatically. Fix the SQL and run again.

### Skip a Bad Migration
If you need to mark a migration as applied without running it:
```bash
docker compose exec postgres psql -U logpilot -d logpilot \
  -c "INSERT INTO migrations (name) VALUES ('02_bad_migration.sql');"
```

### Manually Rollback
There is no automatic rollback. To rollback:
1. Write SQL to undo the changes
2. Run it manually or create a new migration

### Reset Migrations Table
**WARNING: This will rerun ALL migrations!**
```bash
docker compose exec postgres psql -U logpilot -d logpilot \
  -c "DROP TABLE migrations;"
```

## CI/CD Integration

Add migrations to your deployment pipeline:

```bash
# In your deploy script
docker compose up -d postgres
sleep 10
docker compose exec logpilot npm run db:migrate
docker compose exec logpilot npm run db:seed  # Only first time
docker compose up -d logpilot
```

## Migration Script (migrate.js)

The migration runner:
- Creates a `migrations` table if it doesn't exist
- Reads all `.sql` files from `src/db/migrations/`
- Executes pending migrations in alphabetical order
- Tracks executed migrations
- Shows a summary of applied migrations

## Database Reset Script

The `db:reset` script in `package.json`:
```json
{
  "db:reset": "docker compose down -v && docker compose up -d && sleep 5 && npm run db:migrate && npm run db:seed"
}
```

This completely resets the database and applies all migrations.

## Example Workflow

```bash
# 1. Developer creates new migration
touch backend/src/db/migrations/02_add_api_keys.sql

# 2. Write SQL
cat > backend/src/db/migrations/02_add_api_keys.sql <<EOF
ALTER TABLE users
ADD COLUMN IF NOT EXISTS api_key VARCHAR(255);
EOF

# 3. Test locally
docker compose exec logpilot npm run db:migrate

# 4. Verify
docker compose exec postgres psql -U logpilot -d logpilot \
  -c "\\d users"

# 5. Commit and deploy
git add backend/src/db/migrations/02_add_api_keys.sql
git commit -m "Add API keys to users"
git push

# 6. On server, migrations run automatically in deploy script
```

## Current Migrations

| # | Name | Description | Applied |
|---|------|-------------|---------|
| 00 | `00_init_database.sql` | Initial database schema (users, systems, log_entries, k8s_metrics) | ✅ |
| 01 | `01_add_user_approval.sql` | Adds user approval system with is_approved and is_admin columns | ✅ |

## Future Migration Ideas

- Add soft delete support
- Add audit logging
- Add user roles and permissions
- Add email verification
- Add 2FA support
- Add rate limiting tables
