# syntax=docker/dockerfile:1

# ---- Base ----
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ---- Dependencies (all, for building) ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- Build ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Caps the build's heap so low-memory hosts (e.g. a Raspberry Pi) don't OOM.
# Override with --build-arg BUILD_MEMORY_MB=... on bigger machines.
ARG BUILD_MEMORY_MB=1536
RUN NODE_OPTIONS="--max-old-space-size=${BUILD_MEMORY_MB}" npm run build

# ---- Production dependencies only ----
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---- Runtime ----
FROM base AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S nodejs -g 1001 && adduser -S nextjs -u 1001 -G nodejs

COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Tournament snapshots are read at runtime via process.cwd()/data
COPY --from=builder --chown=nextjs:nodejs /app/data ./data
COPY --from=builder --chown=nextjs:nodejs /app/package.json /app/next.config.ts ./

USER nextjs

EXPOSE 3000

# Railway injects PORT; `next start` picks it up from the environment.
CMD ["sh", "-c", "node_modules/.bin/next start -H 0.0.0.0 -p ${PORT:-3000}"]
