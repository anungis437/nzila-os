import type { FastifyInstance } from 'fastify'
import { getDb } from '../db.js'
import { sql } from 'drizzle-orm'
import { nowISO } from '@nzila/platform-utils/time'
import { getEventBus } from '../platform.js'
import { getOperatingEvidenceService } from '@nzila/operating-evidence'

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async (_req, reply) => {
    const checks: Record<string, { status: string; ms?: number; error?: string }> = {}

    // ── DB connectivity ─────────────────────────────────────────────
    const dbStart = Date.now()
    try {
      const { db } = getDb()
      await db.execute(sql`SELECT 1`)
      checks.database = { status: 'ok', ms: Date.now() - dbStart }
    } catch (err) {
      checks.database = {
        status: 'degraded',
        ms: Date.now() - dbStart,
        error: err instanceof Error ? err.message : 'Unknown DB error',
      }
    }

    // ── GitHub token validity ───────────────────────────────────────
    const ghToken = process.env.GITHUB_TOKEN
    checks.github = ghToken
      ? { status: 'ok' }
      : { status: 'degraded', error: 'GITHUB_TOKEN not set — dispatches will fail' }

    // ── Overall ─────────────────────────────────────────────────────
    const allOk = Object.values(checks).every((c) => c.status === 'ok')
    const status = allOk ? 'ok' : 'degraded'

    return reply.status(allOk ? 200 : 503).send({
      status,
      app: 'orchestrator-api',
      timestamp: nowISO(),
      version: process.env.npm_package_version ?? '0.0.0',
      checks,
    })
  })

  app.get('/health/deep', async (_req, reply) => {
    const checks: Record<string, { status: string; ms?: number; error?: string }> = {}

    const dbStart = Date.now()
    try {
      const { db } = getDb()
      await db.execute(sql`SELECT 1`)
      checks.database = { status: 'ok', ms: Date.now() - dbStart }
    } catch (err) {
      checks.database = {
        status: 'degraded',
        ms: Date.now() - dbStart,
        error: err instanceof Error ? err.message : 'Unknown DB error',
      }
    }

    const ghToken = process.env.GITHUB_TOKEN
    checks.github = ghToken
      ? { status: 'ok' }
      : { status: 'degraded', error: 'GITHUB_TOKEN not set — dispatches will fail' }

    const busStart = Date.now()
    try {
      getEventBus()
      checks.eventBus = { status: 'ok', ms: Date.now() - busStart }
    } catch (err) {
      checks.eventBus = {
        status: 'degraded',
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

    const allOk = Object.values(checks).every((c) => c.status === 'ok')
    const status = allOk ? 'ok' : 'degraded'

    return reply.status(allOk ? 200 : 503).send({
      status,
      app: 'orchestrator-api',
      mode: 'deep',
      timestamp: nowISO(),
      version: process.env.npm_package_version ?? '0.0.0',
      checks,
    })
  })
}
