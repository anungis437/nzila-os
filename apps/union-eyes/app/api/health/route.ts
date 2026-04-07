// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
import { NextResponse } from 'next/server'

const APP = 'union-eyes'
const VERSION = process.env.npm_package_version ?? '0.0.0'
const COMMIT = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? 'local'
const START_TIME = Date.now()

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

  const dbOk = dbResult.status === 'fulfilled' ? dbResult.value : false
  const queueStatus = queueResult.status === 'fulfilled' ? queueResult.value : 'unreachable'

  const allHealthy = dbOk && queueStatus === 'ok'

  return NextResponse.json(
    {
      app: APP,
      status: allHealthy ? 'ok' : 'degraded',
      version: VERSION,
      uptime: Math.floor((Date.now() - START_TIME) / 1000),
      buildInfo: { version: VERSION, commit: COMMIT },
      checks: {
        db: dbOk ? 'ok' : 'fail',
        queue: queueStatus,
      },
      timestamp: new Date().toISOString(),
    },
    { status: allHealthy ? 200 : 503 },
  )
}

