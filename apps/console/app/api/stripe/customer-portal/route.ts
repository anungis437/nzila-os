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
import { createPortalSession } from '@nzila/payments-stripe/primitives'
import { authenticateUser, requireOrgAccess } from '@/lib/api-guards'
import { isAllowedBillingRedirect } from '@/lib/server-redirects'
import { platformDb } from '@nzila/db/platform'
import { stripeSubscriptions } from '@nzila/db/schema'
import { and, eq } from 'drizzle-orm'
import { createLogger } from '@nzila/os-core'

const logger = createLogger('stripe:customer-portal')

const CreatePortalSchema = z.object({
  orgId: z.string().uuid(),
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

  const { orgId, customerId, returnUrl } = parsed.data

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

  const [linkedCustomer] = await platformDb
    .select({ id: stripeSubscriptions.id })
    .from(stripeSubscriptions)
    .where(
      and(
        eq(stripeSubscriptions.orgId, orgId),
        eq(stripeSubscriptions.stripeCustomerId, customerId),
      ),
    )
    .limit(1)
  if (!linkedCustomer) {
    return NextResponse.json(
      { error: 'Forbidden: customer is not linked to organization' },
      { status: 403 },
    )
  }

  try {
    const session = await createPortalSession({ customerId, returnUrl })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    logger.error('[stripe/customer-portal] Error creating portal session:', err instanceof Error ? err : { detail: err })
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 },
    )
  }
}
