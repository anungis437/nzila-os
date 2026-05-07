// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
import { NextResponse } from 'next/server'

const APP = 'trustcore'
const VERSION = process.env.npm_package_version ?? '0.0.0'
const COMMIT = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? 'local'

export async function GET() {
  const checks = { static: true }

  return NextResponse.json(
    {
      status: 'ok',
      service: APP,
      app: APP,
      buildInfo: { version: VERSION, commit: COMMIT },
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  )
}
