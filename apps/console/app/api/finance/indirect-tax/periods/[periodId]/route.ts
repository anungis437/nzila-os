import {
  loadIndirectTaxPeriod,
  readIndirectTaxPeriodDetail,
  changeIndirectTaxPeriodStatus,
} from '@/lib/services/finance-tax-service'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Indirect Tax Period Detail
 * GET   /api/finance/indirect-tax/periods/[periodId]  → period detail + summary
 * PATCH /api/finance/indirect-tax/periods/[periodId]  → update period
 *
 * PR5 — Org-scoped auth + audit events
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireOrgAccess, authenticateUser } from '@/lib/api-guards'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ periodId: string }> },
) {
  const { periodId } = await params

  const identity = await authenticateUser()
  if (!identity.ok) return identity.response
  const period = await loadIndirectTaxPeriod(periodId)

  if (!period) {
    return NextResponse.json({ error: 'Period not found' }, { status: 404 })
  }

  const access = await requireOrgAccess(period.orgId)
  if (!access.ok) return access.response

  const result = await readIndirectTaxPeriodDetail(period)
  return NextResponse.json(result.body, { status: result.status })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ periodId: string }> },
) {
  const { periodId } = await params
  const IndirectTaxPeriodPatchSchema = z.object({
    status: z.enum(['open', 'filed', 'paid', 'closed']).optional(),
  })
  const bodyParsed = IndirectTaxPeriodPatchSchema.safeParse(await req.json())
  if (!bodyParsed.success) {
    return NextResponse.json({ error: bodyParsed.error.flatten() }, { status: 400 })
  }
  const body = bodyParsed.data

  // Fetch existing for entity scoping and previous state
  const identity = await authenticateUser()
  if (!identity.ok) return identity.response
  const existing = await loadIndirectTaxPeriod(periodId)

  if (!existing) {
    return NextResponse.json({ error: 'Period not found' }, { status: 404 })
  }

  const access = await requireOrgAccess(existing.orgId, {
    minRole: 'org_secretary',
  })
  if (!access.ok) return access.response

  const result = await changeIndirectTaxPeriodStatus(periodId, body, existing, access.context)
  return NextResponse.json(result.body, { status: result.status })
}
