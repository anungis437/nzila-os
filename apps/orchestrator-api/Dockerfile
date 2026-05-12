# Orchestrator API — multi-stage Dockerfile
# Uses tsx for TypeScript execution (no compile step)
# Stage 1 builds full workspace deps; stage 2 uses `pnpm deploy` to produce a self-contained app.

FROM node:22-alpine AS builder

# Patch CVE-2026-22184 (zlib buffer overflow) — upgrade ahead of base image rebuild
RUN apk update && apk upgrade --no-cache zlib && rm -rf /var/cache/apk/*

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@10.11.0 --ignore-scripts

WORKDIR /repo

# Copy full workspace (needed for pnpm deploy to follow workspace links).
# We rely on .dockerignore to exclude node_modules, .git, build artifacts, etc.
COPY . .

# Install all workspace dependencies (no scripts — skips prepare/lefthook hooks).
# Note: avoid BuildKit-only `--mount=type=cache` so this Dockerfile builds on
# classic Docker engines (e.g. `az acr build`).
RUN pnpm install --frozen-lockfile --ignore-scripts

# Produce a self-contained deploy bundle for the orchestrator-api app.
# `pnpm deploy` resolves workspace:* links and copies all required packages
# into /app as a flat node_modules tree.
RUN pnpm deploy --filter @nzila/orchestrator-api --prod=false --legacy --ignore-scripts /app

# ---- Runtime stage ----
FROM node:22-alpine AS runtime

RUN apk update && apk upgrade --no-cache zlib && rm -rf /var/cache/apk/*

WORKDIR /app

COPY --from=builder /app /app

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

# Bypass the package.json `start` script which uses `node --env-file=.env` —
# Azure Container Apps injects env vars directly, no .env file is present.
CMD ["node", "--import", "tsx", "src/index.ts"]
