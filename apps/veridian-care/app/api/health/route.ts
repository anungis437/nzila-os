// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
import { NextResponse } from 'next/server'
import { getBuildMetadata, healthStatusFromChecks, normalizeHealthChecks } from '@nzila/os-core/health'

const APP = 'veridian-care'

export async function GET() {
  const checks = normalizeHealthChecks({
    process: true,
    syntheticDataStore: true,
  })
  const status = healthStatusFromChecks(checks)
  return NextResponse.json(
    { status, ...getBuildMetadata(APP), checks },
    { status: status === 'ok' ? 200 : 503 },
  )
}
