import { NextResponse } from 'next/server'
import { getBuildMetadata, isReadyFromChecks, normalizeHealthChecks } from '@nzila/os-core/health'

const APP = 'veridian-admin'

export async function GET() {
  const checks = normalizeHealthChecks({ process: true })
  const ready = isReadyFromChecks(checks, ['process'])
  return NextResponse.json(
    {
      ready,
      status: ready ? 'ready' : 'not_ready',
      ...getBuildMetadata(APP),
      checks,
    },
    { status: ready ? 200 : 503 },
  )
}
