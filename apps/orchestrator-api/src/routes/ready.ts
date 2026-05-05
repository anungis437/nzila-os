import type { FastifyInstance } from 'fastify'
import { getDb } from '../db.js'
import { sql } from 'drizzle-orm'
import { nowISO } from '@nzila/platform-utils/time'
import { getEventBus } from '../platform.js'
import { buildHealthResponse, type DependencyCheck } from '@nzila/platform-ops/health/strictHealth'

async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  fallback: T,
): Promise<T> {
  const timeout = new Promise<T>((resolve) => {
    setTimeout(() => resolve(fallback), timeoutMs)
  })
  return Promise.race([operation, timeout])
}

async function checkDatabase(): Promise<boolean> {
  try {
    const { db } = getDb()
    await db.execute(sql`SELECT 1`)
    return true
  } catch {
    return false
  }
}

async function checkEventBusReady(): Promise<boolean> {
  try {
    getEventBus()
    return true
  } catch {
    return false
  }
}

export async function readyRoutes(app: FastifyInstance) {
  app.get('/ready', async (_req, reply) => {
    const checks: DependencyCheck[] = [
      { name: 'database', ok: await withTimeout(checkDatabase(), 450, false) },
      { name: 'eventBus', ok: await withTimeout(checkEventBusReady(), 250, false) },
      {
        name: 'githubToken',
        ok: Boolean(process.env.GITHUB_TOKEN),
        message: process.env.GITHUB_TOKEN ? undefined : 'GITHUB_TOKEN not set',
      },
    ]

    const strict = buildHealthResponse(checks)
    const ready = strict.status === 200

    return reply.status(strict.status).send({
      ready,
      ok: strict.body.ok,
      status: ready ? 'ready' : 'not_ready',
      app: 'orchestrator-api',
      timestamp: nowISO(),
      checks: strict.body.checks,
    })
  })
}