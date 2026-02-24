import { NextRequest, NextResponse } from 'next/server';
import {
  verifyShopifySignature,
  parseShopifyHeaders,
  processWebhookIdempotent,
  extractRedemptionIdFromDiscount,
} from '@/lib/services/rewards/webhook-service';
import {
  markRedemptionOrdered,
  markRedemptionFulfilled,
  processRedemptionRefund,
  getRedemptionByOrderId,
  getRedemptionByIdInternal,
} from '@/lib/services/rewards/redemption-service';
import { checkRateLimit, RATE_LIMITS, createRateLimitHeaders } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';

import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
/**
 * Shopify Webhook Handler
 * 
 * Handles all Shopify webhooks for the Recognition & Rewards system.
 * 
 * Supported Topics:
 * - orders/paid: Mark redemption as ordered when payment confirmed
 * - orders/fulfilled: Mark redemption as fulfilled when order ships
 * - refunds/create: Process credit refund when order refunded
 * 
 * Security:
 * - HMAC signature verification (timing-safe)
 * - Idempotency via X-Shopify-Webhook-Id header
 * 
 * @see docs/recognition/api-contracts.md
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting (using IP address as key for webhooks)
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rateLimitResult = await checkRateLimit(
      `webhook-shopify:${ip}`,
      RATE_LIMITS.WEBHOOK_CALLS
    );

    if (!rateLimitResult.allowed) {
      logger.warn("Shopify webhook rate limit exceeded", { ip });
      return NextResponse.json(
        { error: "Rate limit exceeded", resetIn: rateLimitResult.resetIn },
        {
          status: 429,
          headers: createRateLimitHeaders(rateLimitResult),
        }
      );
    }

    // 1. Extract raw body for signature verification
    const rawBody = await request.text();
    
    // 2. Parse Shopify headers
    const headers = parseShopifyHeaders(request.headers);
    const { topic, webhookId, hmac } = headers || {};

    if (!topic || !webhookId || !hmac) {
      return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Missing required Shopify headers'
    );
    }

    // 3. Verify HMAC signature
    const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    const isValid = verifyShopifySignature(
      rawBody,
      hmac,
      webhookSecret
    );

    if (!isValid) {
      logger.warn('Invalid Shopify webhook signature', { topic, webhookId });
      return standardErrorResponse(
      ErrorCode.VALIDATION_ERROR,
      'Invalid signature'
    );
    }

    // 4. Parse webhook payload
    const payload = JSON.parse(rawBody) as Record<string, unknown>;

    // 5. Route by topic with idempotency
    const result = await processWebhookIdempotent(
      'shopify',
      webhookId,
      topic,
      payload,
      async () => {
        switch (topic) {
          case 'orders/paid':
            return await handleOrderPaid(payload);
          
          case 'orders/fulfilled':
            return await handleOrderFulfilled(payload);
          
          case 'refunds/create':
            return await handleRefundCreated(payload);
          
          default:
            logger.warn('[Webhook] Unhandled topic', { topic, webhookId });
            return { status: 'ignored', reason: 'unsupported_topic' };
        }
      }
    );

    // 6. Return success
    return standardSuccessResponse(
      { status: 'ok', result }
    );

  } catch (error) {
    logger.error('[Webhook] Processing error', { error });
    return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Internal server error',
      error
    );
  }
}

/**
 * Handle orders/paid webhook
 * 
 * When a Shopify order is paid, mark the redemption as "ordered".
 * This confirms that the member completed checkout successfully.
 */
async function handleOrderPaid(payload: Record<string, unknown>) {
  const orderId = String(payload.id);
  const orderNumber = payload.order_number;
  const discountCodes = (payload.discount_codes || []) as Array<{ code: string; amount?: string }>;

  logger.info('[Webhook] orders/paid', { orderId, orderNumber, discountCodes });

  // Extract redemption ID from discount code
  const redemptionId = extractRedemptionIdFromDiscount(discountCodes);
  
  if (!redemptionId) {
    logger.warn('[Webhook] No Union Eyes discount code found', { orderId });
    return { status: 'ignored', reason: 'no_redemption_discount' };
  }

  const redemption = await getRedemptionByIdInternal(redemptionId);
  if (!redemption) {
    logger.warn('[Webhook] Redemption not found for discount code', { redemptionId });
    return { status: 'ignored', reason: 'redemption_not_found' };
  }

  await markRedemptionOrdered(
    redemptionId,
    redemption.orgId,
    orderId,
    {
      order_number: orderNumber,
      total_price: payload.total_price,
      currency: payload.currency,
      line_items: (payload.line_items as Array<Record<string, unknown>> | undefined)?.map((item) => ({
        product_id: item.product_id,
        variant_id: item.variant_id,
        title: item.title,
        quantity: item.quantity,
        price: item.price,
      })),
      customer: {
        id: (payload.customer as Record<string, unknown> | undefined)?.id,
        email: (payload.customer as Record<string, unknown> | undefined)?.email,
        first_name: (payload.customer as Record<string, unknown> | undefined)?.first_name,
        last_name: (payload.customer as Record<string, unknown> | undefined)?.last_name,
      },
      paid_at: payload.created_at,
    }
  );

  return { 
    status: 'processed', 
    redemption_id: redemptionId,
    order_id: orderId 
  };
}

