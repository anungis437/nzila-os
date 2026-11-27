import {
  listIndirectTaxAccounts,
  createIndirectTaxAccount,
} from '@/lib/services/finance-tax-service'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Indirect Tax Accounts
 * GET  /api/finance/indirect-tax/accounts?orgId=...   → list accounts
 * POST /api/finance/indirect-tax/accounts                → register account
 *
 * PR5 — Org-scoped auth + audit events
 */
import { NextRequest, NextResponse } from 'next/server'

import { requireOrgAccess } from '@/lib/api-guards'
import { CreateIndirectTaxAccountInput } from '@nzila/tax/types'

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('orgId')
  if (!orgId) {
    return NextResponse.json({ error: 'orgId required' }, { status: 400 })
  }

  const access = await requireOrgAccess(orgId)
  if (!access.ok) return access.response

  const result = await listIndirectTaxAccounts(orgId)
  return NextResponse.json(result.body, { status: result.status })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = CreateIndirectTaxAccountInput.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const access = await requireOrgAccess(parsed.data.orgId, {
    minRole: 'org_secretary',
  })
  if (!access.ok) return access.response

  const result = await createIndirectTaxAccount(parsed.data, access.context)
  return NextResponse.json(result.body, { status: result.status })
}
