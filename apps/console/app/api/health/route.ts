// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
import { NextResponse } from 'next/server'

const APP = 'console'
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
    const connectionStr = process.env.BLOB_CONNECTION_STRING
    if (!connectionStr) return false
    const { BlobServiceClient } = await import('@azure/storage-blob')
    const client = BlobServiceClient.fromConnectionString(connectionStr)
    await client.getProperties()
    return true
  } catch {
    return false
  }
}

export async function GET() {
  const [db, blob] = await Promise.allSettled([checkDb(), checkBlob()])

  const checks = {
    db: db.status === 'fulfilled' ? db.value : false,
    blob: blob.status === 'fulfilled' ? blob.value : false,
  }

  const allHealthy = Object.values(checks).every(Boolean)

  return NextResponse.json(
    {
      status: allHealthy ? 'ok' : 'degraded',
      app: APP,
      buildInfo: { version: VERSION, commit: COMMIT },
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: allHealthy ? 200 : 503 },
  )
}
