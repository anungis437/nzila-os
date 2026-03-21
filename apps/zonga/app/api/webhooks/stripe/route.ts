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

  if (metadata.plan_type === 'listener_premium' && metadata.listener_id) {
    await platformDb.execute(
      sql`UPDATE zonga_listeners SET
        plan = 'premium',
        subscription_status = 'active',
        stripe_customer_id = ${customerId},
        stripe_subscription_id = ${subscriptionId},
        updated_at = NOW()
      WHERE id = ${metadata.listener_id}`,
    )
    logger.info('Listener upgraded to premium', {
      listenerId: metadata.listener_id,
      subscriptionId,
    })
  }

  if (metadata.plan_type === 'label' && metadata.creator_id) {
    await platformDb.execute(
      sql`UPDATE zonga_creators SET
        plan = 'label',
        subscription_status = 'active',
        stripe_customer_id = ${customerId},
        stripe_subscription_id = ${subscriptionId},
        updated_at = NOW()
      WHERE id = ${metadata.creator_id}`,
    )
    logger.info('Creator upgraded to label plan', {
      creatorId: metadata.creator_id,
      subscriptionId,
    })
  }
}

/* ─── Subscription Updated ─── */

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const metadata = subscription.metadata ?? {}
  const status = subscription.status
  const subscriptionId = subscription.id

  // Map Stripe status → our enum
  const mappedStatus = mapStripeStatus(status)

  if (metadata.plan_type === 'listener_premium' && metadata.listener_id) {
    const firstItem = subscription.items.data[0]
    const periodEnd = firstItem?.current_period_end
      ? new Date(firstItem.current_period_end * 1000)
      : null

    await platformDb.execute(
      sql`UPDATE zonga_listeners SET
        subscription_status = ${mappedStatus},
        current_period_end = ${periodEnd},
        updated_at = NOW()
      WHERE stripe_subscription_id = ${subscriptionId}`,
    )
  }

  if (metadata.plan_type === 'label' && metadata.creator_id) {
    await platformDb.execute(
      sql`UPDATE zonga_creators SET
        subscription_status = ${mappedStatus},
        updated_at = NOW()
      WHERE stripe_subscription_id = ${subscriptionId}`,
    )
  }
}

/* ─── Subscription Deleted (Canceled) ─── */

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const subscriptionId = subscription.id
  const metadata = subscription.metadata ?? {}

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
    logger.info('Listener subscription canceled, reverted to free', { subscriptionId })
  }

  if (metadata.plan_type === 'label') {
    await platformDb.execute(
      sql`UPDATE zonga_creators SET
        plan = 'artist',
        subscription_status = 'canceled',
        stripe_subscription_id = NULL,
        updated_at = NOW()
      WHERE stripe_subscription_id = ${subscriptionId}`,
    )
    logger.info('Creator label subscription canceled, reverted to artist', { subscriptionId })
  }
}

/* ─── Invoice Paid (Renewal) ─── */

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // In newer Stripe API versions, subscription may be on the lines or metadata
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
