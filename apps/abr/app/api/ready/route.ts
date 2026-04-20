import { NextResponse } from 'next/server'
import { getBuildMetadata, isReadyFromChecks, normalizeHealthChecks } from '@nzila/os-core/health'

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
  const dbOk = await checkDb()
  const checks = normalizeHealthChecks({
    process: true,
    database: dbOk,
    queue: 'unknown',
    storage: 'unknown',
    thirdParty: 'unknown',
  })

  const ready = isReadyFromChecks(checks, ['process', 'database'])

  return NextResponse.json(
    {
      ready,
      status: ready ? 'ready' : 'not_ready',
      ...getBuildMetadata(APP),
      checks,
    },
    { status: ready ? 200 : 503 },
  )
}