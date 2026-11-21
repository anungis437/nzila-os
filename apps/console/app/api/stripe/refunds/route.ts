import { requestOrganizationRefund } from '@/lib/services/stripe-billing-service'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * POST /api/stripe/refunds — Request or execute a refund
 *
 * If amount >= STRIPE_REFUND_APPROVAL_THRESHOLD_CENTS:
 *   → Create pending refund row, require approval
 * If amount < threshold:
 *   → Execute refund immediately via Stripe API
 *
 * POST /api/stripe/refunds/approve — Approve a pending refund (finance_approver)
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { authenticateUser, requireOrgAccess } from '@/lib/api-guards'

const RequestRefundSchema = z.object({
  orgId: z.guid(),
  paymentId: z.guid(),
  amountCents: z.number().int().min(1),
  reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer']).optional(),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await authenticateUser()
  if (!auth.ok) return auth.response

  const body = await req.json()
  const parsed = RequestRefundSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    )
  }

  const { orgId } = parsed.data

  const orgAccess = await requireOrgAccess(orgId, {
    minRole: 'org_secretary',
    platformBypass: ['platform_admin', 'studio_admin'],
  })
  if (!orgAccess.ok) return orgAccess.response

  const result = await requestOrganizationRefund(parsed.data, auth)
  return NextResponse.json(result.body, { status: result.status })
}
