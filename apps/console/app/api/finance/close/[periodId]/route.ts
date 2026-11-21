import { loadClosePeriod, readClosePeriodDetail } from '@/lib/services/finance-close-service'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Close Period Detail
 * GET /api/finance/close/[periodId]  → close period with tasks, exceptions, approvals
 *
 * PR5 — Org-scoped auth via requireOrgAccess
 */
import { NextRequest, NextResponse } from 'next/server'

import { authenticateUser, requireOrgAccess } from '@/lib/api-guards'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ periodId: string }> },
) {
  const authResult = await authenticateUser()
  if (!authResult.ok) return authResult.response

  const { periodId } = await params

  const period = await loadClosePeriod(periodId)

  if (!period) {
    return NextResponse.json({ error: 'Close period not found' }, { status: 404 })
  }

  const access = await requireOrgAccess(period.orgId)
  if (!access.ok) return access.response
  const result = await readClosePeriodDetail(period)
  return NextResponse.json(result.body, { status: result.status })
}
