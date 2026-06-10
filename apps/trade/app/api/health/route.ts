/**
 * Trade Health & Readiness Route
 *
 * Production-grade liveness probe:
 * - DB connectivity check (SELECT 1 via @nzila/db)
 * - Returns 200 if healthy, 503 if degraded
 * - Public route (no auth required)
 */
import { NextResponse } from 'next/server'

const APP = 'trade'
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

export async function GET() {
  const dbResult = await checkDb()

  const checks = { db: dbResult }
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
