/**
 * @nzila/payments-stripe — Webhook signature verification + raw body parsing
 *
 * IMPORTANT: The webhook route must pass the RAW request body (Buffer)
 * for signature verification to work. Next.js body parsing must be
 * disabled for the webhook route.
 */
import type Stripe from 'stripe'
import { getStripeClient } from './client'
import { getStripeEnv } from './env'
import type { WebhookVerifyResult } from './types'

/**
 * Verify a Stripe webhook signature and parse the event.
 *
 * @param rawBody The raw request body as a Buffer or string
 * @param signature The `stripe-signature` header value
 * @returns Parsed event + validity flag, or throws on invalid signature
 */
export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signature: string,
): WebhookVerifyResult {
  const env = getStripeEnv()
  const stripe = getStripeClient()

  try {
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    )
    return { event, signatureValid: true }
  } catch (err) {
    // Re-throw to let the caller handle it (return 400)
    throw new WebhookSignatureError(
      err instanceof Error ? err.message : 'Invalid webhook signature',
    )
  }
}

export class WebhookSignatureError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WebhookSignatureError'
  }
}

/**
 * Extract entity ID from Stripe event metadata.
 * Falls back to a default entity ID if not present.
 */
export function extractEntityIdFromEvent(event: Stripe.Event): string | null {
  const obj = event.data.object as unknown as Record<string, unknown>
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null

  // Undefined means absent; null means a supplied scope is malformed. A valid
  // second source cannot repair a contradictory or malformed signed object.
  const scope = (metadata: unknown): string | null | undefined => {
    if (metadata === null || metadata === undefined) return undefined
    if (typeof metadata !== 'object' || Array.isArray(metadata)) return null
    if (!Object.hasOwn(metadata, 'org_id')) return undefined
    const id = (metadata as Record<string, unknown>).org_id
    return typeof id === 'string' && id.length > 0 && id.trim() === id ? id : null
  }
  const direct = scope(obj.metadata)
  const parent = obj.payment_intent
  if (Array.isArray(parent)) return null
  const nested = parent && typeof parent === 'object'
    ? scope((parent as Record<string, unknown>).metadata)
    : undefined
  if (direct === null || nested === null || (direct && nested && direct !== nested)) return null
  return direct ?? nested ?? null
}
