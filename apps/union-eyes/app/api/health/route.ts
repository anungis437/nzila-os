// Observability: @nzila/os-core/health — canonical health contract via getBuildMetadata + normalizeHealthChecks + healthStatusFromChecks
import { NextResponse } from 'next/server'
import {
  getBuildMetadata,
  healthStatusFromChecks,
  normalizeHealthChecks,
  type HealthCheckState,
} from '@nzila/os-core/health'

const APP = 'union-eyes'

async function checkDb(): Promise<HealthCheckState> {
  try {
    const { db } = await import('@nzila/db')
    const { sql } = await import('drizzle-orm')
    // Cast needed: packages/db pins drizzle-orm ^0.39 while app uses ^0.45
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.execute(sql`SELECT 1` as any)
    return 'ok'
  } catch {
    return 'fail'
  }
}

async function checkAuth(): Promise<HealthCheckState> {
  // Clerk auth: validate config presence (full connectivity check is too expensive for a probe)
  const hasClerkKey =
    Boolean(process.env.CLERK_SECRET_KEY) ||
    Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
  return hasClerkKey ? 'ok' : 'degraded'
}

async function checkRedis(): Promise<HealthCheckState> {
  const hasRedis =
    Boolean(process.env.UPSTASH_REDIS_REST_URL) ||
    Boolean(process.env.KV_REST_API_URL) ||
    Boolean(process.env.REDIS_URL)
  if (!hasRedis) return 'ok'

  try {
    const url = (
      process.env.UPSTASH_REDIS_REST_URL ??
      process.env.KV_REST_API_URL ??
      ''
    ).replace(/\/$/, '')
    const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? ''
    if (!url || !token) return 'degraded'

    const res = await fetch(`${url}/ping`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(2000),
    })
    return res.ok ? 'ok' : 'degraded'
  } catch {
    return 'degraded'
  }
}

async function checkBackend(): Promise<HealthCheckState> {
  const djangoUrl = process.env.DJANGO_API_URL ?? process.env.NEXT_PUBLIC_DJANGO_API_URL ?? ''
  if (!djangoUrl) return 'ok'

  try {
    const base = djangoUrl.replace(/\/$/, '')
    const res = await fetch(`${base}/api/auth_core/health/`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    })
    return res.ok ? 'ok' : 'degraded'
  } catch {
    return 'degraded'
  }
}

export async function GET() {
  const [dbResult, authResult, redisResult, backendResult] = await Promise.allSettled([
    checkDb(),
    checkAuth(),
    checkRedis(),
    checkBackend(),
  ])

  const checks = normalizeHealthChecks({
    process: 'ok',
    database: dbResult.status === 'fulfilled' ? dbResult.value : 'fail',
    auth: authResult.status === 'fulfilled' ? authResult.value : 'degraded',
    redis: redisResult.status === 'fulfilled' ? redisResult.value : 'degraded',
    backend: backendResult.status === 'fulfilled' ? backendResult.value : 'degraded',
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

