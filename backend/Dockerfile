FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules (bytenode)
RUN apk add --no-cache python3 make g++

# Enable corepack for yarn
RUN corepack enable

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript and compile to bytecode
RUN yarn build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache tini && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Enable corepack
RUN corepack enable

# Copy package files
COPY package.json yarn.lock ./

# Install production dependencies only
RUN yarn install --frozen-lockfile --production

# Copy compiled code from builder
COPY --from=builder /app/dist ./dist

# Copy migrations
COPY src/db/migrations ./dist/db/migrations

# Create data directory
RUN mkdir -p /app/data && chown -R nodejs:nodejs /app

USER nodejs

# Environment variables
ENV NODE_ENV=production
ENV PORT=8000

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/startup.js"]
