import {
  listIndirectTaxPeriods,
  createIndirectTaxPeriod,
  loadIndirectTaxPeriod,
  updateIndirectTaxPeriod,
} from '@/lib/services/finance-tax-service'
import { IndirectTaxPeriodPatchSchema } from '@/lib/validation/finance-patch-schemas'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Indirect Tax Periods
 * GET  /api/finance/indirect-tax/periods?orgId=...&accountId=...  → list periods
 * POST /api/finance/indirect-tax/periods                             → create period
 * PATCH /api/finance/indirect-tax/periods                            → update period
 *
 * PR5 — Org-scoped auth + audit events
 */
import { NextRequest, NextResponse } from 'next/server'

import { requireOrgAccess, authenticateUser } from '@/lib/api-guards'
import { CreateIndirectTaxPeriodInput } from '@nzila/tax/types'

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('orgId')
  const accountId = req.nextUrl.searchParams.get('accountId')

  if (!orgId) {
    return NextResponse.json({ error: 'orgId required' }, { status: 400 })
  }

  const access = await requireOrgAccess(orgId)
  if (!access.ok) return access.response

  const result = await listIndirectTaxPeriods(orgId, accountId)
  return NextResponse.json(result.body, { status: result.status })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = CreateIndirectTaxPeriodInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const access = await requireOrgAccess(parsed.data.orgId, {
    minRole: 'org_secretary',
  })
  if (!access.ok) return access.response

  const result = await createIndirectTaxPeriod(parsed.data, access.context)
  return NextResponse.json(result.body, { status: result.status })
}

export async function PATCH(req: NextRequest) {
  const parsedPatch = IndirectTaxPeriodPatchSchema.safeParse(await req.json())
  if (!parsedPatch.success)
    return NextResponse.json({ error: parsedPatch.error.flatten() }, { status: 400 })
  const { id, ...updates } = parsedPatch.data

  // Fetch existing to get orgId + previous status
  const identity = await authenticateUser()
  if (!identity.ok) return identity.response
  const existing = await loadIndirectTaxPeriod(id)

  if (!existing) {
    return NextResponse.json({ error: 'Period not found' }, { status: 404 })
  }

  const access = await requireOrgAccess(existing.orgId, {
    minRole: 'org_secretary',
  })
  if (!access.ok) return access.response

  const result = await updateIndirectTaxPeriod(id, updates, existing, access.context)
  return NextResponse.json(result.body, { status: result.status })
}
