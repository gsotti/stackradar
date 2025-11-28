# User Approval System

LogPilot now includes an admin approval system for new user registrations.

## How It Works

1. **User Registration**: Anyone can register for an account, but they cannot log in immediately
2. **Pending Approval**: New users are created with `is_approved = false`
3. **Admin Approval**: An admin must approve the user before they can log in
4. **Access Granted**: Once approved, users can log in normally

## Admin Account

The first admin user is created when you run the seed script:

```bash
docker compose exec logpilot npm run db:seed
```

Default admin credentials:
- **Email**: `admin@logpilot.local`
- **Password**: `admin123`

⚠️ **Change these credentials after first login!**

## API Endpoints

### User Management (Admin Only)

All admin endpoints require authentication with a Bearer token from an admin user.

#### Get All Users
```bash
GET /api/admin/users
Authorization: Bearer <admin-token>
```

Response:
```json
[
  {
    "id": 1,
    "email": "user@example.com",
    "name": "User Name",
    "is_active": true,
    "is_approved": false,
    "is_admin": false,
    "created_at": "2025-11-27T..."
  }
]
```

#### Get Pending Users
```bash
GET /api/admin/users/pending
Authorization: Bearer <admin-token>
```

Response:
```json
[
  {
    "id": 2,
    "email": "newuser@example.com",
    "name": "New User",
    "created_at": "2025-11-27T..."
  }
]
```

#### Approve User
```bash
POST /api/admin/users/:id/approve
Authorization: Bearer <admin-token>
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

#### Reject User (Delete)
```bash
DELETE /api/admin/users/:id
Authorization: Bearer <admin-token>
```

Response:
```json
{
  "message": "User newuser@example.com deleted successfully"
}
```

#### Deactivate User
```bash
POST /api/admin/users/:id/deactivate
Authorization: Bearer <admin-token>
```

Deactivated users cannot log in but their data is preserved.

#### Activate User
```bash
POST /api/admin/users/:id/activate
Authorization: Bearer <admin-token>
```

Re-enables a deactivated user.

## Login Flow

When a user attempts to log in:

1. **Invalid Credentials**: Returns `401 Unauthorized` with message "Invalid email or password"
2. **Pending Approval**: Returns `403 Forbidden` with message "Your account is pending admin approval. Please wait for approval before logging in."
3. **Deactivated**: Returns `403 Forbidden` with message "Your account has been deactivated. Please contact an administrator."
4. **Success**: Returns access token

## Database Schema

The users table includes:

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,      -- User account is active
  is_approved BOOLEAN DEFAULT FALSE,   -- Admin has approved the user
  is_admin BOOLEAN DEFAULT FALSE,      -- User has admin privileges
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Security Notes

1. **Admin Protection**: Admins cannot delete or deactivate their own account
2. **Token-Based Auth**: All admin endpoints require JWT authentication
3. **Separate Admin Key**: The cleanup endpoint uses a separate admin API key
4. **Password Hashing**: All passwords are hashed with bcrypt

## Example Workflow

### 1. New User Registers
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "password123",
    "name": "New User"
  }'
```

### 2. User Tries to Log In (Fails)
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "password123"
  }'
```

Response: `403 Forbidden` - "Your account is pending admin approval..."

### 3. Admin Logs In
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@logpilot.local",
    "password": "admin123"
  }'
```

Response:
```json
{
  "access_token": "eyJhbG...",
  "token_type": "bearer"
}
```

### 4. Admin Views Pending Users
```bash
curl http://localhost:8000/api/admin/users/pending \
  -H "Authorization: Bearer eyJhbG..."
```

### 5. Admin Approves User
```bash
curl -X POST http://localhost:8000/api/admin/users/2/approve \
  -H "Authorization: Bearer eyJhbG..."
```

### 6. User Can Now Log In
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "password123"
  }'
```

Response: Success with access token!

## Frontend Integration

The frontend should:

1. Show appropriate error messages based on login response status
2. Display an "Admin" section only for admin users (check `is_admin` from `/api/auth/me`)
3. Provide UI for viewing pending users
4. Provide approve/reject buttons for each pending user
5. Show user status (active, approved, admin) in user management

Check the user's admin status after login:
```javascript
const res = await fetch('/api/auth/me', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const user = await res.json();

if (user.is_admin) {
  // Show admin panel
}
```
