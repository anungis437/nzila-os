import { verifyOrganizationChain } from '@/lib/services/audit-inspection-service'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Chain Verification
 * POST /api/audit/verify-chain   → verify audit or ledger chain integrity
 *
 * Uses the @nzila/os-core verifyChain function to check append-only
 * hash chains for tamper detection.
 */
import { NextRequest, NextResponse } from 'next/server'

import { z } from 'zod'
import { requireOrgAccess } from '@/lib/api-guards'

const VerifyChainSchema = z.object({
  orgId: z.guid(),
  chainType: z.enum(['audit', 'ledger']),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = VerifyChainSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { orgId, chainType } = parsed.data

  // Check authentication + entity membership (platform_admin bypasses)
  const guard = await requireOrgAccess(orgId, {
    platformBypass: ['platform_admin'],
  })
  if (!guard.ok) return guard.response

  const result = await verifyOrganizationChain(orgId, chainType)
  return NextResponse.json(result.body, { status: result.status })
}
