import {
  resolveTaxYearOrganization,
  listTaxNotices,
  createTaxNotice,
} from '@/lib/services/finance-tax-service'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Tax Notices (CRA / RQ)
 * GET  /api/finance/tax/notices?taxYearId=...   → list notices for a tax year
 * POST /api/finance/tax/notices                 → record a received notice
 *
 * PR5 — Org-scoped auth + audit events
 */
import { NextRequest, NextResponse } from 'next/server'

import { requireOrgAccess, authenticateUser } from '@/lib/api-guards'
import { CreateTaxNoticeInput } from '@nzila/tax/types'

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

  const result = await listTaxNotices(taxYearId, resolvedEntityId)
  return NextResponse.json(result.body, { status: result.status })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = CreateTaxNoticeInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const access = await requireOrgAccess(parsed.data.orgId, {
    minRole: 'org_secretary',
  })
  if (!access.ok) return access.response

  const result = await createTaxNotice(parsed.data, access.context)
  return NextResponse.json(result.body, { status: result.status })
}
