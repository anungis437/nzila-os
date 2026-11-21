import {
  loadIndirectTaxPeriod,
  readIndirectTaxSummary,
  upsertIndirectTaxSummary,
} from '@/lib/services/finance-tax-service'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Indirect Tax Summary
 * GET  /api/finance/indirect-tax/summary?periodId=...  → get summary for a period
 * POST /api/finance/indirect-tax/summary               → create/update summary
 *
 * PR5 — Org-scoped auth + audit events
 */
import { NextRequest, NextResponse } from 'next/server'

import { requireOrgAccess, authenticateUser } from '@/lib/api-guards'
import { UpdateIndirectTaxSummaryInput } from '@nzila/tax/types'

export async function GET(req: NextRequest) {
  const authResult = await authenticateUser()
  if (!authResult.ok) return authResult.response

  const periodId = req.nextUrl.searchParams.get('periodId')
  if (!periodId) {
    return NextResponse.json({ error: 'periodId required' }, { status: 400 })
  }

  const period = await loadIndirectTaxPeriod(periodId)
  if (!period) return NextResponse.json({ error: 'Period not found' }, { status: 404 })
  const access = await requireOrgAccess(period.orgId)
  if (!access.ok) return access.response
  const result = await readIndirectTaxSummary(periodId)
  return NextResponse.json(result.body, { status: result.status })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = UpdateIndirectTaxSummaryInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Resolve orgId from the period
  const identity = await authenticateUser()
  if (!identity.ok) return identity.response
  const period = await loadIndirectTaxPeriod(parsed.data.periodId)

  if (!period) {
    return NextResponse.json({ error: 'Period not found' }, { status: 404 })
  }

  const access = await requireOrgAccess(period.orgId, {
    minRole: 'org_secretary',
  })
  if (!access.ok) return access.response

  const result = await upsertIndirectTaxSummary(parsed.data, period, access.context)
  return NextResponse.json(result.body, { status: result.status })
}
