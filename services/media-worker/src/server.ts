/**
 * @nzila/media-worker — Service Entrypoint
 *
 * HTTP server for health checks, environment validation,
 * graceful startup/shutdown, and worker orchestration.
 *
 * @module @nzila/media-worker/server
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { z } from 'zod'
import {
  createLogger,
  createCorrelationId,
  createHealthChecker,
  createMetricsCollector,
  type StructuredLogger,
  type HealthCheckDep,
} from './observability'

// ── Environment Schema ──────────────────────────────────────────────────────

const envSchema = z.object({
  // Storage
  S3_ENDPOINT: z.string().url(),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_REGION: z.string().default('auto'),

  // Redis
  REDIS_URL: z.string().url(),

  // Database
  DATABASE_URL: z.string().min(1),

  // CDN (optional)
  CDN_BASE_URL: z.string().url().optional(),

  // Server
  PORT: z.coerce.number().int().positive().default(8080),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),

  // Worker
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(2),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(1000),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
})

export type ServerEnv = z.infer<typeof envSchema>

/**
 * Validates environment variables and returns typed config.
 * Throws with clear error messages for invalid config.
 */
export function validateEnv(): ServerEnv {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`Invalid environment configuration:\n${errors}`)
  }
  return result.data
}

// ── HTTP Health Server ──────────────────────────────────────────────────────

export interface ServerDeps {
  readonly env: ServerEnv
  readonly logger: StructuredLogger
  readonly healthChecks: readonly HealthCheckDep[]
  readonly onShutdown: () => Promise<void>
}

/**
 * Creates the HTTP server that exposes /health and /ready endpoints.
 */
export function createHttpServer(deps: ServerDeps) {
  const { env, logger } = deps
  const startTime = Date.now()
  const metrics = createMetricsCollector(logger)

  const healthChecker = createHealthChecker({
    version: '1.0.0',
    startTime,
    checks: deps.healthChecks,
  })

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ?? '/'

    if (url === '/health' && req.method === 'GET') {
      try {
        const status = await healthChecker.check()
        const code = status.status === 'healthy' ? 200 : status.status === 'degraded' ? 200 : 503
        res.writeHead(code, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(status))
        metrics.increment('http.health.requests', 1, { status: String(code) })
      } catch {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ status: 'unhealthy', error: 'health check error' }))
      }
      return
    }

    if (url === '/ready' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ready: true }))
      return
    }

    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'not found' }))
  })

  let isShuttingDown = false

  async function start(): Promise<void> {
    return new Promise((resolve) => {
      server.listen(env.PORT, () => {
        logger.info(`Health server listening on :${env.PORT}`)
        resolve()
      })
    })
  }

  async function stop(): Promise<void> {
    if (isShuttingDown) return
    isShuttingDown = true
    logger.info('Shutting down...')

    // Stop accepting new connections
    server.close()

    // Run application shutdown (stop workers, etc.)
    try {
      await deps.onShutdown()
    } catch (err) {
      logger.error('Error during shutdown', err instanceof Error ? err : undefined)
    }

    logger.info('Shutdown complete')
  }

  return { start, stop, server }
}

// ── Process Lifecycle ───────────────────────────────────────────────────────

/**
 * Registers OS signal handlers for graceful shutdown.
 */
export function registerShutdownHandlers(
  shutdown: () => Promise<void>,
  logger: StructuredLogger,
): void {
  let shutdownInitiated = false

  const handler = (signal: string) => {
    if (shutdownInitiated) return
    shutdownInitiated = true
    logger.info(`Received ${signal}, starting graceful shutdown`)
    shutdown().then(() => process.exit(0)).catch(() => process.exit(1))
  }

  process.on('SIGTERM', () => handler('SIGTERM'))
  process.on('SIGINT', () => handler('SIGINT'))

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception', err)
    handler('uncaughtException')
  })

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', reason instanceof Error ? reason : new Error(String(reason)))
  })
}
