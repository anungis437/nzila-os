// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * POST /api/stripe/subscriptions — Create a Stripe Subscription
 *
 * Creates a Subscription with payment_behavior='default_incomplete'.
 * Returns the clientSecret for the frontend <PaymentElement> to confirm.
 *
 * GET /api/stripe/subscriptions?orgId=... — List subscriptions for an entity
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createSubscription } from '@nzila/payments-stripe/primitives'
import { authenticateUser, requireOrgAccess } from '@/lib/api-guards'
import { recordAuditEvent } from '@/lib/audit-db'
import { platformDb } from '@nzila/db/platform'
import { stripeSubscriptions } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'
import { createLogger } from '@nzila/os-core'

const logger = createLogger('stripe:subscriptions')

const CreateSubscriptionSchema = z.object({
  orgId: z.string().uuid(),
  ventureId: z.string().optional(),
  customerId: z.string().min(1),
  priceId: z.string().min(1),
  trialDays: z.number().int().min(0).optional(),
  metadata: z.record(z.string()).optional(),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await authenticateUser()
  if (!auth.ok) return auth.response

  const body = await req.json()
  const parsed = CreateSubscriptionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 },
    )
  }

  const input = parsed.data

  const orgAccess = await requireOrgAccess(input.orgId, {
    minRole: 'org_secretary',
    platformBypass: ['platform_admin', 'studio_admin'],
  })
  if (!orgAccess.ok) return orgAccess.response

  try {
    const result = await createSubscription({
      customerId: input.customerId,
      priceId: input.priceId,
      orgId: input.orgId,
      ventureId: input.ventureId,
      trialDays: input.trialDays,
      metadata: input.metadata,
    })

    // Persist to DB (status will be updated via webhook)
    await platformDb.insert(stripeSubscriptions).values({
      orgId: input.orgId,
      stripeCustomerId: input.customerId,
      stripeSubscriptionId: result.subscriptionId,
      stripePriceId: input.priceId,
      status: result.status as 'incomplete',
      currentPeriodEnd: result.currentPeriodEnd
        ? new Date(result.currentPeriodEnd * 1000)
        : null,
      createdBy: auth.userId,
    })

    await recordAuditEvent({
      orgId: input.orgId,
      actorClerkUserId: auth.userId,
      actorRole: auth.platformRole,
      action: 'stripe.subscription_created',
      targetType: 'stripe_subscription',
      targetId: undefined,
      afterJson: {
        subscriptionId: result.subscriptionId,
        priceId: input.priceId,
        status: result.status,
        ventureId: input.ventureId,
      },
    })

    return NextResponse.json(
      {
        subscriptionId: result.subscriptionId,
        clientSecret: result.clientSecret,
        status: result.status,
        currentPeriodEnd: result.currentPeriodEnd,
      },
      { status: 201 },
    )
  } catch (err) {
    logger.error('[stripe/subscriptions] Error creating subscription:', err instanceof Error ? err : { detail: err })
    return NextResponse.json(
      { error: 'Failed to create subscription' },
      { status: 500 },
    )
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await authenticateUser()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const orgId = searchParams.get('orgId')

  if (!orgId) {
    return NextResponse.json({ error: 'orgId is required' }, { status: 400 })
  }

  const orgAccess = await requireOrgAccess(orgId, {
    platformBypass: ['platform_admin', 'studio_admin'],
  })
  if (!orgAccess.ok) return orgAccess.response

  try {
    const subs = await platformDb
      .select()
      .from(stripeSubscriptions)
      .where(eq(stripeSubscriptions.orgId, orgId))
      .orderBy(stripeSubscriptions.createdAt)

    return NextResponse.json({ subscriptions: subs })
  } catch (err) {
    logger.error('[stripe/subscriptions] Error fetching subscriptions:', err instanceof Error ? err : { detail: err })
    return NextResponse.json(
      { error: 'Failed to fetch subscriptions' },
      { status: 500 },
    )
  }
}