/**
 * Handle orders/fulfilled webhook
 * 
 * When a Shopify order is fulfilled (shipped), mark the redemption as "fulfilled".
 * This completes the redemption lifecycle.
 */
async function handleOrderFulfilled(payload: Record<string, unknown>) {
  const orderId = String(payload.id);
  const orderNumber = payload.order_number;
  const fulfillments = (payload.fulfillments || []) as Array<Record<string, unknown>>;

  logger.info('[Webhook] orders/fulfilled', { orderId, orderNumber, fulfillments: fulfillments.length });

  // Find redemption by order ID
  const redemption = await getRedemptionByOrderId(orderId);
  
  if (!redemption) {
    logger.warn('[Webhook] Redemption not found for order', { orderId });
    return { status: 'ignored', reason: 'redemption_not_found' };
  }

  // Extract fulfillment details
  const latestFulfillment = fulfillments[fulfillments.length - 1];
  const fulfillmentDetails = latestFulfillment ? {
    fulfillment_id: String(latestFulfillment.id),
    tracking_company: latestFulfillment.tracking_company,
    tracking_number: latestFulfillment.tracking_number,
    tracking_url: latestFulfillment.tracking_url,
    status: latestFulfillment.status,
    fulfilled_at: latestFulfillment.created_at,
  } : undefined;

  // Mark redemption as fulfilled
  await markRedemptionFulfilled(
    redemption.id,
    redemption.orgId,
    fulfillmentDetails || {}
  );

  return { 
    status: 'processed', 
    redemption_id: redemption.id,
    order_id: orderId 
  };
}

/**
 * Handle refunds/create webhook
 * 
 * When a Shopify order is refunded, return credits to the member's wallet.
 * This ensures members aren&apos;t charged for cancelled/returned orders.
 */
async function handleRefundCreated(payload: Record<string, unknown>) {
  const refundId = String(payload.id);
  const orderId = String(payload.order_id);
  const refundLineItems = (payload.refund_line_items || []) as Array<Record<string, unknown>>;

  logger.info('[Webhook] refunds/create', { refundId, orderId, lineItems: refundLineItems.length });

  // Find redemption by order ID
  const redemption = await getRedemptionByOrderId(orderId);
  
  if (!redemption) {
    logger.warn('[Webhook] Redemption not found for refund', { orderId, refundId });
    return { status: 'ignored', reason: 'redemption_not_found' };
  }

  // Calculate total refund amount (in cents/minor units)
  const totalRefund = refundLineItems.reduce((sum: number, item: Record<string, unknown>) => {
    return sum + parseFloat(String(item.subtotal || 0));
  }, 0);

  // Process refund (returns credits to wallet)
  await processRedemptionRefund(
    redemption.id,
    redemption.orgId,
    {
      refund_id: refundId,
      refund_amount: totalRefund,
      currency: payload.currency || 'CAD',
      refund_line_items: refundLineItems.map((item: Record<string, unknown>) => ({
        line_item_id: item.line_item_id,
        quantity: item.quantity,
        subtotal: item.subtotal,
        total_tax: item.total_tax,
      })),
      refunded_at: payload.created_at,
      note: payload.note,
    }
  );

  return { 
    status: 'processed', 
    redemption_id: redemption.id,
    refund_id: refundId,
    credits_refunded: redemption.creditsSpent 
  };
}

/**
 * GET handler - Health check endpoint
 * 
 * Returns 200 OK to verify webhook endpoint is reachable.
 * Shopify may check this during webhook setup.
 */
export async function GET(_request: NextRequest) {
  return standardSuccessResponse({
    status: 'ok',
    endpoint: 'shopify-webhooks',
    supported_topics: [
      'orders/paid',
      'orders/fulfilled',
      'refunds/create'
    ]
  });
}

