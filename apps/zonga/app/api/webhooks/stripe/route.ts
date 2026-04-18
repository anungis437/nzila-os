/**
 * API — /api/webhooks/stripe
 *
 * Receives Stripe webhook events and processes subscription lifecycle changes.
 * Body parsing must be disabled — we need the raw body for signature verification.
 */
import { NextResponse } from 'next/server'
import { verifyWebhookSignature, WebhookSignatureError } from '@nzila/payments-stripe'
import { platformDb } from '@nzila/db/platform'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import type Stripe from 'stripe'
import {
  emitSubscriptionStarted,
  emitSubscriptionUpgraded,
  emitSubscriptionCancelled,
} from '@nzila/platform-events/commercial'
import { PlatformEventBus } from '@nzila/platform-events'

const bus = new PlatformEventBus()

/** Canonical creator plan keys — must match zonga_creator_plan DB enum */
type CreatorPlanKey = 'starter' | 'pro' | 'business' | 'label' | 'enterprise'

/** Map Stripe metadata plan_type → canonical DB plan column value */
function mapCreatorPlanType(planType: string): CreatorPlanKey | null {
  const map: Record<string, CreatorPlanKey> = {
    starter: 'starter',
    pro: 'pro',
    pro_creator: 'pro', // backward compat alias
    business: 'business',
    label: 'label',
    enterprise: 'enterprise',
  }
  return map[planType] ?? null
}

/** Monthly value in USD for a creator plan (for revenue event) */
function creatorPlanMrrUsd(planKey: CreatorPlanKey): number {
  const mrr: Record<CreatorPlanKey, number> = {
    starter: 0,
    pro: 29,
    business: 149,
    label: 499,
    enterprise: 999, // conservative default for custom plans
  }
  return mrr[planKey] ?? 0
}

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    const rawBody = await request.text()
    const result = verifyWebhookSignature(rawBody, signature)
    event = result.event
  } catch (err) {
    if (err instanceof WebhookSignatureError) {
      logger.error('Webhook signature verification failed', { error: err.message })
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }
    throw err
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice)
        break

      default:
        logger.info('Unhandled webhook event type', { type: event.type })
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    logger.error('Webhook handler error', { type: event.type, error })
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}

/* ─── Checkout Completed ─── */

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== 'subscription') return

  const metadata = session.metadata ?? {}
  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : (session.subscription as Stripe.Subscription | null)?.id

  if (!subscriptionId) return

  const customerId = typeof session.customer === 'string'
    ? session.customer
    : (session.customer as Stripe.Customer | null)?.id

  const platformOrgId = process.env.PLATFORM_ORG_ID ?? 'system'

  // ── Listener premium ──
  if (metadata.plan_type === 'listener_premium' && metadata.listener_id) {
    await platformDb.execute(
      sql`UPDATE zonga_listeners SET
        plan = 'premium',
        subscription_status = 'active',
        stripe_customer_id = ${customerId},
        stripe_subscription_id = ${subscriptionId},
        updated_at = NOW()
      WHERE user_id = ${metadata.listener_id}`,
    )
    void bus.emit(emitSubscriptionStarted(
      {
        userId: metadata.listener_id,
        orgId: platformOrgId,
        appId: 'zonga',
        planId: 'listener_premium',
        billingCycle: 'monthly',
        mrrUsd: 4.99,
        stripeSubscriptionId: subscriptionId,
      },
      { orgId: platformOrgId, actorId: metadata.listener_id },
    ))
    logger.info('Listener upgraded to premium', { listenerId: metadata.listener_id, subscriptionId })
  }

  // ── Creator plans (starter / pro / business / label / enterprise) ──
  const creatorPlan = mapCreatorPlanType(metadata.plan_type ?? '')
  if (creatorPlan && metadata.creator_id) {
    await platformDb.execute(
      sql`UPDATE zonga_creators SET
        plan = ${creatorPlan},
        subscription_status = 'active',
        stripe_customer_id = ${customerId},
        stripe_subscription_id = ${subscriptionId},
        updated_at = NOW()
      WHERE id = ${metadata.creator_id}`,
    )
    void bus.emit(emitSubscriptionStarted(
      {
        userId: metadata.creator_id,
        orgId: platformOrgId,
        appId: 'zonga',
        planId: creatorPlan,
        billingCycle: 'monthly',
        mrrUsd: creatorPlanMrrUsd(creatorPlan),
        stripeSubscriptionId: subscriptionId,
      },
      { orgId: platformOrgId, actorId: metadata.creator_id },
    ))
    logger.info('Creator upgraded to plan', { creatorId: metadata.creator_id, plan: creatorPlan, subscriptionId })
  }
}

