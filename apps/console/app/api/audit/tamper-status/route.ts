import { readTamperStatus } from '@/lib/services/audit-inspection-service'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Tamper Verification Status
 * GET /api/audit/tamper-status   → latest seal/chain verification summary
 *
 * Returns the most recent verification timestamp and pass/fail status.
 * Used by the console proof widget.
 */
import { NextRequest, NextResponse } from 'next/server'

import { requirePlatformRole } from '@/lib/api-guards'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  const authResult = await requirePlatformRole('platform_admin', 'studio_admin', 'ops', 'analyst')
  if (!authResult.ok) return authResult.response
  const result = await readTamperStatus()
  return NextResponse.json(result.body, { status: result.status })
}
