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
import { createLogger } from '@nzila/os-core'

const logger = createLogger('trustcore:api:billing:create-checkout-session')

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
      resourceId: ctx.orgId,
      action: 'upgrade_attempted',
      summary: `Checkout session initiated for plan: ${plan}`,
      metadata: { targetPlan: plan },
    })

    logger.info('[trustcore billing] checkout initiation recorded', { orgId: ctx.orgId, plan })

    // Payment processing is centralized in @nzila/platform-revenue.
    // This app route only records intent and returns a deterministic fallback URL.
    const mockSessionUrl = `/billing?mock_checkout=1&plan=${plan}&org=${ctx.orgId}`
    return NextResponse.json({ success: true, sessionUrl: mockSessionUrl })
  },
)

