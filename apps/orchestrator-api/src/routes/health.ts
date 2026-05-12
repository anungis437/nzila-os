import type { FastifyInstance } from 'fastify'
import { getDb } from '../db.js'
import { sql } from 'drizzle-orm'
import { nowISO } from '@nzila/platform-utils/time'
import { getEventBus } from '../platform.js'
import { getOperatingEvidenceService } from '@nzila/operating-evidence'
import { buildRuntimeHealthResponse, type RuntimeHealthCheck } from '@nzila/os-core/health'

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async (_req, reply) => {
    const checks: Record<string, RuntimeHealthCheck> = {}

    // ── DB connectivity (CRITICAL) ──────────────────────────────────
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
        error: err instanceof Error ? err.message : 'Unknown DB error',
      }
    }

    // ── GitHub token presence (NON-CRITICAL) ────────────────────────
    // Absence degrades dispatch capability but must not turn /health into a
    // permanent 503 (that would fail ACA readiness probes for an outage that
    // has not yet occurred).
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
    return reply.status(payload.ok ? 200 : 503).send(payload)
  })

  app.get('/health/deep', async (_req, reply) => {
    const checks: Record<string, RuntimeHealthCheck> = {}

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
        error: err instanceof Error ? err.message : 'Unknown DB error',
      }
    }

    const ghToken = process.env.GITHUB_TOKEN
    checks.github = ghToken
      ? { status: 'ok' }
      : {
          status: 'degraded',
          note: 'GITHUB_TOKEN not set — dispatches will fail when invoked',
        }

    const busStart = Date.now()
    try {
      getEventBus()
      checks.eventBus = { status: 'ok', critical: true, ms: Date.now() - busStart }
    } catch (err) {
      checks.eventBus = {
        status: 'fail',
        critical: true,
        ms: Date.now() - busStart,
        error: err instanceof Error ? err.message : 'Event bus unavailable',
      }
    }

    const evidenceStart = Date.now()
    try {
      await getOperatingEvidenceService().record({
        app: 'orchestrator-api',
        domain: 'commerce',
        type: 'request',
        severity: 'low',
        payload: { probe: 'health-deep' },
      })
      checks.evidence = { status: 'ok', ms: Date.now() - evidenceStart }
    } catch (err) {
      checks.evidence = {
        status: 'degraded',
        ms: Date.now() - evidenceStart,
        error: err instanceof Error ? err.message : 'Evidence service unavailable',
      }
    }

    const payload = {
      ...buildRuntimeHealthResponse({
        app: 'orchestrator-api',
        checks,
        timestamp: nowISO(),
      }),
      mode: 'deep' as const,
    }
    return reply.status(payload.ok ? 200 : 503).send(payload)
  })
}
