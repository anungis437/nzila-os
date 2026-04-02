# syntax=docker/dockerfile:1.7

# ============================================
# Base stage - pnpm setup
# Use Debian slim for glibc-based OpenSSL 3 (Clerk middleware WebCrypto requires working legacy provider)
# Node.js 20 LTS — OpenSSL 3.0 WebCrypto is stable with Clerk JWT verification
# ============================================
FROM node:20-slim AS base

# Install wget for healthchecks (not included in slim by default)
RUN apt-get update && apt-get install -y --no-install-recommends wget && rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@10.11.0 --ignore-scripts

# ============================================
# Dependencies stage
# ============================================
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./

# Copy all workspace package.json files preserving directory structure.
# Uses COPY --parents (BuildKit 1.7+) so new apps/packages are picked up
# automatically — no need to add a COPY line per package.
COPY --parents apps/*/package.json ./
COPY --parents packages/*/package.json ./
COPY --parents services/*/package.json ./
COPY --parents tooling/*/package.json ./

# Override .npmrc — keep node-linker=hoisted (required for module resolution)
# but remove exFAT workarounds that are unnecessary on ext4
RUN echo 'node-linker=hoisted' > .npmrc

# Install dependencies — --ignore-scripts skips prepare/lefthook (no git in build env)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --ignore-scripts

# ============================================
# Builder stage
# ============================================
FROM base AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps ./apps
COPY --from=deps /app/packages ./packages

# Copy source code
COPY . .

# Build args for Clerk (with defaults for builds without actual keys)
# Placeholder must be valid base64 format or Clerk SDK rejects it at SSG prerender time
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_cGxhY2Vob2xkZXIuY2xlcmsuYWNjb3VudHMuZGV2JA
ARG CLERK_SECRET_KEY=sk_test_build_placeholder
ARG NEXT_PUBLIC_CLERK_IS_SATELLITE=false
ARG NEXT_PUBLIC_CLERK_DOMAIN=
ARG NEXT_PUBLIC_CLERK_SIGN_IN_URL=

# Build args for cross-app navigation URLs (baked into Next.js client bundle)
ARG NEXT_PUBLIC_WEB_URL=https://nzila-os-web.delightfulisland-0d503d3c.eastus.azurecontainerapps.io
ARG NEXT_PUBLIC_CONSOLE_URL=https://nzila-os-console.delightfulisland-0d503d3c.eastus.azurecontainerapps.io
ARG NEXT_PUBLIC_PARTNERS_URL=https://nzila-os-partners.delightfulisland-0d503d3c.eastus.azurecontainerapps.io
ARG NEXT_PUBLIC_UNION_EYES_URL=https://nzila-os-union-eyes.delightfulisland-0d503d3c.eastus.azurecontainerapps.io
ARG NEXT_PUBLIC_ABR_URL=https://nzila-os-abr.delightfulisland-0d503d3c.eastus.azurecontainerapps.io
ARG NEXT_PUBLIC_CFO_URL=https://nzila-os-cfo.delightfulisland-0d503d3c.eastus.azurecontainerapps.io

# Set as env vars for build
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV CLERK_SECRET_KEY=$CLERK_SECRET_KEY
ENV NEXT_PUBLIC_CLERK_IS_SATELLITE=$NEXT_PUBLIC_CLERK_IS_SATELLITE
ENV NEXT_PUBLIC_CLERK_DOMAIN=$NEXT_PUBLIC_CLERK_DOMAIN
ENV NEXT_PUBLIC_CLERK_SIGN_IN_URL=$NEXT_PUBLIC_CLERK_SIGN_IN_URL
ENV NEXT_PUBLIC_WEB_URL=$NEXT_PUBLIC_WEB_URL
ENV NEXT_PUBLIC_CONSOLE_URL=$NEXT_PUBLIC_CONSOLE_URL
ENV NEXT_PUBLIC_PARTNERS_URL=$NEXT_PUBLIC_PARTNERS_URL
ENV NEXT_PUBLIC_UNION_EYES_URL=$NEXT_PUBLIC_UNION_EYES_URL
ENV NEXT_PUBLIC_ABR_URL=$NEXT_PUBLIC_ABR_URL
ENV NEXT_PUBLIC_CFO_URL=$NEXT_PUBLIC_CFO_URL

