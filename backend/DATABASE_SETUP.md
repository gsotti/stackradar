# Database Setup Guide

LogPilot uses PostgreSQL as its database.

## Quick Setup with Docker Compose

### Start PostgreSQL and LogPilot

```bash
# Start all services (PostgreSQL + LogPilot)
docker compose up -d

# Wait for PostgreSQL to be ready (about 10 seconds)
docker compose logs -f postgres

# Initialize the PostgreSQL schema (run from inside the container)
docker compose exec logpilot npm run db:setup

# Seed the admin user
docker compose exec logpilot npm run db:seed
```

The default admin credentials will be:
- **Email:** `admin@logpilot.local`
- **Password:** `admin123`

⚠️ **IMPORTANT:** Change the admin password after first login!

## Manual Setup

### PostgreSQL Setup

#### 1. Start PostgreSQL

If using Docker Compose:
```bash
docker compose up -d postgres
```

Or start your own PostgreSQL instance:
```bash
# Example with Docker
docker run -d \
  --name logpilot-postgres \
  -e POSTGRES_USER=logpilot \
  -e POSTGRES_PASSWORD=logpilot_password \
  -e POSTGRES_DB=logpilot \
  -p 5432:5432 \
  postgres:16-alpine
```

#### 2. Configure Environment

Create a `.env` file in the project root:

```bash
# PostgreSQL Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=logpilot
POSTGRES_PASSWORD=logpilot_password
POSTGRES_DB=logpilot

# Admin User
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your-secure-password
ADMIN_NAME=Admin User

# Security (change these!)
JWT_SECRET=your-secret-key-change-in-production
ADMIN_API_KEY=your-admin-api-key
```

#### 3. Initialize Database Schema

```bash
cd backend
npm install
npm run db:setup
```

This will create all necessary tables:
- `users` - User accounts
- `systems` - Log systems/sources
- `log_entries` - Log messages
- `k8s_metrics` - Kubernetes metrics (optional)

#### 4. Seed Admin User

```bash
npm run db:seed
```

This creates an admin user with credentials from your `.env` file.

## Environment Variables

### Required Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for JWT tokens | (required in production) |
| `ADMIN_API_KEY` | Admin key for cleanup endpoint | (required) |

### PostgreSQL Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_HOST` | PostgreSQL host | `localhost` |
| `POSTGRES_PORT` | PostgreSQL port | `5432` |
| `POSTGRES_USER` | Database user | `logpilot` |
| `POSTGRES_PASSWORD` | Database password | `logpilot_password` |
| `POSTGRES_DB` | Database name | `logpilot` |

### Admin User Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ADMIN_EMAIL` | Admin user email | `admin@logpilot.local` |
| `ADMIN_PASSWORD` | Admin user password | `admin123` |
| `ADMIN_NAME` | Admin user display name | `Admin User` |

## Database Schema

### Users Table
```sql
- id: SERIAL PRIMARY KEY
- email: VARCHAR(255) UNIQUE NOT NULL
- password_hash: VARCHAR(255) NOT NULL
- name: VARCHAR(255)
- is_active: BOOLEAN DEFAULT TRUE
- created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

### Systems Table
```sql
- id: SERIAL PRIMARY KEY
- name: VARCHAR(255) NOT NULL
- description: TEXT
- api_token: VARCHAR(255) UNIQUE NOT NULL
- retention_days: INTEGER DEFAULT 30
- user_id: INTEGER NOT NULL (FK to users)
- created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

### Log Entries Table
```sql
- id: SERIAL PRIMARY KEY
- system_id: INTEGER NOT NULL (FK to systems)
- timestamp: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
- level: VARCHAR(50) DEFAULT 'INFO'
- message: TEXT NOT NULL
- source: VARCHAR(255)
- metadata: JSONB
- created_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

### K8s Metrics Table
```sql
- id: SERIAL PRIMARY KEY
- system_id: INTEGER UNIQUE NOT NULL (FK to systems)
- cluster_name: VARCHAR(255)
- node_count, node_ready, pod_count, etc.
- cpu_usage_percent, memory_usage_percent: NUMERIC(5,2)
- updated_at: TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

## Backup and Restore

### Backup

```bash
# Using Docker Compose
docker-compose exec postgres pg_dump -U logpilot logpilot > backup.sql

# Using local PostgreSQL
pg_dump -h localhost -U logpilot logpilot > backup.sql
```

### Restore

```bash
# Using Docker Compose
docker-compose exec -T postgres psql -U logpilot logpilot < backup.sql

# Using local PostgreSQL
psql -h localhost -U logpilot logpilot < backup.sql
```

## Troubleshooting

### PostgreSQL Connection Issues

1. Check if PostgreSQL is running:
   ```bash
   docker-compose ps postgres
   ```

2. Check PostgreSQL logs:
   ```bash
   docker-compose logs postgres
   ```

3. Test connection:
   ```bash
   docker-compose exec postgres psql -U logpilot -d logpilot -c "SELECT NOW();"
   ```

### Admin User Not Working

1. Verify the user was created:
   ```bash
   docker-compose exec postgres psql -U logpilot -d logpilot -c "SELECT id, email, name FROM users;"
   ```

2. Re-run seed script:
   ```bash
   docker-compose exec logpilot npm run db:seed
   ```

### Schema Issues

If you need to reset the database:

```bash
# Drop and recreate the database
docker-compose down -v  # This removes volumes!
docker-compose up -d
docker-compose exec logpilot npm run db:setup
docker-compose exec logpilot npm run db:seed
```

## Security Best Practices

1. **Change default passwords** - Never use default admin credentials in production
2. **Use strong JWT_SECRET** - Generate a random string for production
3. **Secure PostgreSQL** - Use strong passwords and restrict network access
4. **Regular backups** - Implement automated backup strategy
5. **SSL/TLS** - Use SSL connections for PostgreSQL in production
6. **Connection pooling** - The application uses connection pooling (max 20 connections)

## Performance Optimization

The database includes several indexes for optimal query performance:

- **Log queries**: Indexes on `system_id`, `timestamp`, `level`, `source`
- **Full-text search**: GIN index on log messages for fast text search
- **Cascading deletes**: Foreign keys with CASCADE for automatic cleanup

### Connection Pool Settings

The default connection pool is configured with:
- Max connections: 20
- Idle timeout: 30 seconds
- Connection timeout: 2 seconds

You can adjust these in `backend/src/db/database.js` if needed.
