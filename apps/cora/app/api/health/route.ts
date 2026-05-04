// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
import { NextResponse } from 'next/server'
import { getBuildMetadata, healthStatusFromChecks, normalizeHealthChecks } from '@nzila/os-core/health'

const APP = 'cora'

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
  const [db] = await Promise.allSettled([checkDb()])

  const checks = normalizeHealthChecks({
    process: true,
    db: db.status === 'fulfilled' ? db.value : false,
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
