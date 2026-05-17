import { NextResponse } from 'next/server'
import {
  buildRuntimeHealthResponse,
  type RuntimeHealthCheck,
} from '@nzila/os-core/health'

const APP = 'union-eyes'

async function checkDb(): Promise<RuntimeHealthCheck> {
  const start = Date.now()
  try {
    const { db } = await import('@nzila/db')
    const { sql } = await import('drizzle-orm')
    // Cast needed: packages/db pins drizzle-orm ^0.39 while app uses ^0.45
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.execute(sql`SELECT 1` as any)
    return { status: 'ok', critical: true, ms: Date.now() - start }
  } catch (err) {
    return {
      status: 'fail',
      critical: true,
      ms: Date.now() - start,
      error: err instanceof Error ? err.message : 'unknown',
    }
  }
}

async function checkAuth(): Promise<RuntimeHealthCheck> {
  // Clerk auth: validate config presence (full connectivity check is too expensive for a probe)
  const hasClerkKey =
    Boolean(process.env.CLERK_SECRET_KEY) ||
    Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)
  return hasClerkKey
    ? { status: 'ok', critical: true }
    : { status: 'degraded', critical: true, note: 'Clerk credentials not configured' }
}

async function checkRedis(): Promise<RuntimeHealthCheck> {
  const hasRedis =
    Boolean(process.env.UPSTASH_REDIS_REST_URL) ||
    Boolean(process.env.KV_REST_API_URL) ||
    Boolean(process.env.REDIS_URL)
  if (!hasRedis) return { status: 'ok', note: 'Redis not configured — optional for this deployment' }

  try {
    const start = Date.now()
    const url = (
      process.env.UPSTASH_REDIS_REST_URL ??
      process.env.KV_REST_API_URL ??
      ''
    ).replace(/\/$/, '')
    const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? ''
    if (!url || !token) return { status: 'degraded', note: 'Redis URL or token missing' }

    const res = await fetch(`${url}/ping`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(2000),
    })
    return res.ok
      ? { status: 'ok', ms: Date.now() - start }
      : { status: 'degraded', note: `ping returned ${res.status}`, ms: Date.now() - start }
  } catch (err) {
    return {
      status: 'degraded',
      note: err instanceof Error ? err.message : 'unreachable',
    }
  }
}

async function checkBackend(): Promise<RuntimeHealthCheck> {
  const djangoUrl = process.env.DJANGO_API_URL ?? process.env.NEXT_PUBLIC_DJANGO_API_URL ?? ''
  if (!djangoUrl) return { status: 'ok', note: 'Django backend not configured — optional' }

  try {
    const start = Date.now()
    const base = djangoUrl.replace(/\/$/, '')
    const res = await fetch(`${base}/api/auth_core/health/`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    })
    return res.ok
      ? { status: 'ok', ms: Date.now() - start }
      : { status: 'degraded', ms: Date.now() - start, note: `returned ${res.status}` }
  } catch {
    return { status: 'degraded', note: 'unreachable' }
  }
}

export async function GET() {
  const [dbResult, authResult, redisResult, backendResult] = await Promise.allSettled([
    checkDb(),
    checkAuth(),
    checkRedis(),
    checkBackend(),
  ])

  const checks: Record<string, RuntimeHealthCheck> = {
    process: { status: 'ok' },
    database: dbResult.status === 'fulfilled' ? dbResult.value : { status: 'fail', critical: true },
    auth: authResult.status === 'fulfilled' ? authResult.value : { status: 'degraded', critical: true },
    redis: redisResult.status === 'fulfilled' ? redisResult.value : { status: 'degraded' },
    backend: backendResult.status === 'fulfilled' ? backendResult.value : { status: 'degraded' },
  }

  const payload = buildRuntimeHealthResponse({ app: APP, checks })

  return NextResponse.json(payload, { status: payload.ok ? 200 : 503 })
}