# Build only apps that have deps installed in the Docker image (turbo filters)
# Default: all apps. Override via --build-arg TURBO_FILTER for single-app builds.
ARG TURBO_FILTER="--filter=@nzila/web --filter=@nzila/console --filter=@nzila/partners --filter=@nzila/union-eyes --filter=@nzila/abr --filter=@nzila/orchestrator-api --filter=@nzila/cfo --filter=@nzila/zonga --filter=@nzila/flow --filter=@nzila/agrimo --filter=@nzila/cora --filter=@nzila/trade --filter=@nzila/mobility --filter=@nzila/mobility-client-portal --filter=@nzila/control-plane --filter=@nzila/platform-admin --filter=@nzila/nacp-exams"
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN pnpm turbo build ${TURBO_FILTER} --concurrency=1
# ============================================
# Web production stage
# ============================================
FROM base AS web
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Copy necessary files
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/content ./content

# Create non-root user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --no-create-home nextjs && \
    chown -R nextjs:nodejs /app

USER nextjs

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

EXPOSE 3000

CMD ["node", "apps/web/server.js"]

# ============================================
# Console production stage
# ============================================
FROM base AS console
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001

# Copy necessary files
COPY --from=builder /app/apps/console/.next/standalone ./
COPY --from=builder /app/apps/console/.next/static ./apps/console/.next/static
COPY --from=builder /app/content ./content

# Create non-root user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --no-create-home nextjs && \
    chown -R nextjs:nodejs /app

USER nextjs

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/ || exit 1

EXPOSE 3001

CMD ["node", "apps/console/server.js"]

# ============================================
# Partners production stage
# ============================================
FROM base AS partners
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3002

# Copy necessary files
COPY --from=builder /app/apps/partners/.next/standalone ./
COPY --from=builder /app/apps/partners/.next/static ./apps/partners/.next/static
COPY --from=builder /app/content ./content

# Create non-root user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --no-create-home nextjs && \
    chown -R nextjs:nodejs /app

USER nextjs

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3002/ || exit 1

EXPOSE 3002

CMD ["node", "apps/partners/server.js"]

# ============================================
# Union Eyes production stage
# ============================================
FROM base AS union-eyes
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3003

# Copy necessary files
COPY --from=builder /app/apps/union-eyes/.next/standalone ./
COPY --from=builder /app/apps/union-eyes/.next/static ./apps/union-eyes/.next/static
COPY --from=builder /app/apps/union-eyes/public ./apps/union-eyes/public
COPY --from=builder /app/apps/union-eyes/messages ./apps/union-eyes/messages
COPY --from=builder /app/content ./content

# Create non-root user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --no-create-home nextjs && \
    chown -R nextjs:nodejs /app

USER nextjs

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3003/ || exit 1

EXPOSE 3003

CMD ["node", "apps/union-eyes/server.js"]

# ============================================
# ABR production stage
# ============================================
FROM base AS abr
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3004

# Copy necessary files
COPY --from=builder /app/apps/abr/.next/standalone ./
COPY --from=builder /app/apps/abr/.next/static ./apps/abr/.next/static
COPY --from=builder /app/content ./content

# Create non-root user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --no-create-home nextjs && \
    chown -R nextjs:nodejs /app

USER nextjs

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3004/ || exit 1

EXPOSE 3004

CMD ["node", "apps/abr/server.js"]

# ============================================
# Orchestrator API production stage
# ============================================
FROM base AS orchestrator-api
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Copy workspace root + orchestrator source from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder /app/apps/orchestrator-api ./apps/orchestrator-api
COPY --from=builder /app/packages/db ./packages/db
COPY --from=builder /app/packages/config ./packages/config

