# TypeScript Migration Guide

This guide explains how to convert LogPilot backend from JavaScript to TypeScript.

## Status

✅ **Configuration Ready** - TypeScript config and dependencies added
✅ **Type Definitions Created** - Core types defined in `src/types/index.ts`
⏳ **Files to Convert** - 12 JavaScript files need conversion

## Prerequisites

```bash
cd backend
yarn install  # Install TypeScript and type definitions
```

## File Conversion Checklist

### Core Files
- [ ] `src/index.js` → `src/index.ts`
- [ ] `src/db/database.js` → `src/db/database.ts` ✅ DONE
- [ ] `src/db/migrate.js` → `src/db/migrate.ts`
- [ ] `src/db/seed.js` → `src/db/seed.ts`

### Middleware
- [ ] `src/middleware/auth.js` → `src/middleware/auth.ts`

### Routes
- [ ] `src/routes/admin.js` → `src/routes/admin.ts`
- [ ] `src/routes/auth.js` → `src/routes/auth.ts`
- [ ] `src/routes/ingest.js` → `src/routes/ingest.ts`
- [ ] `src/routes/k8s.js` → `src/routes/k8s.ts`
- [ ] `src/routes/logs.js` → `src/routes/logs.ts`
- [ ] `src/routes/systems.js` → `src/routes/systems.ts`

### Services
- [ ] `src/services/cleanup.js` → `src/services/cleanup.ts`

## Conversion Pattern

### 1. Change File Extension
```bash
mv src/file.js src/file.ts
```

### 2. Add Type Imports
```typescript
import { Request, Response, NextFunction } from 'express';
import { User, AuthRequest } from '../types/index.js';
```

### 3. Add Type Annotations

**Before (JavaScript):**
```javascript
export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  // ...
}
```

**After (TypeScript):**
```typescript
export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  // ...
}
```

### 4. Type Function Parameters and Return Values

**Before:**
```javascript
export function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}
```

**After:**
```typescript
export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}
```

### 5. Type Database Results

**Before:**
```javascript
const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
const user = result.rows[0];
```

**After:**
```typescript
const result = await db.query<User>(
  'SELECT * FROM users WHERE email = $1',
  [email]
);
const user = result.rows[0];
```

## Example Conversions

### Example 1: Middleware (auth.ts)

```typescript
import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { AuthRequest, JWTPayload } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function generateToken(userId: number): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): number | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded.sub;
  } catch {
    return null;
  }
}

export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ detail: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.substring(7);
  const userId = verifyToken(token);

  if (!userId) {
    res.status(401).json({ detail: 'Invalid or expired token' });
    return;
  }

  req.userId = userId;
  next();
}
```

### Example 2: Route (auth.ts)

```typescript
import { Router, Request, Response } from 'express';
import db from '../db/database.js';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  authMiddleware
} from '../middleware/auth.js';
import {
  RegisterRequest,
  LoginRequest,
  LoginResponse,
  User,
  AuthRequest
} from '../types/index.js';

const router = Router();

// Register
router.post('/register', async (req: Request<{}, {}, RegisterRequest>, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      res.status(400).json({ detail: 'Email and password are required' });
      return;
    }

    const existing = await db.query<User>(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      res.status(400).json({ detail: 'Email already registered' });
      return;
    }

    const passwordHash = hashPassword(password);

    const result = await db.query<User>(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, is_active, created_at',
      [email, passwordHash, name || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Login
router.post('/login', async (req: Request<{}, LoginResponse, LoginRequest>, res: Response<LoginResponse | { detail: string }>) => {
  try {
    const email = req.body.username || req.body.email;
    const password = req.body.password;

    if (!email || !password) {
      res.status(400).json({ detail: 'Email and password are required' });
      return;
    }

    const result = await db.query<User>(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    const user = result.rows[0];

    if (!user || !verifyPassword(password, user.password_hash)) {
      res.status(401).json({ detail: 'Invalid email or password' });
      return;
    }

    if (!user.is_approved) {
      res.status(403).json({
        detail: 'Your account is pending admin approval. Please wait for approval before logging in.'
      });
      return;
    }

    if (!user.is_active) {
      res.status(403).json({
        detail: 'Your account has been deactivated. Please contact an administrator.'
      });
      return;
    }

    const token = generateToken(user.id);

    res.json({
      access_token: token,
      token_type: 'bearer'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await db.query<User>(
      'SELECT id, email, name, is_active, is_admin, created_at FROM users WHERE id = $1',
      [req.userId]
    );

    const user = result.rows[0];

    if (!user) {
      res.status(404).json({ detail: 'User not found' });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

export default router;
```

## Common TypeScript Patterns

### 1. Async Route Handlers
```typescript
router.get('/path', async (req: Request, res: Response): Promise<void> => {
  // Always use Promise<void> for async route handlers
  // Use res.json() to send response, don't return
});
```

### 2. Type-safe Database Queries
```typescript
interface UserRow {
  id: number;
  email: string;
}

const result = await db.query<UserRow>('SELECT id, email FROM users');
const users: UserRow[] = result.rows;
```

### 3. Request Type Parameters
```typescript
// Request<Params, ResBody, ReqBody, Query>
router.post('/users/:id', async (
  req: Request<{ id: string }, {}, { name: string }>,
  res: Response
) => {
  const userId = parseInt(req.params.id);
  const { name } = req.body;
});
```

### 4. Error Handling with Types
```typescript
try {
  // code
} catch (error) {
  if (error instanceof Error) {
    console.error('Error:', error.message);
  }
  res.status(500).json({ detail: 'Internal server error' });
}
```

## Building and Running

### Development
```bash
yarn dev  # Uses tsx watch mode
```

### Production Build
```bash
yarn build  # Compiles to dist/
yarn start  # Runs compiled code
```

## Dockerfile Updates

Update your Dockerfile to build TypeScript:

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app/backend
COPY backend/package.json backend/yarn.lock ./
RUN corepack enable && yarn install --frozen-lockfile

COPY backend/src ./src
COPY backend/tsconfig.json ./
RUN yarn build

# Production stage
FROM node:20-alpine

WORKDIR /app
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/node_modules ./node_modules
COPY backend/package.json ./

CMD ["node", "dist/index.js"]
```

## Migration Script

Create a bash script to help with conversion:

```bash
#!/bin/bash
# convert-to-ts.sh

for file in src/**/*.js; do
  if [ -f "$file" ]; then
    ts_file="${file%.js}.ts"
    echo "Converting $file to $ts_file"
    mv "$file" "$ts_file"
  fi
done

echo "Done! Now add type annotations to all .ts files"
```

## Testing After Conversion

1. **Type Check**
   ```bash
   yarn tsc --noEmit
   ```

2. **Run Development Server**
   ```bash
   yarn dev
   ```

3. **Build Production**
   ```bash
   yarn build
   yarn start
   ```

4. **Test Migrations**
   ```bash
   yarn db:migrate
   ```

## Benefits of TypeScript

✅ **Type Safety** - Catch errors at compile time
✅ **Better IDE Support** - Autocomplete and IntelliSense
✅ **Self-Documenting** - Types serve as documentation
✅ **Refactoring** - Easier to refactor with confidence
✅ **Fewer Runtime Errors** - Type checking prevents many bugs

## Next Steps

1. Convert all `.js` files to `.ts`
2. Add type annotations to all functions
3. Fix any type errors with `npx tsc`
4. Update Dockerfile
5. Test thoroughly
6. Update documentation

This migration is a significant undertaking but will greatly improve code quality and maintainability!
