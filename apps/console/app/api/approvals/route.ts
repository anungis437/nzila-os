import { listUserApprovals } from '@/lib/services/portfolio-overview-service'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Cross-entity approvals aggregation
 * GET  /api/approvals   → all pending approvals across user's orgs
 */
import { NextResponse } from 'next/server'

import { authenticateUser } from '@/lib/api-guards'

export async function GET() {
  const authResult = await authenticateUser()
  if (!authResult.ok) return authResult.response
  const { userId } = authResult

  const result = await listUserApprovals(userId)
  return NextResponse.json(result.body, { status: result.status })
}
