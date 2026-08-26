/**
 * ABR Health & Readiness Route
 *
 * Production-grade liveness probe aligned with console reference:
 * - DB connectivity check (SELECT 1 via @nzila/db)
 * - Returns 200 if all healthy, 503 if degraded
 * - Public route (no auth required — see proxy.ts allowlist)
 */
import { NextResponse } from 'next/server'
import { getBuildMetadata, healthStatusFromChecks, normalizeHealthChecks } from '@nzila/os-core/health'

const APP = 'abr'

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
  const db = await checkDb()

  const checks = normalizeHealthChecks({
    process: true,
    db,
  })

  return NextResponse.json(
    {
      status: healthStatusFromChecks(checks),
      ...getBuildMetadata(APP),
      checks,
    },
    { status: 200 },
  )
}
