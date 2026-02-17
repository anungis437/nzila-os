# syntax=docker/dockerfile:1

# ============================================
# Base stage - pnpm setup
# ============================================
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

# ============================================
# Dependencies stage
# ============================================
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc ./
COPY apps/web/package.json ./apps/web/
COPY apps/console/package.json ./apps/console/
COPY packages/ui/package.json ./packages/ui/
COPY packages/config/package.json ./packages/config/
COPY packages/scripts-book/package.json ./packages/scripts-book/

# Install dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

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
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_build_placeholder
ARG CLERK_SECRET_KEY=sk_test_build_placeholder

# Set as env vars for build
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV CLERK_SECRET_KEY=$CLERK_SECRET_KEY

# Build all packages and apps
RUN pnpm build

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
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    chown -R nextjs:nodejs /app

USER nextjs

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
COPY --from=builder /app/apps/console/public ./apps/console/public
COPY --from=builder /app/content ./content

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3001

CMD ["node", "apps/console/server.js"]

# ============================================
# Dev stage - for development with hot reload
# ============================================
FROM base AS dev
WORKDIR /app

# Copy package files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* .npmrc ./
COPY apps/web/package.json ./apps/web/
COPY apps/console/package.json ./apps/console/
COPY packages/ui/package.json ./packages/ui/
COPY packages/config/package.json ./packages/config/
COPY packages/scripts-book/package.json ./packages/scripts-book/

# Install dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install

# Copy everything (volumes will override in docker-compose)
COPY . .

EXPOSE 3000 3001

CMD ["pnpm", "dev"]
