# Migration Complete ✅

The user approval system has been successfully implemented and migrated!

## What Was Done

1. ✅ Database migration added `is_approved` and `is_admin` columns
2. ✅ Admin user created with full privileges
3. ✅ Backend routes updated to check approval status
4. ✅ Admin API endpoints created for user management

## Current Status

### Admin User
- **Email**: `admin@logpilot.local`
- **Password**: `admin123`
- **Status**: Active, Approved, Admin

### Database Schema
```sql
users table now includes:
- is_active: BOOLEAN (user account is active)
- is_approved: BOOLEAN (admin has approved user registration)
- is_admin: BOOLEAN (user has admin privileges)
```

## How It Works

### 1. User Registration
Anyone can register, but they need admin approval:

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "password123",
    "name": "New User"
  }'
```

Response: `201 Created` - User registered but not approved

### 2. User Login Attempt (Before Approval)
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "password123"
  }'
```

Response: `403 Forbidden`
```json
{
  "detail": "Your account is pending admin approval. Please wait for approval before logging in."
}
```

### 3. Admin Login
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@logpilot.local",
    "password": "admin123"
  }'
```

Response: `200 OK`
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

### 4. Admin Views Pending Users
```bash
curl http://localhost:8000/api/admin/users/pending \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

Response:
```json
[
  {
    "id": 2,
    "email": "newuser@example.com",
    "name": "New User",
    "created_at": "2025-11-27T19:45:00.000Z"
  }
]
```

### 5. Admin Approves User
```bash
curl -X POST http://localhost:8000/api/admin/users/2/approve \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

Response:
```json
{
  "message": "User approved successfully",
  "user": {
    "id": 2,
    "email": "newuser@example.com",
    "name": "New User",
    "is_approved": true
  }
}
```

### 6. User Can Now Login
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "password123"
  }'
```

Response: `200 OK` with access token ✅

## Admin API Endpoints

All require admin authentication (`Authorization: Bearer <admin-token>`):

### User Management
- `GET /api/admin/users` - List all users
- `GET /api/admin/users/pending` - List pending approvals
- `POST /api/admin/users/:id/approve` - Approve a user
- `DELETE /api/admin/users/:id` - Delete a user
- `POST /api/admin/users/:id/activate` - Activate a deactivated user
- `POST /api/admin/users/:id/deactivate` - Deactivate a user

### Testing Admin Endpoints

Get your admin token first:
```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@logpilot.local","password":"admin123"}' \
  | jq -r '.access_token')

echo "Admin token: $TOKEN"
```

Then use it:
```bash
# List all users
curl http://localhost:8000/api/admin/users \
  -H "Authorization: Bearer $TOKEN"

# List pending users
curl http://localhost:8000/api/admin/users/pending \
  -H "Authorization: Bearer $TOKEN"
```

## Running Migrations Again

If you need to run the migration again (it's idempotent):

```bash
docker compose exec logpilot npm run db:migrate
```

## Verifying Database State

Check users directly in the database:

```bash
docker compose exec postgres psql -U logpilot -d logpilot \
  -c "SELECT id, email, is_active, is_approved, is_admin FROM users;"
```

## Next Steps

1. **Change the admin password** - The default password should be changed
2. **Frontend Integration** - Add UI for:
   - Showing pending approval message on login
   - Admin panel to view/approve pending users
   - User status indicators
3. **Email Notifications** (optional) - Notify users when approved
4. **Custom Admin Roles** (optional) - Add different permission levels

## Troubleshooting

### Check if user is approved
```bash
docker compose exec postgres psql -U logpilot -d logpilot \
  -c "SELECT email, is_approved, is_admin FROM users WHERE email = 'user@example.com';"
```

### Manually approve a user
```bash
docker compose exec postgres psql -U logpilot -d logpilot \
  -c "UPDATE users SET is_approved = true WHERE email = 'user@example.com';"
```

### Make someone an admin
```bash
docker compose exec postgres psql -U logpilot -d logpilot \
  -c "UPDATE users SET is_admin = true WHERE email = 'user@example.com';"
```

## Files Changed

- `backend/src/db/database.js` - Added columns to schema
- `backend/src/db/init-postgres.sql` - Added columns to SQL schema
- `backend/src/db/seed.js` - Admin user includes approval/admin flags
- `backend/src/db/migrations/001_add_user_approval.js` - Migration script (NEW)
- `backend/src/routes/auth.js` - Login checks approval status
- `backend/src/routes/admin.js` - User management endpoints (NEW)
- `backend/src/middleware/auth.js` - Admin middleware (NEW)
- `backend/package.json` - Added `db:migrate` script
- `frontend/src/App.jsx` - Login uses JSON instead of form-urlencoded

All changes are backward compatible for existing users!
