/**
 * TrustCore — Billing: Stripe Webhook (Stripe-ready stub)
 *
 * POST /api/billing/webhook
 *
 * Handles incoming Stripe webhook events.
 * When Stripe is connected, add your webhook secret verification
 * and event handling logic inside the switch below.
 *
 * Supported events (to implement):
 *   - customer.subscription.created   → upsert subscription record, plan=pro/premium
 *   - customer.subscription.updated   → update plan/status/period
 *   - customer.subscription.deleted   → set status=canceled
 *   - invoice.payment_failed          → set status=past_due
 *
 * This route is intentionally UNPROTECTED — Stripe calls it directly.
 * Signature verification (via stripe.webhooks.constructEvent) is REQUIRED
 * before processing any event.
 *
 * Access: public (no RBAC — verified by Stripe signature)
 */

import { NextRequest, NextResponse } from 'next/server'

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' })
// const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  // ── Stripe signature verification placeholder ─────────────────────────
  // When Stripe is connected, replace this block:
  //
  // let event: Stripe.Event
  // try {
  //   event = stripe.webhooks.constructEvent(body, sig, WEBHOOK_SECRET)
  // } catch (err) {
  //   return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 })
  // }
  //
  // switch (event.type) {
  //   case 'customer.subscription.created':
  //   case 'customer.subscription.updated': {
  //     const sub = event.data.object as Stripe.Subscription
  //     await upsertTrustcoreSubscription({
  //       orgId: sub.metadata.orgId,
  //       plan: sub.metadata.plan as 'pro' | 'premium',
  //       status: sub.status as SubscriptionStatus,
  //       currentPeriodStart: new Date(sub.current_period_start * 1000),
  //       currentPeriodEnd: new Date(sub.current_period_end * 1000),
  //       stripeCustomerId: sub.customer as string,
  //       stripeSubscriptionId: sub.id,
  //     })
  //     break
  //   }
  //   case 'customer.subscription.deleted': {
  //     const sub = event.data.object as Stripe.Subscription
  //     await upsertTrustcoreSubscription({ orgId: sub.metadata.orgId, status: 'canceled', plan: 'free', ... })
  //     break
  //   }
  // }
  // return NextResponse.json({ received: true })

  // Mock response for pre-Stripe environments
  console.info('[TrustCore billing webhook] received (Stripe not yet configured)', { bodyLength: body.length, sig })
  return NextResponse.json({ received: true, note: 'Stripe not yet configured' })
}
