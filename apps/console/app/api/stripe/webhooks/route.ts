import { handleStripeEvent } from '@/lib/services/stripe-webhook-service'
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
    logger.error(
      `[stripe/webhooks] Error handling event ${event.type}:`,
      err instanceof Error ? err : { detail: err },
    )
    // Return non-2xx to trigger Stripe retries for transient handler failures.
    return NextResponse.json({ received: false, error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
