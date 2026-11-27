import {
  loadTaxYear,
  readTaxYearDetail,
  changeTaxYearStatus,
} from '@/lib/services/finance-tax-service'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Tax Year by ID
 * GET    /api/finance/tax/years/[taxYearId]   → get tax year detail + close gate
 * PATCH  /api/finance/tax/years/[taxYearId]   → update status
 *
 * PR5 — Governance enforcement:
 *  • Org-scoped auth
 *  • Close gate + governance requirements enforced on PATCH to 'closed'
 *  • Hash-chained audit events
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireOrgAccess, authenticateUser } from '@/lib/api-guards'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ taxYearId: string }> },
) {
  const { taxYearId } = await params

  const identity = await authenticateUser()
  if (!identity.ok) return identity.response
  const taxYear = await loadTaxYear(taxYearId)

  if (!taxYear) {
    return NextResponse.json({ error: 'Tax year not found' }, { status: 404 })
  }

  const access = await requireOrgAccess(taxYear.orgId)
  if (!access.ok) return access.response

  const result = await readTaxYearDetail(taxYear)
  return NextResponse.json(result.body, { status: result.status })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ taxYearId: string }> },
) {
  const { taxYearId } = await params
  const TaxYearPatchSchema = z.object({ status: z.enum(['open', 'filed', 'assessed', 'closed']) })
  const bodyParsed = TaxYearPatchSchema.safeParse(await req.json())
  if (!bodyParsed.success) {
    return NextResponse.json({ error: bodyParsed.error.flatten() }, { status: 400 })
  }
  const newStatus = bodyParsed.data.status

  // Fetch the existing tax year for entity scoping
  const identity = await authenticateUser()
  if (!identity.ok) return identity.response
  const existing = await loadTaxYear(taxYearId)

  if (!existing) {
    return NextResponse.json({ error: 'Tax year not found' }, { status: 404 })
  }

  const access = await requireOrgAccess(existing.orgId, {
    minRole: 'org_secretary',
  })
  if (!access.ok) return access.response

  const result = await changeTaxYearStatus(taxYearId, newStatus, existing, access.context)
  return NextResponse.json(result.body, { status: result.status })
}
