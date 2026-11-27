import { loadStripeRefund, reviewOrganizationRefund } from '@/lib/services/stripe-billing-service'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * POST /api/stripe/refunds/approve — Approve a pending refund
 *
 * Org admins can approve pending refunds.
 * Platform admins/studio admins can approve via platform bypass.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { authenticateUser, requireOrgAccess } from '@/lib/api-guards'

const ApproveRefundSchema = z.object({
  refundId: z.guid(),
  orgId: z.guid(),
  action: z.enum(['approve', 'deny']),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await authenticateUser()
  if (!auth.ok) return auth.response

  const body = await req.json()
  const parsed = ApproveRefundSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    )
  }

  const { refundId, orgId, action: approvalAction } = parsed.data

  // Fetch the pending refund
  const refund = await loadStripeRefund(refundId)

  if (!refund) {
    return NextResponse.json({ error: 'Refund not found' }, { status: 404 })
  }
  if (refund.orgId !== orgId) {
    return NextResponse.json(
      { error: 'Forbidden: refund does not belong to organization' },
      { status: 403 },
    )
  }

  const orgAccess = await requireOrgAccess(refund.orgId, {
    minRole: 'org_admin',
    platformBypass: ['platform_admin', 'studio_admin'],
  })
  if (!orgAccess.ok) return orgAccess.response

  const result = await reviewOrganizationRefund(refundId, approvalAction, refund, auth)
  return NextResponse.json(result.body, { status: result.status })
}
