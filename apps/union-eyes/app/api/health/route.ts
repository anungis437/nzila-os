// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
import { NextResponse } from 'next/server'
import { getBuildMetadata, healthStatusFromChecks, normalizeHealthChecks } from '@nzila/os-core/health'
import { buildHealthResponse } from '@nzila/platform-ops/health/strictHealth'

const APP = 'union-eyes'

function parseBoolEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

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

export async function GET(request: Request) {
  const forceFailRequested = request ? new URL(request.url).searchParams.get('forceFail') === '1' : false
  const allowForceFail = process.env.NODE_ENV !== 'production'

  if (forceFailRequested && allowForceFail) {
    const forced = buildHealthResponse([{ name: 'forced-degradation', ok: false }])
    return NextResponse.json(
      {
        status: 'degraded',
        ...getBuildMetadata(APP),
        checks: forced.body.checks,
        ok: forced.body.ok,
        timestamp: forced.body.timestamp,
      },
      { status: forced.status },
    )
  }

  const [dbResult, queueResult] = await Promise.allSettled([checkDb(), checkQueue()])
  const requireQueue = parseBoolEnv(process.env.HEALTH_REQUIRE_QUEUE, false)

  const checksInput: Record<string, boolean> = {
    process: true,
    database: dbResult.status === 'fulfilled' ? dbResult.value : false,
  }

  if (requireQueue) {
    checksInput.queue = queueResult.status === 'fulfilled' ? queueResult.value === 'ok' : false
  }

  const checks = normalizeHealthChecks(checksInput)

  const status = healthStatusFromChecks(checks)

  const strict = buildHealthResponse([
    { name: 'process', ok: true },
    { name: 'database', ok: checksInput.database },
    {
      name: 'queue',
      ok: checksInput.queue ?? true,
      critical: requireQueue,
      message: queueResult.status === 'fulfilled' ? queueResult.value : 'unreachable',
    },
  ])

  return NextResponse.json(
    {
      status: strict.status === 200 ? status : 'degraded',
      ...getBuildMetadata(APP),
      checks,
      ok: strict.body.ok,
      timestamp: strict.body.timestamp,
    },
    { status: strict.status },
  )
}