# Create non-root user
RUN groupadd --system --gid 1001 nzila && \
    useradd --system --uid 1001 --no-create-home orchestrator && \
    chown -R orchestrator:nzila /app

USER orchestrator

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

EXPOSE 4000

CMD ["pnpm", "--filter", "@nzila/orchestrator-api", "start"]

# ============================================
# CFO production stage
# ============================================
FROM base AS cfo
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3005

# Copy necessary files
COPY --from=builder /app/apps/cfo/.next/standalone ./
COPY --from=builder /app/apps/cfo/.next/static ./apps/cfo/.next/static
COPY --from=builder /app/content ./content

# Create non-root user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --no-create-home nextjs && \
    chown -R nextjs:nodejs /app

USER nextjs

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3005/ || exit 1

EXPOSE 3005

CMD ["node", "apps/cfo/server.js"]

# ============================================
# Zonga production stage
# ============================================
FROM base AS zonga
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3006

# Copy necessary files
COPY --from=builder /app/apps/zonga/.next/standalone ./
COPY --from=builder /app/apps/zonga/.next/static ./apps/zonga/.next/static
COPY --from=builder /app/apps/zonga/messages ./apps/zonga/messages
COPY --from=builder /app/content ./content

# Create non-root user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --no-create-home nextjs && \
    chown -R nextjs:nodejs /app

USER nextjs

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3006/api/health || exit 1

EXPOSE 3006

CMD ["node", "apps/zonga/server.js"]

# ============================================
# Flow production stage
# ============================================
FROM base AS flow
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3007

COPY --from=builder /app/apps/flow/.next/standalone ./
COPY --from=builder /app/apps/flow/.next/static ./apps/flow/.next/static
COPY --from=builder /app/apps/flow/messages ./apps/flow/messages
COPY --from=builder /app/content ./content

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --no-create-home nextjs && \
    chown -R nextjs:nodejs /app

USER nextjs

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3007/ || exit 1

EXPOSE 3007

CMD ["node", "apps/flow/server.js"]

# ============================================
# Agrimo production stage
# ============================================
FROM base AS agrimo
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3008

COPY --from=builder /app/apps/agrimo/.next/standalone ./
COPY --from=builder /app/apps/agrimo/.next/static ./apps/agrimo/.next/static
COPY --from=builder /app/apps/agrimo/messages ./apps/agrimo/messages
COPY --from=builder /app/content ./content

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --no-create-home nextjs && \
    chown -R nextjs:nodejs /app

USER nextjs

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3008/ || exit 1

EXPOSE 3008

CMD ["node", "apps/agrimo/server.js"]

# ============================================
# Cora production stage
# ============================================
FROM base AS cora
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3009

COPY --from=builder /app/apps/cora/.next/standalone ./
COPY --from=builder /app/apps/cora/.next/static ./apps/cora/.next/static
COPY --from=builder /app/apps/cora/messages ./apps/cora/messages
COPY --from=builder /app/content ./content

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --no-create-home nextjs && \
    chown -R nextjs:nodejs /app

USER nextjs

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3009/ || exit 1

EXPOSE 3009

CMD ["node", "apps/cora/server.js"]

# ============================================
# Trade production stage
# ============================================
FROM base AS trade
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3010

COPY --from=builder /app/apps/trade/.next/standalone ./
COPY --from=builder /app/apps/trade/.next/static ./apps/trade/.next/static
COPY --from=builder /app/apps/trade/messages ./apps/trade/messages
COPY --from=builder /app/content ./content

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --no-create-home nextjs && \
    chown -R nextjs:nodejs /app

USER nextjs

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3010/ || exit 1

EXPOSE 3010

CMD ["node", "apps/trade/server.js"]

# ============================================
# Mobility production stage
# ============================================
FROM base AS mobility
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3011

