/**
 * TrustCore Health Route
 *
 * GET /api/health
 *
 * Liveness/readiness probe for TrustCore.
 * Returns 200 if healthy, 503 if degraded.
 * Public route — no auth required (used by load balancer and container health checks).
 */
import { NextResponse } from 'next/server'
import { getBuildMetadata, healthStatusFromChecks, normalizeHealthChecks } from '@nzila/os-core/health'

const APP = 'trustcore'

async function checkDb(): Promise<boolean> {
  try {
    const { db } = await import('@nzila/db')
    await (db as { execute: (q: unknown) => Promise<unknown> }).execute({ sql: 'SELECT 1', params: [] })
    return true
  } catch {
    return false
  }
}

export async function GET() {
  const [dbOk] = await Promise.all([checkDb()])

  const checks = normalizeHealthChecks([
    { name: 'db', healthy: dbOk },
  ])

  const { status, httpStatus } = healthStatusFromChecks(checks)
  const build = getBuildMetadata(APP)

  return NextResponse.json({ app: APP, status, checks, build }, { status: httpStatus })
}
