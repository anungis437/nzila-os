# syntax=docker/dockerfile:1

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

# Apps
COPY apps/abr/package.json ./apps/abr/
COPY apps/cfo/package.json ./apps/cfo/
COPY apps/console/package.json ./apps/console/
COPY apps/cora/package.json ./apps/cora/
COPY apps/nacp-exams/package.json ./apps/nacp-exams/
COPY apps/orchestrator-api/package.json ./apps/orchestrator-api/
COPY apps/partners/package.json ./apps/partners/
COPY apps/pondu/package.json ./apps/pondu/
COPY apps/trade/package.json ./apps/trade/
COPY apps/union-eyes/package.json ./apps/union-eyes/
COPY apps/web/package.json ./apps/web/
COPY apps/zonga/package.json ./apps/zonga/

# Packages
COPY packages/agri-adapters/package.json ./packages/agri-adapters/
COPY packages/agri-core/package.json ./packages/agri-core/
COPY packages/agri-db/package.json ./packages/agri-db/
COPY packages/agri-events/package.json ./packages/agri-events/
COPY packages/agri-intelligence/package.json ./packages/agri-intelligence/
COPY packages/agri-traceability/package.json ./packages/agri-traceability/
COPY packages/ai-core/package.json ./packages/ai-core/
COPY packages/ai-sdk/package.json ./packages/ai-sdk/
COPY packages/blob/package.json ./packages/blob/
COPY packages/chatops-slack/package.json ./packages/chatops-slack/
COPY packages/chatops-teams/package.json ./packages/chatops-teams/
COPY packages/cli/package.json ./packages/cli/
COPY packages/commerce-audit/package.json ./packages/commerce-audit/
COPY packages/commerce-core/package.json ./packages/commerce-core/
COPY packages/commerce-db/package.json ./packages/commerce-db/
COPY packages/commerce-events/package.json ./packages/commerce-events/
COPY packages/commerce-evidence/package.json ./packages/commerce-evidence/
COPY packages/commerce-governance/package.json ./packages/commerce-governance/
COPY packages/commerce-integration-tests/package.json ./packages/commerce-integration-tests/
COPY packages/commerce-observability/package.json ./packages/commerce-observability/
COPY packages/commerce-services/package.json ./packages/commerce-services/
COPY packages/commerce-state/package.json ./packages/commerce-state/
COPY packages/comms-email/package.json ./packages/comms-email/
COPY packages/comms-push/package.json ./packages/comms-push/
COPY packages/comms-sms/package.json ./packages/comms-sms/
COPY packages/config/package.json ./packages/config/
COPY packages/crm-hubspot/package.json ./packages/crm-hubspot/
COPY packages/data-lifecycle/package.json ./packages/data-lifecycle/
COPY packages/db/package.json ./packages/db/
COPY packages/evidence/package.json ./packages/evidence/
COPY packages/fx/package.json ./packages/fx/
COPY packages/integrations-core/package.json ./packages/integrations-core/
COPY packages/integrations-db/package.json ./packages/integrations-db/
COPY packages/integrations-runtime/package.json ./packages/integrations-runtime/
COPY packages/ml-core/package.json ./packages/ml-core/
COPY packages/ml-sdk/package.json ./packages/ml-sdk/
COPY packages/nacp-core/package.json ./packages/nacp-core/
COPY packages/org/package.json ./packages/org/
COPY packages/os-core/package.json ./packages/os-core/
COPY packages/payments-stripe/package.json ./packages/payments-stripe/
COPY packages/platform-assurance/package.json ./packages/platform-assurance/
COPY packages/platform-compliance-snapshots/package.json ./packages/platform-compliance-snapshots/
COPY packages/platform-cost/package.json ./packages/platform-cost/
COPY packages/platform-deploy/package.json ./packages/platform-deploy/
COPY packages/platform-events/package.json ./packages/platform-events/
COPY packages/platform-evidence-pack/package.json ./packages/platform-evidence-pack/
COPY packages/platform-export/package.json ./packages/platform-export/
COPY packages/platform-integrations-control-plane/package.json ./packages/platform-integrations-control-plane/
COPY packages/platform-isolation/package.json ./packages/platform-isolation/
COPY packages/platform-marketplace/package.json ./packages/platform-marketplace/
COPY packages/platform-metrics/package.json ./packages/platform-metrics/
COPY packages/platform-observability/package.json ./packages/platform-observability/
COPY packages/platform-ops/package.json ./packages/platform-ops/
COPY packages/platform-performance/package.json ./packages/platform-performance/
COPY packages/platform-policy-engine/package.json ./packages/platform-policy-engine/
COPY packages/platform-procurement-proof/package.json ./packages/platform-procurement-proof/
COPY packages/platform-proof/package.json ./packages/platform-proof/
COPY packages/platform-rfp-generator/package.json ./packages/platform-rfp-generator/
COPY packages/pricing-engine/package.json ./packages/pricing-engine/
COPY packages/qbo/package.json ./packages/qbo/
COPY packages/scripts-book/package.json ./packages/scripts-book/
COPY packages/tax/package.json ./packages/tax/
COPY packages/tools-runtime/package.json ./packages/tools-runtime/
COPY packages/trade-adapters/package.json ./packages/trade-adapters/
COPY packages/trade-cars/package.json ./packages/trade-cars/
COPY packages/trade-core/package.json ./packages/trade-core/
COPY packages/trade-db/package.json ./packages/trade-db/
COPY packages/ui/package.json ./packages/ui/
COPY packages/webhooks/package.json ./packages/webhooks/
COPY packages/zonga-core/package.json ./packages/zonga-core/

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
ARG TURBO_FILTER="--filter=@nzila/web --filter=@nzila/console --filter=@nzila/partners --filter=@nzila/union-eyes --filter=@nzila/abr --filter=@nzila/orchestrator-api --filter=@nzila/cfo"
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
# Dev stage - for development with hot reload
# ============================================
FROM base AS dev
WORKDIR /app

