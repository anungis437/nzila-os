// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
import { NextResponse } from 'next/server'
import { getBuildMetadata, healthStatusFromChecks, normalizeHealthChecks } from '@nzila/os-core/health'

const APP = 'console'

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
    await client.getProperties()
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

  const status = healthStatusFromChecks(checks)

  return NextResponse.json(
    {
      status,
      ...getBuildMetadata(APP),
      checks,
    },
    { status: status === 'ok' ? 200 : 503 },
  )
}
