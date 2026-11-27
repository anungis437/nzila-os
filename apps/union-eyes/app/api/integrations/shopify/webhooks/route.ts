import {
  requireRewardsInstitutionalAuthority,
  RewardsInstitutionalAuthorityUnavailable,
} from '@/lib/rewards/credit-authority'
import { NextRequest, NextResponse } from 'next/server'
import {
  verifyShopifySignature,
  parseShopifyHeaders,
  resolveShopWebhookAuthority,
} from '@/lib/services/rewards/webhook-service'
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter'
import { logger } from '@/lib/logger'

import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses'

export const dynamic = 'force-dynamic'

/**
 * Shopify Webhook Handler
 *
 * Handles the Shopify webhooks of the Recognition & Rewards system.
 *
 * Supported Topics:
 * - orders/paid: Deferred credit fulfillment: authenticated then unavailable
 * - orders/fulfilled: Deferred credit fulfillment: authenticated then unavailable
 * - refunds/create: Deferred credit refund: authenticated then unavailable
 *
 * Security:
 * - HMAC signature verification (timing-safe)
 * - The shop domain must belong to exactly one organization; every lookup and write runs inside that organization's context
 * - Idempotency via X-Shopify-Webhook-Id header, recorded only for an outcome that is final
 *
 * Shopify retries only on a non-2xx answer, so a failure or an event that cannot be applied yet answers non-2xx. Only an
 * event that was applied, or that is final and does not concern us, answers 200.
 *
 * @see docs/recognition/api-contracts.md
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Raw body for signature verification
    const rawBody = await request.text()

    // 2. Shopify headers
    const headers = parseShopifyHeaders(request.headers)
    const { topic, webhookId, hmac, shopDomain } = headers || {}

    if (!topic || !webhookId || !hmac || !shopDomain) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Missing required Shopify headers')
    }

    // 3. Resolve the exact shop and its current/retiring tenant secret versions.
    // The shop header remains untrusted until one of those versions verifies.
    const authority = await resolveShopWebhookAuthority(shopDomain)
    if (!authority) {
      logger.error('[Webhook] Shopify shop or tenant secret is not configured', {
        shopDomain,
        topic,
        webhookId,
      })
      return NextResponse.json({ error: 'Shop is not configured' }, { status: 403 })
    }
    if (
      !authority.verificationSecrets.some((secret) => verifyShopifySignature(rawBody, hmac, secret))
    ) {
      logger.warn('Invalid Shopify webhook signature', { topic, webhookId })
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid signature')
    }

    // Only a verified tenant/shop identity receives a rate-limit bucket. No
    // attacker-controlled forwarding header can mint or exhaust that identity.
    const shopLimit = await checkRateLimit(
      `webhook-shopify-shop:${authority.shopDomain}`,
      RATE_LIMITS.WEBHOOK_CALLS,
    )
    if (!shopLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', resetIn: shopLimit.resetIn },
        { status: 429, headers: createRateLimitHeaders(shopLimit) },
      )
    }

    // 4. Payload
    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>
    } catch {
      logger.error('Shopify webhook payload is not valid JSON', { topic, webhookId })
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid payload format')
    }

    // Authentication does not authorize deferred financial fulfillment.
    if (['orders/paid', 'orders/fulfilled', 'refunds/create'].includes(topic))
      requireRewardsInstitutionalAuthority()
    // Unknown topics have no receipt or business effect.
    return standardSuccessResponse({ status: 'ignored', reason: 'unsupported_topic' })
  } catch (error) {
    if (error instanceof RewardsInstitutionalAuthorityUnavailable)
      return standardErrorResponse(ErrorCode.NOT_IMPLEMENTED, error.message)
    // A failed event is a failed delivery: a non-2xx lets Shopify redeliver it, and the handlers are idempotent.
    logger.error('[Webhook] Processing error', { error })
    return NextResponse.json({ error: 'Internal processing error' }, { status: 500 })
  }
}
