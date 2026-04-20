import type { FastifyInstance } from 'fastify'
import { getDb } from '../db.js'
import { sql } from 'drizzle-orm'
import { nowISO } from '@nzila/platform-utils/time'

export async function readyRoutes(app: FastifyInstance) {
  app.get('/ready', async (_req, reply) => {
    const checks: Record<string, { status: string; error?: string }> = {
      process: { status: 'ok' },
      queue: { status: 'unknown' },
      storage: { status: 'unknown' },
      thirdParty: { status: process.env.GITHUB_TOKEN ? 'ok' : 'degraded' },
    }

    try {
      const { db } = getDb()
      await db.execute(sql`SELECT 1`)
      checks.database = { status: 'ok' }
    } catch (err) {
      checks.database = { status: 'degraded', error: err instanceof Error ? err.message : 'database check failed' }
    }

    const ready = Object.values(checks).every((c) => c.status === 'ok' || c.status === 'unknown')
    return reply.status(ready ? 200 : 503).send({
      ready,
      status: ready ? 'ready' : 'not_ready',
      app: 'orchestrator-api',
      timestamp: nowISO(),
      checks,
    })
  })
}