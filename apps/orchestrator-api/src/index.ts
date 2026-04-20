import Fastify from 'fastify'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import { commandRoutes } from './routes/commands.js'
import { healthRoutes } from './routes/health.js'
import { readyRoutes } from './routes/ready.js'
import { versionRoutes } from './routes/version.js'
import { proofCenterRoutes } from './routes/proof-center.js'
import { workflowRoutes } from './routes/workflows.js'
import { jobRoutes } from './routes/jobs.js'
import { runRoutes } from './routes/runs.js'
import { metricsRoutes } from './routes/metrics.js'
import { statusRoutes } from './routes/status.js'
import { executeRoutes } from './routes/execute.js'
import { startExecutionRecoveryLoop } from './execution-engine.js'
import { createLogger } from '@nzila/os-core'
import { getEventBus } from './platform.js'
import { telemetryHooks } from './telemetry-hooks.js'
import { requireApiKey, requireIdempotencyKey } from './api-guards.js'
import { getOrchestratorEnv } from './env.js'

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

const env = getOrchestratorEnv()
const PORT = env.PORT
const HOST = env.HOST
const API_KEY = env.ORCHESTRATOR_API_KEY ?? ''

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
  const ok = requireApiKey(req, reply, API_KEY)
  if (!ok) {
    if (!API_KEY && process.env.NODE_ENV === 'production') {
      logger.error('ORCHESTRATOR_API_KEY is not set in production')
    }
    return
  }
})

// ── Request-ID propagation ──────────────────────────────────────────────────
app.addHook('onRequest', async (req, reply) => {
  const requestId = (req.headers['x-request-id'] as string) ?? crypto.randomUUID()
  reply.header('x-request-id', requestId)
})

// ── Idempotency-Key enforcement (fail-closed in production) ─────────────────
app.addHook('onRequest', async (req, reply) => {
  const ok = requireIdempotencyKey(req, reply)
  if (!ok) {
    logger.warn('Idempotency key missing for mutation request', {
      method: req.method,
      path: req.url,
    })
    return
  }
})

// ── Routes ──
app.register(healthRoutes)
app.register(readyRoutes)
app.register(versionRoutes)
app.register(metricsRoutes)
app.register(telemetryHooks)
app.register(commandRoutes, { prefix: '/commands' })
app.register(workflowRoutes, { prefix: '/workflows' })
app.register(jobRoutes, { prefix: '/jobs' })
app.register(runRoutes, { prefix: '/runs' })
app.register(statusRoutes, { prefix: '/status' })
app.register(proofCenterRoutes, { prefix: '/api/proof-center' })
app.register(executeRoutes, { prefix: '/execute' })

// ── Start ──
async function main() {
  try {
    startExecutionRecoveryLoop()
    await app.listen({ port: PORT, host: HOST })
    logger.info(`Orchestrator API listening on ${HOST}:${PORT}`)
  } catch (err) {
    logger.error('Failed to start', { error: err })
    process.exit(1)
  }
}

main()

export { app }
