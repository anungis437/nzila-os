/**
 * Platform Admin Health & Readiness Route
 *
 * Production-grade liveness probe:
 * - DB connectivity check (SELECT 1 via @nzila/db)
 * - Returns 200 if healthy, degraded if DB unreachable
 * - Public route (no auth required)
 */
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const APP = 'platform-admin'
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
  const dbOk = await checkDb()
  const status = dbOk ? 'ok' : 'degraded'

  return NextResponse.json(
    {
      status,
      app: `@nzila/${APP}`,
      buildInfo: { version: VERSION, commit: COMMIT },
      checks: { db: dbOk ? 'ok' : 'degraded' },
      timestamp: new Date().toISOString(),
    },
    { status: status === 'ok' ? 200 : 503 },
  )
}