COPY --from=builder /app/apps/mobility/.next/standalone ./
COPY --from=builder /app/apps/mobility/.next/static ./apps/mobility/.next/static
COPY --from=builder /app/apps/mobility/messages ./apps/mobility/messages
COPY --from=builder /app/content ./content

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --no-create-home nextjs && \
    chown -R nextjs:nodejs /app

USER nextjs

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3011/ || exit 1

EXPOSE 3011

CMD ["node", "apps/mobility/server.js"]

# ============================================
# Mobility Client Portal production stage
# ============================================
FROM base AS mobility-client-portal
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3012

COPY --from=builder /app/apps/mobility-client-portal/.next/standalone ./
COPY --from=builder /app/apps/mobility-client-portal/.next/static ./apps/mobility-client-portal/.next/static
COPY --from=builder /app/apps/mobility-client-portal/messages ./apps/mobility-client-portal/messages
COPY --from=builder /app/content ./content

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --no-create-home nextjs && \
    chown -R nextjs:nodejs /app

USER nextjs

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3012/ || exit 1

EXPOSE 3012

CMD ["node", "apps/mobility-client-portal/server.js"]

# ============================================
# Control Plane production stage
# ============================================
FROM base AS control-plane
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3013

COPY --from=builder /app/apps/control-plane/.next/standalone ./
COPY --from=builder /app/apps/control-plane/.next/static ./apps/control-plane/.next/static
COPY --from=builder /app/apps/control-plane/messages ./apps/control-plane/messages
COPY --from=builder /app/content ./content

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --no-create-home nextjs && \
    chown -R nextjs:nodejs /app

USER nextjs

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3013/ || exit 1

EXPOSE 3013

CMD ["node", "apps/control-plane/server.js"]

# ============================================
# Platform Admin production stage
# ============================================
FROM base AS platform-admin
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3014

COPY --from=builder /app/apps/platform-admin/.next/standalone ./
COPY --from=builder /app/apps/platform-admin/.next/static ./apps/platform-admin/.next/static
COPY --from=builder /app/apps/platform-admin/messages ./apps/platform-admin/messages
COPY --from=builder /app/content ./content

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --no-create-home nextjs && \
    chown -R nextjs:nodejs /app

USER nextjs

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3014/ || exit 1

EXPOSE 3014

CMD ["node", "apps/platform-admin/server.js"]

# ============================================
# NACP Exams production stage
# ============================================
FROM base AS nacp-exams
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3015

COPY --from=builder /app/apps/nacp-exams/.next/standalone ./
COPY --from=builder /app/apps/nacp-exams/.next/static ./apps/nacp-exams/.next/static
COPY --from=builder /app/apps/nacp-exams/messages ./apps/nacp-exams/messages
COPY --from=builder /app/content ./content

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --no-create-home nextjs && \
    chown -R nextjs:nodejs /app

USER nextjs

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3015/ || exit 1

EXPOSE 3015

CMD ["node", "apps/nacp-exams/server.js"]

# ============================================
# Dev stage - for development with hot reload
# ============================================
FROM base AS dev
WORKDIR /app

# Ensure root node_modules/.bin is always on PATH (needed for turbo, tsx, etc.)
ENV PATH="/app/node_modules/.bin:$PATH"

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./

# Copy all workspace package.json files (same wildcard approach as deps stage)
COPY --parents apps/*/package.json ./
COPY --parents packages/*/package.json ./
COPY --parents services/*/package.json ./
COPY --parents tooling/*/package.json ./

# Override .npmrc — keep node-linker=hoisted (required for module resolution)
# but remove exFAT workarounds that are unnecessary on ext4
RUN echo 'node-linker=hoisted' > .npmrc

# Install dependencies — --ignore-scripts skips prepare/lefthook (no git in build env)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --ignore-scripts

COPY . .

EXPOSE 3000 3001 3002 3003 3004

# Run only the web/app packages — cli and orchestrator-api are excluded from web dev
CMD ["pnpm", "dev:docker"]
