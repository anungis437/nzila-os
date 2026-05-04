/**
 * Trade Health & Readiness Route
 *
 * Production-grade liveness probe:
 * - DB connectivity check (SELECT 1 via @nzila/db)
 * - Returns 200 if healthy, 503 if degraded
 * - Public route (no auth required)
 */
import { NextResponse } from 'next/server'
import { getBuildMetadata, healthStatusFromChecks, normalizeHealthChecks } from '@nzila/os-core/health'

const APP = 'trade'

async function checkDb(): Promise<boolean> {
  try {
    const { db } = await import('@nzila/db')
    const { sql } = await import('drizzle-orm')
    await db.execute(sql`SELECT 1`)
    return true
  } catch {
    return false
  }
}

export async function GET() {
  const dbResult = await checkDb().catch(() => false)

  const checks = normalizeHealthChecks({ process: true, db: dbResult })

  return NextResponse.json(
    {
      status: healthStatusFromChecks(checks),
      ...getBuildMetadata(APP),
      checks,
    },
    { status: 200 },
  )
}
