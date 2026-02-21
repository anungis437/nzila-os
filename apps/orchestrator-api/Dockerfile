# Orchestrator API — lightweight Dockerfile
# Uses tsx for TypeScript execution (no compile step)

FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@10.11.0 --ignore-scripts

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./

# Copy orchestrator + its workspace dependencies
COPY apps/orchestrator-api/package.json ./apps/orchestrator-api/
COPY packages/db/package.json ./packages/db/
COPY packages/config/package.json ./packages/config/

# Install dependencies — --ignore-scripts skips prepare/lefthook (no git in build env)
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --ignore-scripts

# Copy source
COPY apps/orchestrator-api/ ./apps/orchestrator-api/
COPY packages/db/ ./packages/db/
COPY packages/config/ ./packages/config/

# Non-root user
RUN addgroup --system --gid 1001 nzila && \
    adduser --system --uid 1001 orchestrator && \
    chown -R orchestrator:nzila /app
USER orchestrator

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

CMD ["pnpm", "--filter", "@nzila/orchestrator-api", "start"]
