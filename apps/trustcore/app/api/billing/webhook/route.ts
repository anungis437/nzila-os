/**
 * TrustCore — Billing: Stripe Webhook
 *
 * POST /api/billing/webhook
 *
 * Handles incoming Stripe webhook events. Signature verification is enforced
 * when STRIPE_WEBHOOK_SECRET is set. Events are idempotent — duplicate event
 * IDs are ignored via an in-process Set (sufficient for single-instance;
 * replace with a DB table for multi-replica deployments).
 *
 * Handled events:
 *   - checkout.session.completed      → upsert subscription as active/pro
 *   - invoice.paid                    → refresh period dates
 *   - customer.subscription.updated   → update plan / status / period
 *   - customer.subscription.deleted   → set status=canceled, plan=free
 *
 * This route is intentionally UNPROTECTED — Stripe calls it directly.
 * Security is enforced by Stripe signature verification below.
 */

import { NextRequest, NextResponse } from 'next/server'
import { upsertTrustcoreSubscription } from '@nzila/db/queries/trustcore'
import { getStripeClient } from '@nzila/payments-stripe'

// In-process idempotency cache (sufficient for single-instance deployments)
const processedEventIds = new Set<string>()

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  const stripeKey = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  // ── No Stripe configured — log and ack ───────────────────────────────────
  if (!stripeKey || !webhookSecret) {
    return NextResponse.json({ received: true, note: 'Stripe not yet configured' })
  }

  // ── Signature verification ───────────────────────────────────────────────
  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: import('stripe').Stripe.Event
  try {
    const stripe = getStripeClient()
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
  }

  // ── Idempotency guard ────────────────────────────────────────────────────
  if (processedEventIds.has(event.id)) {
    return NextResponse.json({ received: true, duplicate: true })
  }
  processedEventIds.add(event.id)
  // Keep the set bounded to prevent unbounded growth in long-running instances
  if (processedEventIds.size > 10_000) {
    const first = processedEventIds.values().next().value
    if (first) processedEventIds.delete(first)
  }

  // ── Event handling ───────────────────────────────────────────────────────
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as import('stripe').Stripe.Checkout.Session
        const orgId = session.metadata?.orgId
        const plan = (session.metadata?.plan ?? 'pro') as 'pro' | 'premium'
        if (!orgId) {
          break
        }
        await upsertTrustcoreSubscription({
          orgId,
          plan,
          status: 'active',
          stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
          stripeSubscriptionId:
            typeof session.subscription === 'string' ? session.subscription : null,
        })
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as import('stripe').Stripe.Invoice
        // In Stripe v22 (dahlia), subscription ID lives on invoice.parent
        const parentSub = invoice.parent?.subscription_details?.subscription
        const subId = typeof parentSub === 'string' ? parentSub : null
        if (!subId) break

        // Fetch subscription to get metadata (orgId) and period dates
        const stripe = getStripeClient()
        const sub = await stripe.subscriptions.retrieve(subId)
        const orgId = sub.metadata?.orgId
        if (!orgId) break

        // current_period is on SubscriptionItem in v22
        const item = sub.items.data[0]
        await upsertTrustcoreSubscription({
          orgId,
          plan: (sub.metadata?.plan ?? 'pro') as 'pro' | 'premium',
          status: 'active',
          stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : null,
          stripeSubscriptionId: sub.id,
          currentPeriodStart: item ? new Date(item.current_period_start * 1000) : undefined,
          currentPeriodEnd: item ? new Date(item.current_period_end * 1000) : undefined,
        })
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as import('stripe').Stripe.Subscription
        const orgId = sub.metadata?.orgId
        if (!orgId) {
          break
        }
        const item = sub.items.data[0]
        await upsertTrustcoreSubscription({
          orgId,
          plan: (sub.metadata?.plan ?? 'pro') as 'pro' | 'premium',
          status: sub.status as 'active' | 'trialing' | 'past_due' | 'canceled',
          stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : null,
          stripeSubscriptionId: sub.id,
          currentPeriodStart: item ? new Date(item.current_period_start * 1000) : undefined,
          currentPeriodEnd: item ? new Date(item.current_period_end * 1000) : undefined,
        })
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as import('stripe').Stripe.Subscription
        const orgId = sub.metadata?.orgId
        if (!orgId) {
          break
        }
        // Downgrade to free — do NOT delete the record
        await upsertTrustcoreSubscription({
          orgId,
          plan: 'free',
          status: 'canceled',
          stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : null,
          stripeSubscriptionId: sub.id,
        })
        break
      }

      default:
        // Unhandled event types are acknowledged without error
        break
    }
  } catch {
    // Return 500 so Stripe retries the event
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

