// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * POST /api/stripe/webhooks — Stripe webhook handler
 *
 * IMPORTANT: Next.js body parsing MUST be disabled for this route
 * so we can verify the raw body against the Stripe signature.
 *
 * Handles:
 *   checkout.session.completed      → provision one-time payments
 *   customer.subscription.created   → initial subscription record
 *   customer.subscription.updated   → sync status / plan changes
 *   customer.subscription.deleted   → mark canceled
 *   invoice.paid                    → mark active, extend period
 *   invoice.payment_failed          → mark past_due, notify
 */
import { NextRequest, NextResponse } from 'next/server'
import type { Stripe } from '@nzila/payments-stripe'
import { verifyWebhookSignature, WebhookSignatureError } from '@nzila/payments-stripe/webhooks'
import { platformDb } from '@nzila/db/platform'
import { stripeSubscriptions } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'
import { createLogger } from '@nzila/os-core'

const logger = createLogger('stripe:webhooks')

export const runtime = 'nodejs'

// Disable Next.js body parsing — Stripe needs the raw body for sig verification
export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = Buffer.from(await req.arrayBuffer())
  const signature = req.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event

  try {
    const result = verifyWebhookSignature(rawBody, signature)
    event = result.event
  } catch (err) {
    if (err instanceof WebhookSignatureError) {
      logger.warn('Invalid signature', { detail: err.message })
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }
    throw err
  }

  try {
    await handleStripeEvent(event)
  } catch (err) {
    logger.error(`[stripe/webhooks] Error handling event ${event.type}:`, err instanceof Error ? err : { detail: err })
    // Return 200 to prevent Stripe from retrying for handler errors (not sig errors)
    return NextResponse.json({ received: true, error: 'Handler error' })
  }

  return NextResponse.json({ received: true })
}

async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      await upsertSubscription(sub)
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await platformDb
        .update(stripeSubscriptions)
        .set({
          status: 'canceled',
          canceledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(stripeSubscriptions.stripeSubscriptionId, sub.id))
      logger.info(`[stripe/webhooks] Subscription canceled: ${sub.id}`)
      break
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice
      // Stripe v20: invoice.subscription removed → use invoice.parent.subscription_details
      const subRef = invoice.parent?.subscription_details?.subscription
      if (subRef) {
        const subId = typeof subRef === 'string' ? subRef : subRef.id
        await platformDb
          .update(stripeSubscriptions)
          .set({ status: 'active', updatedAt: new Date() })
          .where(eq(stripeSubscriptions.stripeSubscriptionId, subId))
        logger.info(`[stripe/webhooks] Invoice paid, subscription active: ${subId}`)
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      // Stripe v20: invoice.subscription removed → use invoice.parent.subscription_details
      const subRef = invoice.parent?.subscription_details?.subscription
      if (subRef) {
        const subId = typeof subRef === 'string' ? subRef : subRef.id
        await platformDb
          .update(stripeSubscriptions)
          .set({ status: 'past_due', updatedAt: new Date() })
          .where(eq(stripeSubscriptions.stripeSubscriptionId, subId))
        logger.warn(`[stripe/webhooks] Payment failed, subscription past_due: ${subId}`)
        // Payment failure notification — logged for downstream notification pipeline.
        // When platform-events notification service is wired, emit a
        // 'subscription.payment_failed' event here for email delivery.
        logger.info(`[stripe/webhooks] Payment failure notification pending`, {
          event: 'subscription.payment_failed',
          subscriptionId: subId,
          invoiceId: invoice.id,
          customerId: typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id,
        })
      }
      break
    }

    case 'checkout.session.completed': {
      // Handled by one-time checkout flow — subscription provisioning done via sub events
      logger.info('[stripe/webhooks] checkout.session.completed received')
      break
    }

    default:
      logger.info(`[stripe/webhooks] Unhandled event type: ${event.type}`)
  }
}

async function upsertSubscription(sub: Stripe.Subscription): Promise<void> {
  const priceItem = sub.items.data[0]
  const price = priceItem?.price
  const product = price?.product

  // Stripe v20: current_period_start/end moved from Subscription to SubscriptionItem
  const values = {
    stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    stripePriceId: price?.id ?? '',
    stripeProductId: typeof product === 'string' ? product : product?.id ?? null,
    planName: typeof product === 'object' && product !== null ? (product as Stripe.Product).name : null,
    planInterval: price?.recurring?.interval ?? null,
    amountCents: price?.unit_amount ? BigInt(price.unit_amount) : null,
    currency: (price?.currency?.toUpperCase() ?? 'CAD') as string,
    status: sub.status as 'incomplete' | 'incomplete_expired' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused',
    currentPeriodStart: priceItem ? new Date(priceItem.current_period_start * 1000) : null,
    currentPeriodEnd: priceItem ? new Date(priceItem.current_period_end * 1000) : null,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
    trialStart: sub.trial_start ? new Date(sub.trial_start * 1000) : null,
    trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    updatedAt: new Date(),
  }

  const existing = await platformDb
    .select({ id: stripeSubscriptions.id })
    .from(stripeSubscriptions)
    .where(eq(stripeSubscriptions.stripeSubscriptionId, sub.id))
    .limit(1)

  if (existing.length > 0) {
    await platformDb
      .update(stripeSubscriptions)
      .set(values)
      .where(eq(stripeSubscriptions.stripeSubscriptionId, sub.id))
  } else {
    // Insert new record — orgId comes from metadata set during creation
    const orgId = (sub.metadata as Record<string, string>)?.org_id
    if (!orgId) {
      logger.warn(`[stripe/webhooks] No org_id in subscription metadata: ${sub.id}`)
      return
    }
    await platformDb.insert(stripeSubscriptions).values({
      orgId,
      stripeSubscriptionId: sub.id,
      createdBy: 'webhook',
      ...values,
    })
  }

  logger.info(`[stripe/webhooks] Subscription upserted: ${sub.id} (${sub.status})`)
}
