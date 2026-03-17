// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
import { NextResponse } from 'next/server'
import { getAllQueueStats } from '@/lib/job-queue'

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
  try {
    const stats = await getAllQueueStats()
    if (!stats || stats.length === 0) return 'degraded'
    return 'ok'
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
      service: APP,
      status: allHealthy ? 'ok' : 'degraded',
      version: VERSION,
      uptime: Math.floor((Date.now() - START_TIME) / 1000),
      db_connection: dbOk,
      queue_status: queueStatus,
      buildInfo: { version: VERSION, commit: COMMIT },
      timestamp: new Date().toISOString(),
    },
    { status: allHealthy ? 200 : 503 },
  )
}

