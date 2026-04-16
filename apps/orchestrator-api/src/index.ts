import Fastify from 'fastify'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import { commandRoutes } from './routes/commands.js'
import { healthRoutes } from './routes/health.js'
import { proofCenterRoutes } from './routes/proof-center.js'
import { workflowRoutes } from './routes/workflows.js'
import { jobRoutes } from './routes/jobs.js'
import { runRoutes } from './routes/runs.js'
import { metricsRoutes } from './routes/metrics.js'
import { statusRoutes } from './routes/status.js'
import { createLogger } from '@nzila/os-core'
import { getEventBus } from './platform.js'
import { telemetryHooks } from './telemetry-hooks.js'

const logger = createLogger('orchestrator-api')

// ── OpenTelemetry + Metrics ─────────────────────────────────────────────────
try {
  const { initOtel, initMetrics } = await import('@nzila/os-core/telemetry')
  await initOtel({ appName: 'orchestrator-api' })
  initMetrics('orchestrator-api')
  logger.info('OpenTelemetry + metrics initialized')
} catch (err) {
  logger.warn('OTel initialization skipped', { error: err })
}

// ── Env validation at startup ───────────────────────────────────────────────
try {
  const { validateEnv } = await import('@nzila/os-core/config')
  validateEnv('orchestrator-api')
  logger.info('Environment validation passed')
} catch (err) {
  logger.warn('Environment validation issue', { error: err })
}

// ── Boot invariants ─────────────────────────────────────────────────────────
try {
  const { assertBootInvariants } = await import('@nzila/os-core')
  assertBootInvariants()
  logger.info('Boot invariants verified')
} catch (err) {
  if (process.env.NODE_ENV === 'production') {
    logger.error('Boot invariants failed — aborting', { error: err })
    process.exit(1)
  }
  logger.warn('Boot invariants check skipped in dev', { error: err })
}

const PORT = Number(process.env.PORT ?? 4000)
const HOST = process.env.HOST ?? '0.0.0.0'
const API_KEY = process.env.ORCHESTRATOR_API_KEY ?? ''

// ── Platform Integration (event-fabric) ────────────────────────────────────
try {
  getEventBus()
  logger.info('Platform event bus initialized')
} catch (err) {
  logger.warn('Platform integration init skipped', { error: err })
}

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
    transport:
      process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty' }
        : undefined,
  },
  trustProxy: true,
})

// ── Security ────────────────────────────────────────────────────────────────
await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
})

await app.register(rateLimit, {
  global: true,
  max: process.env.RATE_LIMIT_MAX ? Number(process.env.RATE_LIMIT_MAX) : 200,
  timeWindow: '1 minute',
  errorResponseBuilder: () => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please retry after 1 minute.',
  }),
})

// ── API Key authentication hook (skip /health) ──────────────────────────────
app.addHook('onRequest', async (req, reply) => {
  // Health and metrics endpoints are always public (k8s probes, uptime monitors)
  if (req.url === '/health' || req.url === '/metrics') return

  if (!API_KEY) {
    // No key configured — allow in dev, block in prod
    if (process.env.NODE_ENV === 'production') {
      logger.error('ORCHESTRATOR_API_KEY is not set in production')
      return reply.status(500).send({ error: 'Server misconfigured' })
    }
    return
  }

  const provided =
    req.headers.authorization?.replace(/^Bearer\s+/i, '') ??
    (req.headers['x-api-key'] as string)

  if (provided !== API_KEY) {
    return reply.status(401).send({ error: 'Unauthorized — invalid or missing API key' })
  }
})

// ── Request-ID propagation ──────────────────────────────────────────────────
app.addHook('onRequest', async (req, reply) => {
  const requestId = (req.headers['x-request-id'] as string) ?? crypto.randomUUID()
  reply.header('x-request-id', requestId)
})

// ── Idempotency-Key enforcement (fail-closed in production) ─────────────────
app.addHook('onRequest', async (req, reply) => {
  if (req.url === '/health') return
  const MUTATION = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
  if (!MUTATION.has(req.method)) return
  const idempotencyKey = req.headers['idempotency-key'] as string | undefined
  if (!idempotencyKey) {
    if (process.env.NODE_ENV === 'production') {
      return reply.status(400).send({
        error: 'Missing Idempotency-Key header',
        message:
          'All mutation requests (POST, PUT, PATCH, DELETE) must include an Idempotency-Key header.',
        code: 'IDEMPOTENCY_KEY_REQUIRED',
      })
    }
  }
})

// ── Routes ──
app.register(healthRoutes)
app.register(metricsRoutes)
app.register(telemetryHooks)
app.register(commandRoutes, { prefix: '/commands' })
app.register(workflowRoutes, { prefix: '/workflows' })
app.register(jobRoutes, { prefix: '/jobs' })
app.register(runRoutes, { prefix: '/runs' })
app.register(statusRoutes, { prefix: '/status' })
app.register(proofCenterRoutes, { prefix: '/api/proof-center' })

// ── Start ──
async function main() {
  try {
    await app.listen({ port: PORT, host: HOST })
    logger.info(`Orchestrator API listening on ${HOST}:${PORT}`)
  } catch (err) {
    logger.error('Failed to start', { error: err })
    process.exit(1)
  }
}

main()

export { app }
