import { createOrganizationBillingPortal } from '@/lib/services/stripe-billing-service'
// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * POST /api/stripe/customer-portal — Create a Stripe Billing Portal Session
 *
 * Returns a redirect URL to the Stripe-hosted customer portal where the
 * customer can manage payment methods, view invoices, and cancel/update
 * their subscription.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { authenticateUser, requireOrgAccess } from '@/lib/api-guards'
import { isAllowedBillingRedirect } from '@/lib/server-redirects'

const CreatePortalSchema = z.object({
  orgId: z.guid(),
  customerId: z.string().min(1),
  returnUrl: z.string().url(),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await authenticateUser()
  if (!auth.ok) return auth.response

  const body = await req.json()
  const parsed = CreatePortalSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    )
  }

  const { orgId, returnUrl } = parsed.data

  if (!isAllowedBillingRedirect(returnUrl, req.nextUrl.origin)) {
    return NextResponse.json(
      { error: 'Invalid returnUrl: must be same-origin or allowlisted' },
      { status: 400 },
    )
  }

  const orgAccess = await requireOrgAccess(orgId, {
    platformBypass: ['platform_admin', 'studio_admin'],
  })
  if (!orgAccess.ok) return orgAccess.response

  const result = await createOrganizationBillingPortal(parsed.data)
  return NextResponse.json(result.body, { status: result.status })
}
