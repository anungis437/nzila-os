/**
 * Zonga Health & Readiness Route
 *
 * Production-grade liveness probe aligned with console reference:
 * - DB connectivity check (SELECT 1 via @nzila/db)
 * - Blob storage connectivity check (Azure Storage)
 * - Returns 200 if all healthy, 503 if degraded
 * - Public route (no auth required — see proxy.ts allowlist)
 */
import { NextResponse } from 'next/server'

const APP = 'zonga'
const VERSION = process.env.npm_package_version ?? '0.0.0'
const COMMIT = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? 'local'

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
    const client = container('zonga-audio')
    await client.getProperties()
    return true
  } catch {
    return false
  }
}

async function checkRedis(): Promise<boolean> {
  try {
    // No Redis configured — skip check
    if (!process.env.UPSTASH_REDIS_REST_URL && !process.env.REDIS_URL) return true
    const { getRateLimitStore } = await import('@nzila/os-core/rateLimit/store')
    const store = await getRateLimitStore()
    await store.hit('_health_probe', 60_000, 9999)
    return true
  } catch {
    return false
  }
}

export async function GET() {
  const [db, blob, redis] = await Promise.allSettled([checkDb(), checkBlob(), checkRedis()])

  const checks = {
    db: db.status === 'fulfilled' ? db.value : false,
    blob: blob.status === 'fulfilled' ? blob.value : false,
    redis: redis.status === 'fulfilled' ? redis.value : false,
  }

  const allHealthy = Object.values(checks).every(Boolean)

  return NextResponse.json(
    {
      status: allHealthy ? 'ok' : 'degraded',
      app: `@nzila/${APP}`,
      buildInfo: { version: VERSION, commit: COMMIT },
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: allHealthy ? 200 : 503 },
  )
}
