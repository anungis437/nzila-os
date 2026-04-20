// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
import { NextResponse } from 'next/server'
import { getBuildMetadata, healthStatusFromChecks, normalizeHealthChecks } from '@nzila/os-core/health'

const APP = 'union-eyes'

async function checkDb(): Promise<boolean> {
  try {
    const { db } = await import('@nzila/db')
    const { sql } = await import('drizzle-orm')
    // Cast needed: packages/db pins drizzle-orm ^0.39 while app uses ^0.45
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.execute(sql`SELECT 1` as any)
    return true
  } catch {
    return false
  }
}

async function checkQueue(): Promise<'ok' | 'degraded' | 'unreachable'> {
  const djangoUrl = process.env.DJANGO_API_URL || process.env.NEXT_PUBLIC_DJANGO_API_URL || ''
  if (!djangoUrl) return 'ok' // No Django backend configured

  try {
    // Hit the unauthenticated Django health endpoint (auth-exempt in middleware)
    const base = djangoUrl.replace(/\/$/, '')
    const res = await fetch(`${base}/api/auth_core/health/`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    })
    return res.ok ? 'ok' : 'degraded'
  } catch {
    return 'unreachable'
  }
}

export async function GET() {
  const [dbResult, queueResult] = await Promise.allSettled([checkDb(), checkQueue()])

  const checks = normalizeHealthChecks({
    process: true,
    database: dbResult.status === 'fulfilled' ? dbResult.value : false,
    queue: queueResult.status === 'fulfilled' ? queueResult.value === 'ok' : false,
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

