import {
  resolveTaxYearOrganization,
  listTaxInstallments,
  createTaxInstallment,
  loadTaxInstallment,
  updateTaxInstallment,
} from '@/lib/services/finance-tax-service'
import { TaxInstallmentPatchSchema } from '@/lib/validation/finance-patch-schemas'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Tax Installments
 * GET   /api/finance/tax/installments?taxYearId=...  → list installments
 * POST  /api/finance/tax/installments                → create installment record
 * PATCH /api/finance/tax/installments                → update installment (pay, mark late)
 *
 * PR5 — Org-scoped auth + audit events
 */
import { NextRequest, NextResponse } from 'next/server'

import { requireOrgAccess, authenticateUser } from '@/lib/api-guards'
import { CreateTaxInstallmentInput } from '@nzila/tax/types'

export async function GET(req: NextRequest) {
  const taxYearId = req.nextUrl.searchParams.get('taxYearId')
  const orgId = req.nextUrl.searchParams.get('orgId')

  if (!taxYearId && !orgId) {
    return NextResponse.json({ error: 'taxYearId or orgId required' }, { status: 400 })
  }

  const identity = await authenticateUser()
  if (!identity.ok) return identity.response
  const resolved = await resolveTaxYearOrganization(taxYearId, orgId)
  if (resolved.mismatch)
    return NextResponse.json({ error: 'Tax year does not belong to organization' }, { status: 403 })
  const resolvedEntityId = resolved.orgId
  if (!resolvedEntityId) {
    return NextResponse.json({ error: 'Could not resolve entity' }, { status: 400 })
  }

  const access = await requireOrgAccess(resolvedEntityId)
  if (!access.ok) return access.response

  const result = await listTaxInstallments(taxYearId, resolvedEntityId)
  return NextResponse.json(result.body, { status: result.status })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = CreateTaxInstallmentInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const access = await requireOrgAccess(parsed.data.orgId, {
    minRole: 'org_secretary',
  })
  if (!access.ok) return access.response

  const result = await createTaxInstallment(parsed.data, access.context)
  return NextResponse.json(result.body, { status: result.status })
}

export async function PATCH(req: NextRequest) {
  const parsedPatch = TaxInstallmentPatchSchema.safeParse(await req.json())
  if (!parsedPatch.success)
    return NextResponse.json({ error: parsedPatch.error.flatten() }, { status: 400 })
  const { id, ...updates } = parsedPatch.data

  // Fetch existing to get orgId
  const identity = await authenticateUser()
  if (!identity.ok) return identity.response
  const existing = await loadTaxInstallment(id)

  if (!existing) {
    return NextResponse.json({ error: 'Installment not found' }, { status: 404 })
  }

  const access = await requireOrgAccess(existing.orgId, {
    minRole: 'org_secretary',
  })
  if (!access.ok) return access.response

  const result = await updateTaxInstallment(id, updates, existing, access.context)
  return NextResponse.json(result.body, { status: result.status })
}
