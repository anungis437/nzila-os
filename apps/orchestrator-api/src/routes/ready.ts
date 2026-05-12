import type { FastifyInstance } from 'fastify'
import { sql } from 'drizzle-orm'
import { getDb } from '../db.js'
import { nowISO } from '@nzila/platform-utils/time'
import {
  buildRuntimeHealthResponse,
  type RuntimeHealthCheck,
} from '@nzila/os-core/health'
import { ORCHESTRATOR_DEPENDENCIES } from '../runtime-dependencies.js'

/**
 * `/ready` — ACA / Kubernetes readiness probe.
 *
 * Critical-aware semantics (Delta-7):
 *   - Every dependency declared in {@link ORCHESTRATOR_DEPENDENCIES} is probed.
 *   - A `critical` dependency that fails flips readiness to `not_ready`
 *     (HTTP 503).
 *   - A non-critical dependency that is degraded surfaces as `degraded_ready`
 *     with HTTP 200 — the app keeps serving while the optional capability is
 *     marked degraded for observability.
 *
 * Hard rule: missing `GITHUB_TOKEN` MUST NOT cause `not_ready`. The GitHub
 * dispatcher is declared `optional` in the dependency catalog precisely so the
 * orchestrator stays ready when the token is absent.
 */
export async function readyRoutes(app: FastifyInstance) {
  app.get('/ready', async (_req, reply) => {
    const checks: Record<string, RuntimeHealthCheck> = {}

    // ── database (CRITICAL) ─────────────────────────────────────────
    const dbStart = Date.now()
    try {
      const { db } = getDb()
      await db.execute(sql`SELECT 1`)
      checks.database = { status: 'ok', critical: true, ms: Date.now() - dbStart }
    } catch (err) {
      checks.database = {
        status: 'fail',
        critical: true,
        ms: Date.now() - dbStart,
        error: err instanceof Error ? err.message : 'database check failed',
      }
    }

    // ── github dispatcher (OPTIONAL) ────────────────────────────────
    const ghToken = process.env.GITHUB_TOKEN
    checks.github = ghToken
      ? { status: 'ok' }
      : {
          status: 'degraded',
          note: 'GITHUB_TOKEN not set — dispatches will fail when invoked',
        }

    const payload = buildRuntimeHealthResponse({
      app: 'orchestrator-api',
      checks,
      timestamp: nowISO(),
    })

    const criticalFailures = Object.entries(checks)
      .filter(([, check]) => check.critical && check.status !== 'ok')
      .map(([id]) => id)

    const degradedDependencies = Object.entries(checks)
      .filter(([, check]) => !check.critical && check.status !== 'ok')
      .map(([id]) => id)

    const readinessStatus: 'ready' | 'degraded_ready' | 'not_ready' =
      criticalFailures.length > 0
        ? 'not_ready'
        : degradedDependencies.length > 0
          ? 'degraded_ready'
          : 'ready'

    const ready = readinessStatus !== 'not_ready'
    const httpStatus = ready ? 200 : 503

    return reply.status(httpStatus).send({
      ...payload,
      ready,
      readiness: readinessStatus,
      criticalFailures,
      degradedDependencies,
      dependencyCatalog: ORCHESTRATOR_DEPENDENCIES.map((dep) => ({
        id: dep.id,
        criticality: dep.criticality,
      })),
    })
  })
}