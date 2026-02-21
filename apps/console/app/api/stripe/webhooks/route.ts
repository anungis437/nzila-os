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
import type Stripe from 'stripe'
import { verifyWebhookSignature, WebhookSignatureError } from '@nzila/payments-stripe/webhooks'
import { db } from '@nzila/db'
import { stripeSubscriptions } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'

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
      console.warn('[stripe/webhooks] Invalid signature:', err.message)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }
    throw err
  }

  try {
    await handleStripeEvent(event)
  } catch (err) {
    console.error(`[stripe/webhooks] Error handling event ${event.type}:`, err)
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
      await db
        .update(stripeSubscriptions)
        .set({
          status: 'canceled',
          canceledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(stripeSubscriptions.stripeSubscriptionId, sub.id))
      console.log(`[stripe/webhooks] Subscription canceled: ${sub.id}`)
      break
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice
      if (invoice.subscription) {
        const subId = typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription.id
        await db
          .update(stripeSubscriptions)
          .set({ status: 'active', updatedAt: new Date() })
          .where(eq(stripeSubscriptions.stripeSubscriptionId, subId))
        console.log(`[stripe/webhooks] Invoice paid, subscription active: ${subId}`)
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      if (invoice.subscription) {
        const subId = typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription.id
        await db
          .update(stripeSubscriptions)
          .set({ status: 'past_due', updatedAt: new Date() })
          .where(eq(stripeSubscriptions.stripeSubscriptionId, subId))
        console.warn(`[stripe/webhooks] Payment failed, subscription past_due: ${subId}`)
        // TODO: send notification email to customer
      }
      break
    }

    case 'checkout.session.completed': {
      // Handled by one-time checkout flow — subscription provisioning done via sub events
      console.log('[stripe/webhooks] checkout.session.completed received')
      break
    }

    default:
      console.log(`[stripe/webhooks] Unhandled event type: ${event.type}`)
  }
}

async function upsertSubscription(sub: Stripe.Subscription): Promise<void> {
  const priceItem = sub.items.data[0]
  const price = priceItem?.price
  const product = price?.product

  const values = {
    stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    stripePriceId: price?.id ?? '',
    stripeProductId: typeof product === 'string' ? product : product?.id ?? null,
    planName: typeof product === 'object' && product !== null ? (product as Stripe.Product).name : null,
    planInterval: price?.recurring?.interval ?? null,
    amountCents: price?.unit_amount ? BigInt(price.unit_amount) : null,
    currency: (price?.currency?.toUpperCase() ?? 'CAD') as string,
    status: sub.status as 'incomplete' | 'incomplete_expired' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused',
    currentPeriodStart: new Date(sub.current_period_start * 1000),
    currentPeriodEnd: new Date(sub.current_period_end * 1000),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
    trialStart: sub.trial_start ? new Date(sub.trial_start * 1000) : null,
    trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    updatedAt: new Date(),
  }

  const existing = await db
    .select({ id: stripeSubscriptions.id })
    .from(stripeSubscriptions)
    .where(eq(stripeSubscriptions.stripeSubscriptionId, sub.id))
    .limit(1)

  if (existing.length > 0) {
    await db
      .update(stripeSubscriptions)
      .set(values)
      .where(eq(stripeSubscriptions.stripeSubscriptionId, sub.id))
  } else {
    // Insert new record — entityId comes from metadata set during creation
    const entityId = (sub.metadata as Record<string, string>)?.entity_id
    if (!entityId) {
      console.warn(`[stripe/webhooks] No entity_id in subscription metadata: ${sub.id}`)
      return
    }
    await db.insert(stripeSubscriptions).values({
      entityId,
      stripeSubscriptionId: sub.id,
      createdBy: 'webhook',
      ...values,
    })
  }

  console.log(`[stripe/webhooks] Subscription upserted: ${sub.id} (${sub.status})`)
}
