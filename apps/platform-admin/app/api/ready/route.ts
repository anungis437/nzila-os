/**
 * Platform Admin readiness probe (Post-Deploy smoke /api/ready).
 * Requires process + DB; public, no auth.
 */
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const APP = 'platform-admin'

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
  const ready = dbOk

  return NextResponse.json(
    {
      ready,
      status: ready ? 'ready' : 'not_ready',
      app: `@nzila/${APP}`,
      checks: {
        process: { status: 'ok' },
        database: { status: dbOk ? 'ok' : 'error' },
      },
      timestamp: new Date().toISOString(),
    },
    { status: ready ? 200 : 503 },
  )
}
