import { NextRequest, NextResponse } from 'next/server';
import {
  verifyShopifySignature,
  parseShopifyHeaders,
  processWebhookIdempotent,
  resolveShopOrganization,
  type WebhookOutcome,
} from '@/lib/services/rewards/webhook-service';
import {
  markRedemptionOrdered,
  markRedemptionFulfilled,
  processRedemptionRefund,
  getRedemptionByOrderId,
  getRedemptionByIdInternal,
  getAwaitingRedemptionByIdPrefix,
} from '@/lib/services/rewards/redemption-service';
import {
  clientAddress,
  minimalOrderFacts,
  parseDiscountReference,
  receiptSummary,
} from '@/lib/services/rewards/shopify-redemption-rules';
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { logger } from '@/lib/logger';
import { toCents } from '@/lib/decimal-safe';

import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';

export const dynamic = 'force-dynamic';

const WEBHOOK_ACTOR = 'system:shopify-webhook';

/**
 * Shopify Webhook Handler
 *
 * Handles the Shopify webhooks of the Recognition & Rewards system.
 *
 * Supported Topics:
 * - orders/paid: Mark redemption as ordered when payment confirmed
 * - orders/fulfilled: Mark redemption as fulfilled when order ships
 * - refunds/create: Return the refunded share of the credits
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
    // The limit is keyed on one normalised address, not the whole forwarded-for string, so lengthening the header mints no new allowance.
    const address = clientAddress(request.headers.get('x-forwarded-for'), request.headers.get('x-real-ip'));
    const rateLimitResult = await checkRateLimit(`webhook-shopify:${address}`, RATE_LIMITS.WEBHOOK_CALLS);

    if (!rateLimitResult.allowed) {
      logger.warn('Shopify webhook rate limit exceeded', { address });
      return NextResponse.json(
        { error: 'Rate limit exceeded', resetIn: rateLimitResult.resetIn },
        { status: 429, headers: createRateLimitHeaders(rateLimitResult) }
      );
    }

    // 1. Raw body for signature verification
    const rawBody = await request.text();

    // 2. Shopify headers
    const headers = parseShopifyHeaders(request.headers);
    const { topic, webhookId, hmac, shopDomain } = headers || {};

    if (!topic || !webhookId || !hmac || !shopDomain) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Missing required Shopify headers');
    }

    // 3. HMAC signature
    const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    if (!verifyShopifySignature(rawBody, hmac, webhookSecret)) {
      logger.warn('Invalid Shopify webhook signature', { topic, webhookId });
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid signature');
    }

    // 4. Payload
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      logger.error('Shopify webhook payload is not valid JSON', { topic, webhookId });
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid payload format');
    }

    // 5. The shop must belong to one organization. A signed event from a shop nobody has configured is refused rather than
    // acknowledged, so a misconfigured integration is visible instead of silently losing paid orders.
    const organizationId = await resolveShopOrganization(shopDomain);
    if (!organizationId) {
      logger.error('[Webhook] Shopify shop is not configured for exactly one organization', { shopDomain, topic, webhookId });
      return NextResponse.json({ error: 'Shop is not configured' }, { status: 403 });
    }

    // The signed shop is allowed its own allowance, independent of the address it arrives from.
    const shopLimit = await checkRateLimit(`webhook-shopify-shop:${shopDomain.toLowerCase()}`, RATE_LIMITS.WEBHOOK_CALLS);
    if (!shopLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', resetIn: shopLimit.resetIn },
        { status: 429, headers: createRateLimitHeaders(shopLimit) }
      );
    }

    // 6. Route by topic with idempotency, inside the organization's context (reward_redemptions is fail-closed without one).
    const result = await withRLSContext({ organizationId, userId: WEBHOOK_ACTOR }, async () =>
      processWebhookIdempotent(
        'shopify',
        webhookId,
        topic,
        receiptSummary(topic, shopDomain, payload),
        async (): Promise<WebhookOutcome> => {
          switch (topic) {
            case 'orders/paid':
              return handleOrderPaid(payload, organizationId);
            case 'orders/fulfilled':
              return handleOrderFulfilled(payload, organizationId);
            case 'refunds/create':
              return handleRefundCreated(payload, organizationId);
            default:
              logger.warn('[Webhook] Unhandled topic', { topic, webhookId });
              return { status: 'ignored', reason: 'unsupported_topic' };
          }
        }
      )
    );

    // An event that cannot be applied yet is not acknowledged: Shopify redelivers it, and by then the order that creates the
    // redemption has usually been processed.
    if (result !== 'already_processed' && result.retryable) {
      logger.warn('[Webhook] Event cannot be applied yet; asking Shopify to redeliver', { topic, webhookId, reason: result.reason });
      return NextResponse.json({ status: 'retry', reason: result.reason }, { status: 503, headers: { 'Retry-After': '60' } });
    }

    return standardSuccessResponse({ status: 'ok', result });
  } catch (error) {
    // A failed event is a failed delivery: a non-2xx lets Shopify redeliver it, and the handlers are idempotent.
    logger.error('[Webhook] Processing error', { error });
    return NextResponse.json({ error: 'Internal processing error' }, { status: 500 });
  }
}

/**
 * Handle orders/paid: mark the redemption ordered. The discount code names the redemption; a code issued before the format was
 * fixed names only its first 12 characters and is resolved inside the shop's organization.
 */
