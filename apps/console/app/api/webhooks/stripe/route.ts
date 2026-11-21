import { persistAndNormalizeStripeEvent } from '@/lib/services/stripe-webhook-service'
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

import { createLogger } from '@nzila/os-core'
import {
  verifyWebhookSignature,
  WebhookSignatureError,
  extractEntityIdFromEvent,
} from '@nzila/payments-stripe'

const logger = createLogger('webhooks:stripe')

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
  const orgId = extractEntityIdFromEvent(event)
  if (!orgId) {
    // Cannot process without an entity — log and return 200 to avoid retries
    logger.warn(`[stripe-webhook] No org_id in event ${event.id} (${event.type})`)
    return NextResponse.json({ received: true, warning: 'no_entity_id' })
  }

  const result = await persistAndNormalizeStripeEvent(event, orgId)
  return NextResponse.json(result.body, { status: result.status })
}