/* ─── Subscription Updated ─── */

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const metadata = subscription.metadata ?? {}
  const status = subscription.status
  const subscriptionId = subscription.id
  const mappedStatus = mapStripeStatus(status)
  const platformOrgId = process.env.PLATFORM_ORG_ID ?? 'system'

  if (metadata.plan_type === 'listener_premium' && metadata.listener_id) {
    const firstItem = subscription.items.data[0]
    const periodEnd = firstItem?.current_period_end
      ? new Date(firstItem.current_period_end * 1000).toISOString()
      : null

    await platformDb.execute(
      sql`UPDATE zonga_listeners SET
        subscription_status = ${mappedStatus},
        current_period_end = ${periodEnd}::timestamptz,
        updated_at = NOW()
      WHERE stripe_subscription_id = ${subscriptionId}`,
    )
  }

  const creatorPlan = mapCreatorPlanType(metadata.plan_type ?? '')
  if (creatorPlan && metadata.creator_id) {
    // Fetch previous plan for upgrade event delta
    const rows = await platformDb.execute(
      sql`SELECT plan FROM zonga_creators WHERE id = ${metadata.creator_id} LIMIT 1`,
    )
    const prevPlan = (rows[0] as { plan?: string } | undefined)?.plan ?? creatorPlan

    await platformDb.execute(
      sql`UPDATE zonga_creators SET
        plan = ${creatorPlan},
        subscription_status = ${mappedStatus},
        updated_at = NOW()
      WHERE stripe_subscription_id = ${subscriptionId}`,
    )

    if (prevPlan !== creatorPlan) {
      void bus.emit(emitSubscriptionUpgraded(
        {
          userId: metadata.creator_id,
          orgId: platformOrgId,
          appId: 'zonga',
          fromPlanId: prevPlan,
          toPlanId: creatorPlan,
          expansionMrrUsd: Math.max(0, creatorPlanMrrUsd(creatorPlan) - creatorPlanMrrUsd(prevPlan as CreatorPlanKey)),
          stripeSubscriptionId: subscriptionId,
        },
        { orgId: platformOrgId, actorId: metadata.creator_id },
      ))
    }
  }
}

/* ─── Subscription Deleted (Canceled) ─── */

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const subscriptionId = subscription.id
  const metadata = subscription.metadata ?? {}
  const platformOrgId = process.env.PLATFORM_ORG_ID ?? 'system'

  if (metadata.plan_type === 'listener_premium') {
    await platformDb.execute(
      sql`UPDATE zonga_listeners SET
        plan = 'free',
        subscription_status = 'canceled',
        stripe_subscription_id = NULL,
        current_period_end = NULL,
        updated_at = NOW()
      WHERE stripe_subscription_id = ${subscriptionId}`,
    )
    void bus.emit(emitSubscriptionCancelled(
      {
        userId: metadata.listener_id,
        orgId: platformOrgId,
        appId: 'zonga',
        planId: 'listener_premium',
        mrrLostUsd: 4.99,
        stripeSubscriptionId: subscriptionId,
      },
      { orgId: platformOrgId, actorId: metadata.listener_id ?? 'system' },
    ))
    logger.info('Listener subscription canceled, reverted to free', { subscriptionId })
  }

  const creatorPlan = mapCreatorPlanType(metadata.plan_type ?? '')
  if (creatorPlan && metadata.creator_id) {
    await platformDb.execute(
      sql`UPDATE zonga_creators SET
        plan = 'starter',
        subscription_status = 'canceled',
        stripe_subscription_id = NULL,
        updated_at = NOW()
      WHERE stripe_subscription_id = ${subscriptionId}`,
    )
    void bus.emit(emitSubscriptionCancelled(
      {
        userId: metadata.creator_id,
        orgId: platformOrgId,
        appId: 'zonga',
        planId: creatorPlan,
        mrrLostUsd: creatorPlanMrrUsd(creatorPlan),
        stripeSubscriptionId: subscriptionId,
      },
      { orgId: platformOrgId, actorId: metadata.creator_id },
    ))
    logger.info('Creator subscription canceled, reverted to starter', { subscriptionId, prevPlan: creatorPlan })
  }
}

/* ─── Invoice Paid (Renewal) ─── */

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const obj = invoice as unknown as Record<string, unknown>
  const sub = obj.subscription
  const subscriptionId = typeof sub === 'string'
    ? sub
    : (sub as { id?: string } | null)?.id ?? null

  if (!subscriptionId) return

  // Ensure subscription_status stays 'active' on successful renewal
  await platformDb.execute(
    sql`UPDATE zonga_listeners SET
      subscription_status = 'active',
      updated_at = NOW()
    WHERE stripe_subscription_id = ${subscriptionId}`,
  )

  await platformDb.execute(
    sql`UPDATE zonga_creators SET
      subscription_status = 'active',
      updated_at = NOW()
    WHERE stripe_subscription_id = ${subscriptionId}`,
  )
}

/* ─── Helpers ─── */

function mapStripeStatus(status: string): string {
  const map: Record<string, string> = {
    active: 'active',
    past_due: 'past_due',
    canceled: 'canceled',
    trialing: 'trialing',
    incomplete: 'incomplete',
    incomplete_expired: 'canceled',
    unpaid: 'past_due',
    paused: 'canceled',
  }
  return map[status] ?? 'incomplete'
}

