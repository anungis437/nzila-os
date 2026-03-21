# syntax=docker/dockerfile:1
#
# Media Worker — audio transcoding + queue processing
# Runs as a standalone Node.js service with FFmpeg for transcoding.
#

FROM node:20-slim AS base

# Install FFmpeg for audio transcoding + wget for healthchecks
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg wget && \
    rm -rf /var/lib/apt/lists/*

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm@10.11.0 --ignore-scripts

# ── Dependencies ─────────────────────────────────────────────────────────

FROM base AS deps
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY services/media-worker/package.json ./services/media-worker/
COPY packages/zonga-core/package.json ./packages/zonga-core/
COPY packages/zonga-control-plane/package.json ./packages/zonga-control-plane/

RUN echo 'node-linker=hoisted' > .npmrc
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --ignore-scripts

# ── Builder ──────────────────────────────────────────────────────────────

FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/services ./services
COPY --from=deps /app/packages ./packages
COPY . .

# ── Production ───────────────────────────────────────────────────────────

FROM base AS production
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/services/media-worker ./services/media-worker
COPY --from=builder /app/packages/zonga-core ./packages/zonga-core
COPY --from=builder /app/packages/zonga-control-plane ./packages/zonga-control-plane
COPY --from=builder /app/node_modules ./node_modules

# Temp directory for transcoding
RUN mkdir -p /tmp/transcode && chown -R 1001:1001 /tmp/transcode

# Create non-root user
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --no-create-home worker && \
    chown -R worker:nodejs /app

USER worker

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

EXPOSE 8080

CMD ["node", "--import", "tsx", "services/media-worker/src/index.ts"]
