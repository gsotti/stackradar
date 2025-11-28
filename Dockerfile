# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package.json frontend/yarn.lock ./
RUN corepack enable && yarn install --frozen-lockfile
COPY frontend/ ./
RUN yarn build

# Stage 2: Build Backend
FROM node:20-alpine AS backend-builder

WORKDIR /app/backend
COPY backend/package.json backend/yarn.lock ./
RUN corepack enable && yarn install --frozen-lockfile
COPY backend/src ./src
COPY backend/tsconfig.json ./
RUN yarn build

# Stage 3: Production Image
FROM node:20-alpine

WORKDIR /app

# Install security updates
RUN apk update && apk upgrade && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Copy backend compiled code and dependencies
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/node_modules ./node_modules
COPY backend/package.json ./
COPY backend/src/db/migrations ./dist/db/migrations

# Copy frontend build
COPY --from=frontend-builder /app/frontend/dist ./static

# Create data directory
RUN mkdir -p /app/data && chown -R nodejs:nodejs /app

USER nodejs

# Environment variables
ENV NODE_ENV=production
ENV PORT=8000
ENV STATIC_PATH=/app/static

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8000/api/health || exit 1

CMD ["node", "dist/index.js"]