# Ensure root node_modules/.bin is always on PATH (needed for turbo, tsx, etc.)
ENV PATH="/app/node_modules/.bin:$PATH"

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./

# Apps
COPY apps/abr/package.json ./apps/abr/
COPY apps/cfo/package.json ./apps/cfo/
COPY apps/console/package.json ./apps/console/
COPY apps/cora/package.json ./apps/cora/
COPY apps/nacp-exams/package.json ./apps/nacp-exams/
COPY apps/orchestrator-api/package.json ./apps/orchestrator-api/
COPY apps/partners/package.json ./apps/partners/
COPY apps/pondu/package.json ./apps/pondu/
COPY apps/trade/package.json ./apps/trade/
COPY apps/union-eyes/package.json ./apps/union-eyes/
COPY apps/web/package.json ./apps/web/
COPY apps/zonga/package.json ./apps/zonga/

# Packages
COPY packages/agri-adapters/package.json ./packages/agri-adapters/
COPY packages/agri-core/package.json ./packages/agri-core/
COPY packages/agri-db/package.json ./packages/agri-db/
COPY packages/agri-events/package.json ./packages/agri-events/
COPY packages/agri-intelligence/package.json ./packages/agri-intelligence/
COPY packages/agri-traceability/package.json ./packages/agri-traceability/
COPY packages/ai-core/package.json ./packages/ai-core/
COPY packages/ai-sdk/package.json ./packages/ai-sdk/
COPY packages/blob/package.json ./packages/blob/
COPY packages/chatops-slack/package.json ./packages/chatops-slack/
COPY packages/chatops-teams/package.json ./packages/chatops-teams/
COPY packages/cli/package.json ./packages/cli/
COPY packages/commerce-audit/package.json ./packages/commerce-audit/
COPY packages/commerce-core/package.json ./packages/commerce-core/
COPY packages/commerce-db/package.json ./packages/commerce-db/
COPY packages/commerce-events/package.json ./packages/commerce-events/
COPY packages/commerce-evidence/package.json ./packages/commerce-evidence/
COPY packages/commerce-governance/package.json ./packages/commerce-governance/
COPY packages/commerce-integration-tests/package.json ./packages/commerce-integration-tests/
COPY packages/commerce-observability/package.json ./packages/commerce-observability/
COPY packages/commerce-services/package.json ./packages/commerce-services/
COPY packages/commerce-state/package.json ./packages/commerce-state/
COPY packages/comms-email/package.json ./packages/comms-email/
COPY packages/comms-push/package.json ./packages/comms-push/
COPY packages/comms-sms/package.json ./packages/comms-sms/
COPY packages/config/package.json ./packages/config/
COPY packages/crm-hubspot/package.json ./packages/crm-hubspot/
COPY packages/data-lifecycle/package.json ./packages/data-lifecycle/
COPY packages/db/package.json ./packages/db/
COPY packages/evidence/package.json ./packages/evidence/
COPY packages/fx/package.json ./packages/fx/
COPY packages/integrations-core/package.json ./packages/integrations-core/
COPY packages/integrations-db/package.json ./packages/integrations-db/
COPY packages/integrations-runtime/package.json ./packages/integrations-runtime/
COPY packages/ml-core/package.json ./packages/ml-core/
COPY packages/ml-sdk/package.json ./packages/ml-sdk/
COPY packages/nacp-core/package.json ./packages/nacp-core/
COPY packages/org/package.json ./packages/org/
COPY packages/os-core/package.json ./packages/os-core/
COPY packages/payments-stripe/package.json ./packages/payments-stripe/
COPY packages/platform-assurance/package.json ./packages/platform-assurance/
COPY packages/platform-compliance-snapshots/package.json ./packages/platform-compliance-snapshots/
COPY packages/platform-cost/package.json ./packages/platform-cost/
COPY packages/platform-deploy/package.json ./packages/platform-deploy/
COPY packages/platform-events/package.json ./packages/platform-events/
COPY packages/platform-evidence-pack/package.json ./packages/platform-evidence-pack/
COPY packages/platform-export/package.json ./packages/platform-export/
COPY packages/platform-integrations-control-plane/package.json ./packages/platform-integrations-control-plane/
COPY packages/platform-isolation/package.json ./packages/platform-isolation/
COPY packages/platform-marketplace/package.json ./packages/platform-marketplace/
COPY packages/platform-metrics/package.json ./packages/platform-metrics/
COPY packages/platform-observability/package.json ./packages/platform-observability/
COPY packages/platform-ops/package.json ./packages/platform-ops/
COPY packages/platform-performance/package.json ./packages/platform-performance/
COPY packages/platform-policy-engine/package.json ./packages/platform-policy-engine/
COPY packages/platform-procurement-proof/package.json ./packages/platform-procurement-proof/
COPY packages/platform-proof/package.json ./packages/platform-proof/
COPY packages/platform-rfp-generator/package.json ./packages/platform-rfp-generator/
COPY packages/pricing-engine/package.json ./packages/pricing-engine/
COPY packages/qbo/package.json ./packages/qbo/
COPY packages/scripts-book/package.json ./packages/scripts-book/
COPY packages/tax/package.json ./packages/tax/
COPY packages/tools-runtime/package.json ./packages/tools-runtime/
COPY packages/trade-adapters/package.json ./packages/trade-adapters/
COPY packages/trade-cars/package.json ./packages/trade-cars/
COPY packages/trade-core/package.json ./packages/trade-core/
COPY packages/trade-db/package.json ./packages/trade-db/
COPY packages/ui/package.json ./packages/ui/
COPY packages/webhooks/package.json ./packages/webhooks/
COPY packages/zonga-core/package.json ./packages/zonga-core/

# Override .npmrc — keep node-linker=hoisted (required for module resolution)
# but remove exFAT workarounds that are unnecessary on ext4
RUN echo 'node-linker=hoisted' > .npmrc

# Install dependencies — --ignore-scripts skips prepare/lefthook (no git in build env)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --ignore-scripts

COPY . .

EXPOSE 3000 3001 3002 3003 3004

# Run only the web/app packages — cli and orchestrator-api are excluded from web dev
CMD ["pnpm", "dev:docker"]
