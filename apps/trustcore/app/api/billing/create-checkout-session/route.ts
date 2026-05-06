/**
 * TrustCore — Billing: Create Checkout Session
 *
 * POST /api/billing/create-checkout-session
 *
 * Creates a Stripe Checkout Session for upgrading to Pro.
 * When STRIPE_SECRET_KEY is set, returns the real Stripe Checkout URL.
 * Falls back to a mock URL in dev environments without Stripe configured.
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

    // ── Stripe integration ────────────────────────────────────────────────
    const stripeKey = process.env.STRIPE_SECRET_KEY
    const priceId =
      plan === 'pro'
        ? process.env.STRIPE_PRICE_PRO_ID
        : process.env.STRIPE_PRICE_PREMIUM_ID
    const appUrl = process.env.APP_URL ?? 'http://localhost:3010'

    if (stripeKey && priceId) {
      try {
        // Dynamic import keeps Stripe out of the bundle when the key is absent
        const { default: Stripe } = await import('stripe')
        const stripe = new Stripe(stripeKey, { apiVersion: '2026-04-22.dahlia' })

        const session = await stripe.checkout.sessions.create({
          mode: 'subscription',
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: `${appUrl}/billing?success=1`,
          cancel_url: `${appUrl}/billing?canceled=1`,
          metadata: { orgId: ctx.orgId, plan },
          // Allow the customer to provide their email at checkout
          customer_email: undefined,
        })

        return NextResponse.json({ success: true, sessionUrl: session.url })
      } catch (err) {
        console.error('[TrustCore billing] Stripe checkout error', err)
        return NextResponse.json(
          { success: false, error: 'Failed to create checkout session' },
          { status: 500 },
        )
      }
    }

    // Mock response when Stripe is not configured
    const mockSessionUrl = `/billing?mock_checkout=1&plan=${plan}&org=${ctx.orgId}`
    return NextResponse.json({ success: true, sessionUrl: mockSessionUrl })
  },
)

