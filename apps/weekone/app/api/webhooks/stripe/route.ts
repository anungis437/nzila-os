import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import {
  classifyBillingWebhook,
  verifyWebhookSignature,
  WebhookSignatureError,
} from '@nzila/payments-stripe'
import { getDb } from '@/lib/db'

interface StripeSubscriptionLike {
  id: string
  status: string
  items: {
    data: Array<{
      current_period_end?: number
    }>
  }
}

function mapStatus(status: string): string {
  const mapped: Record<string, string> = {
    active: 'active',
    trialing: 'active',
    past_due: 'past_due',
    canceled: 'canceled',
    unpaid: 'past_due',
    incomplete: 'incomplete',
  }
  return mapped[status] ?? 'incomplete'
}

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ ok: false, error: 'Missing stripe signature' }, { status: 400 })
  }

  let event: { type: string; data: { object: unknown } }
  try {
    const rawBody = await request.text()
    event = verifyWebhookSignature(rawBody, signature).event
  } catch (error) {
    if (error instanceof WebhookSignatureError) {
      return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 400 })
    }
    return NextResponse.json({ ok: false, error: 'Webhook validation failed' }, { status: 500 })
  }

  const db = await getDb()
  if (!db) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const classification = classifyBillingWebhook(event.type)
  if (classification === 'ignored') {
    return NextResponse.json({ ok: true, received: true, ignored: true })
  }

  const object = event.data.object as unknown as Record<string, unknown>

  if (classification === 'checkout_completed') {
    const metadata = (object.metadata as Record<string, string> | undefined) ?? {}
    const plan = metadata.plan === 'growth' ? 'growth' : metadata.plan === 'team' ? 'team' : 'solo'
    const customerId = typeof object.customer === 'string' ? object.customer : null
    const subscriptionId = typeof object.subscription === 'string' ? object.subscription : null

    if (subscriptionId) {
      await db.execute(sql`
        INSERT INTO weekone_subscriptions (org_id, plan, status, stripe_customer_id, stripe_subscription_id, created_at)
        VALUES (${1}, ${plan}, ${'active'}, ${customerId}, ${subscriptionId}, NOW())
      `)
    }
  }

  if (classification === 'subscription_updated' || classification === 'subscription_canceled') {
    const subscription = event.data.object as StripeSubscriptionLike
    const firstItem = subscription.items.data[0]
    const periodEndIso = firstItem?.current_period_end
      ? new Date(firstItem.current_period_end * 1000).toISOString()
      : null

    await db.execute(sql`
      UPDATE weekone_subscriptions
      SET status = ${classification === 'subscription_canceled' ? 'canceled' : mapStatus(subscription.status)},
          current_period_end = ${periodEndIso}::timestamptz
      WHERE stripe_subscription_id = ${subscription.id}
    `)
  }

  return NextResponse.json({ ok: true, received: true })
}
