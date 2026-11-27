import {
  listFinanceGovernanceLinks,
  createFinanceGovernanceLink,
} from '@/lib/services/finance-tax-service'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Finance-Governance Links
 * GET  /api/finance/governance-links?orgId=...&sourceId=...  → list links
 * POST /api/finance/governance-links                            → create link
 *
 * PR5 — Org-scoped auth + audit events
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { requireOrgAccess } from '@/lib/api-guards'

const GovernanceLinkPostSchema = z.object({
  orgId: z.string().min(1),
  sourceType: z.string().min(1),
  sourceId: z.string().min(1),
  governanceType: z.string().min(1),
  governanceId: z.string().min(1),
  linkDescription: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get('orgId')
  const sourceId = req.nextUrl.searchParams.get('sourceId')

  if (!orgId) {
    return NextResponse.json({ error: 'orgId required' }, { status: 400 })
  }

  const access = await requireOrgAccess(orgId)
  if (!access.ok) return access.response

  const result = await listFinanceGovernanceLinks(orgId, sourceId)
  return NextResponse.json(result.body, { status: result.status })
}

export async function POST(req: NextRequest) {
  const parsed = GovernanceLinkPostSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { orgId } = parsed.data

  const access = await requireOrgAccess(orgId, {
    minRole: 'org_secretary',
  })
  if (!access.ok) return access.response

  const result = await createFinanceGovernanceLink(parsed.data, access.context)
  return NextResponse.json(result.body, { status: result.status })
}
