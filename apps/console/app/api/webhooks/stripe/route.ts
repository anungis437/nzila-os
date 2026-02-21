// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * Stripe webhook endpoint — /api/webhooks/stripe
 *
 * Receives raw Stripe events, verifies signature, persists to
 * stripeWebhookEvents (idempotent), then normalizes inline (v1).
 *
 * This route MUST receive a raw body (not parsed JSON) for webhook
 * signature verification to work.
 */
import { NextRequest, NextResponse } from 'next/server'
import { platformDb } from '@nzila/db/platform'
import { stripeWebhookEvents, stripeConnections } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'
import {
  verifyWebhookSignature,
  WebhookSignatureError,
  extractEntityIdFromEvent,
  normalizeAndPersist,
  markEventFailed,
} from '@nzila/payments-stripe'
import { recordAuditEvent } from '@/lib/audit-db'

// Next.js 16: disable body parsing for this route (Stripe needs raw body)
export const dynamic = 'force-dynamic'

// ── POST handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Read raw body
  const rawBody = Buffer.from(await req.arrayBuffer())
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  // 2. Verify signature
  let event
  try {
    const result = verifyWebhookSignature(rawBody, signature)
    event = result.event
  } catch (err) {
    if (err instanceof WebhookSignatureError) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }
    throw err
  }

  // 3. Extract entity ID from event metadata
  const entityId = extractEntityIdFromEvent(event)
  if (!entityId) {
    // Cannot process without an entity — log and return 200 to avoid retries
    console.warn(`[stripe-webhook] No entity_id in event ${event.id} (${event.type})`)
    return NextResponse.json({ received: true, warning: 'no_entity_id' })
  }

  // 4. Idempotent: check if stripeEventId already exists
  const [existing] = await platformDb
    .select({ id: stripeWebhookEvents.id })
    .from(stripeWebhookEvents)
    .where(eq(stripeWebhookEvents.stripeEventId, event.id))
    .limit(1)

  if (existing) {
    // Already processed — return 200 (idempotent)
    return NextResponse.json({ received: true, duplicate: true })
  }

  // 5. Persist event to stripeWebhookEvents
  const [inserted] = await platformDb
    .insert(stripeWebhookEvents)
    .values({
      entityId,
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
    entityId,
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
    .where(eq(stripeConnections.entityId, entityId))

  // 8. Normalize inline (v1)
  try {
    const result = await normalizeAndPersist(event, webhookEventId, entityId)

    // 9. Append audit_event: stripe.webhook_processed
    await recordAuditEvent({
      entityId,
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

    console.error(`[stripe-webhook] Processing failed for ${event.id}:`, errorMessage)
    // Still return 200 — event is persisted, can be retried
  }

  return NextResponse.json({ received: true })
}
