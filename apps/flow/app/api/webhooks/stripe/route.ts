import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@nzila/db'
import { stripeSubscriptions, stripeWebhookEvents } from '@nzila/db/schema'
import { isUuid, mapFlowPlanFromPriceId, mapStripeSubscriptionStatus } from '@/lib/billing-webhook'

interface StripeEventLike {
  id: string
  type: string
  api_version?: string | null
  livemode: boolean
  created: number
  data: { object: unknown }
}

interface StripeSubscriptionLike {
  id: string
  status: string
  items?: {
    data?: Array<{
      current_period_end?: number
      current_period_start?: number
      plan?: { interval?: string | null; amount?: number | null }
      price?: { id?: string | null; product?: string | { toString(): string } }
    }>
  }
}

function classifyBillingWebhook(eventType: string):
  | 'checkout_completed'
  | 'payment_failed'
  | 'subscription_updated'
  | 'subscription_canceled'
  | 'ignored' {
  if (eventType === 'checkout.session.completed') return 'checkout_completed'
  if (eventType === 'invoice.payment_failed') return 'payment_failed'
  if (eventType === 'customer.subscription.updated') return 'subscription_updated'
  if (eventType === 'customer.subscription.deleted') return 'subscription_canceled'
  return 'ignored'
}

function resolveSubscriptionId(obj: unknown): string | null {
  const record = obj as Record<string, unknown>
  const raw = record.subscription
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object' && typeof (raw as { id?: string }).id === 'string') {
    return (raw as { id: string }).id
  }
  return null
}

export async function POST(request: Request) {
  try {
    const event = await request.json() as StripeEventLike
    const objectMetadata = (event.data.object as { metadata?: Record<string, string> }).metadata
    const orgId = objectMetadata?.org_id ?? null

    if (!isUuid(orgId)) {
      return NextResponse.json({ ok: true, ignored: true, reason: 'non_uuid_org' })
    }

    const persisted = await db.insert(stripeWebhookEvents).values({
      orgId,
      stripeEventId: event.id,
      type: event.type,
      apiVersion: event.api_version ?? null,
      livemode: event.livemode,
      created: new Date(event.created * 1000),
      payloadJson: event as unknown as Record<string, unknown>,
      signatureValid: true,
      processingStatus: 'received',
    }).onConflictDoNothing().returning({ id: stripeWebhookEvents.id })

    const eventType = classifyBillingWebhook(event.type)
    if (eventType === 'ignored') {
      return NextResponse.json({ ok: true, received: true, ignored: true })
    }

    if (eventType === 'checkout_completed' || eventType === 'subscription_updated' || eventType === 'subscription_canceled') {
      const subscription = eventType === 'checkout_completed'
        ? null
        : (event.data.object as StripeSubscriptionLike)

      const object = event.data.object as unknown as Record<string, unknown>
      const subscriptionId = eventType === 'checkout_completed'
        ? resolveSubscriptionId(object)
        : subscription?.id ?? null

      const customerRaw = object.customer
      const customerId = typeof customerRaw === 'string'
        ? customerRaw
        : (customerRaw as { id?: string } | null)?.id

      const planPriceId = subscription?.items?.data?.[0]?.price?.id ?? null
      const planName = mapFlowPlanFromPriceId(planPriceId)
      const currentPeriodEndUnix = subscription?.items?.data?.[0]?.current_period_end
      const status = eventType === 'subscription_canceled'
        ? 'canceled'
        : mapStripeSubscriptionStatus(subscription?.status ?? 'incomplete')

      if (subscriptionId && customerId) {
        const existing = await db.select({ id: stripeSubscriptions.id }).from(stripeSubscriptions).where(
          and(
            eq(stripeSubscriptions.orgId, orgId),
            eq(stripeSubscriptions.stripeSubscriptionId, subscriptionId),
          ),
        ).limit(1)

        if (existing.length > 0) {
          await db.update(stripeSubscriptions)
            .set({
              status: status as 'incomplete' | 'incomplete_expired' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused',
              planName,
              planInterval: subscription?.items?.data?.[0]?.plan?.interval ?? null,
              stripePriceId: planPriceId ?? '',
              currentPeriodEnd: currentPeriodEndUnix ? new Date(currentPeriodEndUnix * 1000) : null,
              canceledAt: eventType === 'subscription_canceled' ? new Date() : null,
              updatedAt: new Date(),
            })
            .where(eq(stripeSubscriptions.id, existing[0]!.id))
        } else {
          await db.insert(stripeSubscriptions).values({
            orgId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: subscriptionId,
            stripePriceId: planPriceId ?? 'unknown',
            stripeProductId: subscription?.items?.data?.[0]?.price?.product?.toString() ?? null,
            planName,
            planInterval: subscription?.items?.data?.[0]?.plan?.interval ?? null,
            amountCents: BigInt(subscription?.items?.data?.[0]?.plan?.amount ?? 0),
            status: status as 'incomplete' | 'incomplete_expired' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused',
            currentPeriodStart: subscription?.items?.data?.[0]?.current_period_start
              ? new Date(subscription.items.data[0].current_period_start * 1000)
              : null,
            currentPeriodEnd: currentPeriodEndUnix ? new Date(currentPeriodEndUnix * 1000) : null,
            createdBy: 'stripe-webhook',
          })
        }
      }
    }

    if (persisted[0]?.id) {
      await db.update(stripeWebhookEvents)
        .set({ processingStatus: 'processed', error: null })
        .where(eq(stripeWebhookEvents.id, persisted[0].id))
    }

    return NextResponse.json({ ok: true, received: true })
  } catch (_error) {
    return NextResponse.json({ ok: false, error: 'Webhook handling failed' }, { status: 500 })
  }
}
