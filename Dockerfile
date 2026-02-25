# Multi-stage Dockerfile for Backend template
# Stage 1: Build stage with all dependencies
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install system dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && ln -sf python3 /usr/bin/python

# Copy package files for dependency installation
# This is done first to leverage Docker layer caching
COPY package.json yarn.lock ./

# Install all dependencies (including devDependencies)
RUN yarn install --frozen-lockfile --network-timeout 300000

# Copy source code and configuration files
COPY . .

# Build the application
RUN yarn build

# Remove development dependencies to reduce size
RUN yarn install --production --frozen-lockfile --network-timeout 300000 && \
    yarn cache clean

# Stage 2: Production stage with minimal runtime
FROM node:18-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Set working directory
WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy production dependencies from builder stage
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules

# Copy built application from builder stage
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Copy package.json for runtime metadata
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./

# Copy any additional runtime files if needed
# COPY --from=builder --chown=nestjs:nodejs /app/drizzle ./drizzle

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8000

# Expose the application port
EXPOSE 8000

# Switch to non-root user
USER nestjs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/main.js"]