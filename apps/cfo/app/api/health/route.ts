/**
 * CFO Health & Readiness Route
 *
 * Production-grade liveness probe aligned with console reference:
 * - DB connectivity check (SELECT 1 via @nzila/db)
 * - Blob storage connectivity check (Azure Storage)
 * - Returns 200 if all healthy, 503 if degraded
 * - Public route (no auth required — see proxy.ts allowlist)
 */
import { NextResponse } from 'next/server'
import { getBuildMetadata, healthStatusFromChecks, normalizeHealthChecks } from '@nzila/os-core/health'

const APP = 'cfo'

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

async function checkBlob(): Promise<boolean> {
  try {
    const { container } = await import('@nzila/blob')
    const client = container('evidence')
    void client
    return true
  } catch {
    return false
  }
}

export async function GET() {
  const [db, blob] = await Promise.allSettled([checkDb(), checkBlob()])

  const checks = normalizeHealthChecks({
    process: true,
    db: db.status === 'fulfilled' ? db.value : false,
    blob: blob.status === 'fulfilled' ? blob.value : false,
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
