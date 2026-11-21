import type { Stripe } from '@nzila/payments-stripe'
import { platformDb } from '@nzila/db/platform'
import { stripeSubscriptions, stripeWebhookEvents, stripeConnections } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'
import { createLogger } from '@nzila/os-core'
import { normalizeAndPersist, markEventFailed } from '@nzila/payments-stripe'
import { recordAuditEvent } from '@/lib/audit-db'
const logger = createLogger('stripe:webhook-service')
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
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
          customerId:
            typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id,
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
    stripeProductId: typeof product === 'string' ? product : (product?.id ?? null),
    planName:
      typeof product === 'object' && product !== null ? (product as Stripe.Product).name : null,
    planInterval: price?.recurring?.interval ?? null,
    amountCents: price?.unit_amount ? BigInt(price.unit_amount) : null,
    currency: (price?.currency?.toUpperCase() ?? 'CAD') as string,
    status: sub.status as
      | 'incomplete'
      | 'incomplete_expired'
      | 'trialing'
      | 'active'
      | 'past_due'
      | 'canceled'
      | 'unpaid'
      | 'paused',
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

export async function persistAndNormalizeStripeEvent(event: Stripe.Event, orgId: string) {
  // 4. Idempotent: check if stripeEventId already exists
  const [existing] = await platformDb
    .select({ id: stripeWebhookEvents.id })
    .from(stripeWebhookEvents)
    .where(eq(stripeWebhookEvents.stripeEventId, event.id))
    .limit(1)
  if (existing) {
    // Already processed — return 200 (idempotent)
    return {
      status: 200 as const,
      body: { received: true, duplicate: true },
    }
  }
  // 5. Persist event to stripeWebhookEvents
  const [inserted] = await platformDb
    .insert(stripeWebhookEvents)
    .values({
      orgId,
      stripeEventId: event.id,
      type: event.type,
      apiVersion: event.api_version,
      livemode: event.livemode,
      created: new Date(event.created * 1000),
      payloadJson: event as unknown as Record<string, unknown>,
      signatureValid: true,
      processingStatus: 'received',
    })
    .returning({ id: stripeWebhookEvents.id })
  const webhookEventId = inserted!.id
  // 6. Append audit_event: stripe.webhook_received
  await recordAuditEvent({
    orgId,
    actorClerkUserId: 'system',
    actorRole: 'system',
    action: 'stripe.webhook_received',
    targetType: 'stripe_webhook_event',
    targetId: webhookEventId,
    afterJson: {
      stripeEventId: event.id,
      type: event.type,
      livemode: event.livemode,
    },
  })
  // 7. Update lastEventAt on the stripe connection
  await platformDb
    .update(stripeConnections)
    .set({ lastEventAt: new Date() })
    .where(eq(stripeConnections.orgId, orgId))
  // 8. Normalize inline (v1)
  try {
    const result = await normalizeAndPersist(event, webhookEventId, orgId)
    // 9. Append audit_event: stripe.webhook_processed
    await recordAuditEvent({
      orgId,
      actorClerkUserId: 'system',
      actorRole: 'system',
      action: 'stripe.webhook_processed',
      targetType: 'stripe_webhook_event',
      targetId: webhookEventId,
      afterJson: {
        stripeEventId: event.id,
        type: event.type,
        result: result.kind,
      },
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown processing error'
    await markEventFailed(webhookEventId, errorMessage)
    logger.error(`[stripe-webhook] Processing failed for ${event.id}:`, { detail: errorMessage })
    // Still return 200 — event is persisted, can be retried
  }
  return {
    status: 200 as const,
    body: { received: true },
  }
}
