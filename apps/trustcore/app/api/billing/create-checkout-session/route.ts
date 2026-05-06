/**
 * TrustCore — Billing: Create Checkout Session (Stripe-ready stub)
 *
 * POST /api/billing/create-checkout-session
 *
 * Returns a mocked session URL. When Stripe is connected, replace the
 * mock body with a real `stripe.checkout.sessions.create(...)` call
 * using the priceId and stripeCustomerId from the subscription record.
 *
 * Body: { plan: 'pro' | 'premium' }
 * Response: { sessionUrl: string }
 *
 * Access: org_admin only
 * Logs:   upgrade_attempted evidence event
 */

import { NextRequest, NextResponse } from 'next/server'
import { withRequiredRole } from '@/lib/rbac/requireRole'
import { createTrustcoreEvidenceEvent } from '@nzila/db/queries/trustcore'

// Stripe price IDs — set via environment variables when Stripe is connected.
// const STRIPE_PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID
// const STRIPE_PREMIUM_PRICE_ID = process.env.STRIPE_PREMIUM_PRICE_ID

export const POST = withRequiredRole(
  ['org_admin', 'platform_admin'],
  async (req: NextRequest, ctx) => {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const plan = (body as { plan?: unknown }).plan
    if (plan !== 'pro' && plan !== 'premium') {
      return NextResponse.json(
        { success: false, error: 'plan must be "pro" or "premium"' },
        { status: 422 },
      )
    }

    // Log upgrade attempt evidence
    await createTrustcoreEvidenceEvent({
      orgId: ctx.orgId,
      actorId: ctx.userId,
      entityType: 'subscription',
      entityId: ctx.orgId,
      action: 'upgrade_attempted',
      summary: `Checkout session initiated for plan: ${plan}`,
      metadata: { targetPlan: plan },
    })

    // ── Stripe integration placeholder ────────────────────────────────────
    // When STRIPE_SECRET_KEY is set, replace this block:
    //
    // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' })
    // const session = await stripe.checkout.sessions.create({
    //   mode: 'subscription',
    //   customer: subscription.stripeCustomerId ?? undefined,
    //   line_items: [{ price: plan === 'pro' ? STRIPE_PRO_PRICE_ID : STRIPE_PREMIUM_PRICE_ID, quantity: 1 }],
    //   success_url: `${process.env.APP_URL}/billing?upgraded=1`,
    //   cancel_url: `${process.env.APP_URL}/billing`,
    //   metadata: { orgId: ctx.orgId, plan },
    // })
    // return NextResponse.json({ success: true, sessionUrl: session.url })

    // Mock response for pre-Stripe environments
    const mockSessionUrl = `/billing?mock_checkout=1&plan=${plan}&org=${ctx.orgId}`
    return NextResponse.json({ success: true, sessionUrl: mockSessionUrl })
  },
)
