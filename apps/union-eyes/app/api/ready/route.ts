import { NextResponse } from 'next/server'
import { getBuildMetadata, isReadyFromChecks, normalizeHealthChecks } from '@nzila/os-core/health'

const APP = 'union-eyes'

async function checkDatabaseReady(): Promise<boolean> {
  try {
    const { db } = await import('@nzila/db')
    const { sql } = await import('drizzle-orm')
    await db.execute(sql`SELECT 1`)
    return true
  } catch {
    return false
  }
}

async function checkQueueReady(): Promise<boolean> {
  const djangoUrl = process.env.DJANGO_API_URL || process.env.NEXT_PUBLIC_DJANGO_API_URL || ''
  if (!djangoUrl) {
    return true
  }

  try {
    const base = djangoUrl.replace(/\/$/, '')
    const response = await fetch(`${base}/api/auth_core/health/`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    })
    return response.ok
  } catch {
    return false
  }
}

export async function GET() {
  const [database, queue] = await Promise.all([checkDatabaseReady(), checkQueueReady()])

  const checks = normalizeHealthChecks({
    process: true,
    database,
    queue,
    storage: 'unknown',
    thirdParty: 'unknown',
  })

  const ready = isReadyFromChecks(checks, ['process', 'database', 'queue'])

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
