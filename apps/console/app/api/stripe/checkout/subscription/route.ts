// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * POST /api/stripe/checkout/subscription
 *
 * Creates a Stripe Checkout Session in `subscription` mode.
 * Returns { url } for the frontend to redirect the user to Stripe's hosted page.
 *
 * After payment, Stripe redirects to:
 *   /settings/billing/success?session_id={CHECKOUT_SESSION_ID}
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSubscriptionCheckoutSession } from '@nzila/payments-stripe'
import { authenticateUser, requireOrgAccess } from '@/lib/api-guards'
import { recordAuditEvent } from '@/lib/audit-db'

const Schema = z.object({
  orgId: z.string().uuid(),
  priceId: z.string().min(1),
  customerId: z.string().optional(),
  ventureId: z.string().optional(),
  trialDays: z.number().int().min(0).optional(),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await authenticateUser()
  if (!auth.ok) return auth.response

  const body = await req.json()
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    )
  }

  const { orgId, priceId, customerId, ventureId, trialDays } = parsed.data

  const orgAccess = await requireOrgAccess(orgId, {
    minRole: 'org_secretary',
    platformBypass: ['platform_admin', 'studio_admin'],
  })
  if (!orgAccess.ok) return orgAccess.response

  const origin = req.nextUrl.origin
  const successUrl = `${origin}/settings/billing/success?session_id={CHECKOUT_SESSION_ID}`
  const cancelUrl = `${origin}/settings/billing`

  try {
    const { sessionId, url } = await createSubscriptionCheckoutSession({
      priceId,
      orgId,
      customerId,
      ventureId,
      successUrl,
      cancelUrl,
      trialDays,
      metadata: { org_id: orgId },
    })

    await recordAuditEvent({
      orgId,
      actorClerkUserId: auth.userId,
      actorRole: auth.platformRole,
      action: 'stripe.subscription_checkout_created',
      targetType: 'stripe_checkout_session',
      targetId: undefined,
      afterJson: { sessionId, priceId, customerId: customerId ?? null },
    })

    return NextResponse.json({ url })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