async function handleOrderPaid(payload: Record<string, unknown>, organizationId: string): Promise<WebhookOutcome> {
  const orderId = String(payload.id);
  const discountCodes = (Array.isArray(payload.discount_codes) ? payload.discount_codes : []) as Array<{ code?: unknown }>;

  logger.info('[Webhook] orders/paid', { orderId, orderNumber: payload.order_number });

  const reference = parseDiscountReference(discountCodes);
  if (!reference) {
    logger.warn('[Webhook] No UnionEyes discount code on the order', { orderId });
    return { status: 'ignored', reason: 'no_redemption_discount' };
  }

  const redemption = reference.kind === 'id'
    ? await getRedemptionByIdInternal(reference.id)
    : await getAwaitingRedemptionByIdPrefix(reference.prefix, organizationId);
  // The organization context already hides other tenants' rows; the explicit check keeps the rule visible and tested.
  if (!redemption || redemption.orgId !== organizationId) {
    logger.warn('[Webhook] Redemption not found for the order', { orderId });
    return { status: 'ignored', reason: 'redemption_not_found' };
  }

  // A redelivery of an order already applied is a success, not an error.
  if (redemption.providerOrderId === orderId && (redemption.status === 'ordered' || redemption.status === 'fulfilled' || redemption.status === 'refunded')) {
    return { status: 'processed', redemption_id: redemption.id, order_id: orderId, already_applied: true };
  }

  await markRedemptionOrdered(redemption.id, redemption.orgId, orderId, minimalOrderFacts(payload), WEBHOOK_ACTOR);

  return { status: 'processed', redemption_id: redemption.id, order_id: orderId };
}

/** Handle orders/fulfilled: mark the redemption fulfilled. An order we have not recorded as paid yet is retried, not dropped. */
async function handleOrderFulfilled(payload: Record<string, unknown>, organizationId: string): Promise<WebhookOutcome> {
  const orderId = String(payload.id);
  const fulfillments = (Array.isArray(payload.fulfillments) ? payload.fulfillments : []) as Array<Record<string, unknown>>;

  logger.info('[Webhook] orders/fulfilled', { orderId, fulfillments: fulfillments.length });

  const redemption = await getRedemptionByOrderId(orderId, organizationId);
  if (!redemption) {
    // The paid event may simply not have been applied yet; it is the one that records the order id.
    return { status: 'ignored', reason: 'redemption_not_found', retryable: true };
  }
  if (redemption.status === 'fulfilled' || redemption.status === 'refunded') {
    return { status: 'processed', redemption_id: redemption.id, order_id: orderId, already_applied: true };
  }

  const latest = fulfillments[fulfillments.length - 1];
  await markRedemptionFulfilled(
    redemption.id,
    redemption.orgId,
    latest ? {
      fulfillment_id: String(latest.id),
      tracking_company: latest.tracking_company,
      tracking_number: latest.tracking_number,
      tracking_url: latest.tracking_url,
      status: latest.status,
      fulfilled_at: latest.created_at,
    } : {},
    WEBHOOK_ACTOR
  );

  return { status: 'processed', redemption_id: redemption.id, order_id: orderId };
}

/** Handle refunds/create: return the share of the credits this refund covers, once per refund. */
async function handleRefundCreated(payload: Record<string, unknown>, organizationId: string): Promise<WebhookOutcome> {
  const refundId = String(payload.id);
  const orderId = String(payload.order_id);
  const refundLineItems = (Array.isArray(payload.refund_line_items) ? payload.refund_line_items : []) as Array<Record<string, unknown>>;

  logger.info('[Webhook] refunds/create', { refundId, orderId, lineItems: refundLineItems.length });

  const redemption = await getRedemptionByOrderId(orderId, organizationId);
  if (!redemption) {
    return { status: 'ignored', reason: 'redemption_not_found', retryable: true };
  }

  const refundCents = refundLineItems.reduce((sum: number, item: Record<string, unknown>) => sum + toCents(String(item.subtotal || 0)), 0);

  const outcome = await processRedemptionRefund(
    redemption.id,
    redemption.orgId,
    { refund_id: refundId, refund_cents: refundCents, currency: payload.currency || 'CAD' },
    WEBHOOK_ACTOR
  );

  return {
    status: 'processed',
    redemption_id: redemption.id,
    refund_id: refundId,
    credits_returned: outcome.creditsReturned,
  };
}
