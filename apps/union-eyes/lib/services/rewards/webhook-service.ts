/**
 * Webhook Service
 * Handles webhook signature verification and idempotency
 */

import crypto from 'crypto';
import { db } from '@/db';
import {
  webhookReceipts,
  type NewWebhookReceipt,
  type WebhookReceipt,
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';

/**
 * Verify Shopify webhook HMAC signature
 * 
 * @param body Raw request body (string or Buffer)
 * @param hmacHeader X-Shopify-Hmac-Sha256 header value
 * @param secret Webhook secret from config
 * @returns True if signature is valid
 */
export function verifyShopifySignature(
  body: string | Buffer,
  hmacHeader: string,
  secret: string
): boolean {
  try {
    const bodyString = Buffer.isBuffer(body) ? body.toString('utf8') : body;
    
    const hash = crypto
      .createHmac('sha256', secret)
      .update(bodyString, 'utf8')
      .digest('base64');

    // Timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(hash),
      Buffer.from(hmacHeader)
    );
  } catch (error) {
    logger.error('[WebhookService] Signature verification failed', { error });
    return false;
  }
}

/**
 * Check if webhook has already been processed (idempotency)
 * 
 * @param provider Webhook provider ('shopify')
 * @param webhookId Unique webhook ID from provider
 * @returns True if webhook was already processed
 */
export async function isWebhookProcessed(
  provider: 'shopify',
  webhookId: string
): Promise<boolean> {
  const existing = await db.query.webhookReceipts.findFirst({
    where: and(
      eq(webhookReceipts.provider, provider),
      eq(webhookReceipts.webhookId, webhookId)
    ),
  });

  return !!existing;
}

/**
 * Record webhook as processed
 * 
 * @param data Webhook receipt data
 * @returns Created webhook receipt
 */
export async function recordWebhookProcessed(
  data: NewWebhookReceipt
): Promise<WebhookReceipt> {
  const [receipt] = await db
    .insert(webhookReceipts)
    .values({
      ...data,
      processedAt: new Date(),
    })
    .returning();

  return receipt;
}

/**
 * Process webhook with idempotency check
 * Higher-order function that wraps webhook handler
 * 
 * @param provider Webhook provider
 * @param webhookId Unique webhook ID
 * @param eventType Event type (e.g., 'orders/paid')
 * @param payload Webhook payload
 * @param handler Async function to process webhook
 * @returns Result from handler or 'already_processed' string
 */
export async function processWebhookIdempotent<T>(
  provider: 'shopify',
  webhookId: string,
  eventType: string,
  payload: Record<string, unknown>,
  handler: () => Promise<T>
): Promise<T | 'already_processed'> {
  // Check if already processed
  const alreadyProcessed = await isWebhookProcessed(provider, webhookId);
  
  if (alreadyProcessed) {
    logger.info('[WebhookService] Webhook already processed, skipping', {
      provider,
      webhookId,
    });
    return 'already_processed';
  }

  try {
    // Execute handler
    const result = await handler();

    // Record as processed
    await recordWebhookProcessed({
      provider,
      webhookId,
      eventType,
      payloadJson: payload,
    });

    return result;
  } catch (error) {
    logger.error('[WebhookService] Error processing webhook', {
      error,
      provider,
      webhookId,
      eventType,
    });
    // Do not record as processed if handler fails
    throw error;
  }
}

/**
 * Extract redemption ID from Shopify discount code
 * Discount codes are formatted as "UE{redemption_id}"
 * 
 * @param discountCodes Array of discount code objects from Shopify order
 * @returns Redemption ID or null if not found
 */
export function extractRedemptionIdFromDiscount(
  discountCodes: Array<{ code: string; amount?: string }>
): string | null {
  const unionEyesCode = discountCodes.find((dc) =>
    dc.code.startsWith('UE')
  );

  if (!unionEyesCode) {
    return null;
  }

  // Extract UUID from "UE{uuid}"
  const redemptionId = unionEyesCode.code.substring(2);
  
  // Validate UUID format (basic check)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(redemptionId)) {
    logger.warn('[WebhookService] Invalid redemption ID format', { redemptionId });
    return null;
  }

  return redemptionId;
}

/**
 * Parse Shopify webhook headers
 * Extracts important metadata for processing
 * 
 * @param headers Request headers object
 * @returns Parsed webhook metadata
 */
export interface ShopifyWebhookHeaders {
  hmac: string;
  topic: string;
  shopDomain: string;
  webhookId: string;
}

export function parseShopifyHeaders(
  headers: Headers | Record<string, string | string[] | undefined>
): ShopifyWebhookHeaders | null {
  const getHeader = (name: string): string | null => {
    if (headers instanceof Headers) {
      return headers.get(name);
    }
    const value = headers[name] || headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] || null : value || null;
  };

  const hmac = getHeader('x-shopify-hmac-sha256');
  const topic = getHeader('x-shopify-topic');
  const shopDomain = getHeader('x-shopify-shop-domain');
  const webhookId = getHeader('x-shopify-webhook-id');

  if (!hmac || !topic || !shopDomain || !webhookId) {
    logger.error('[WebhookService] Missing required Shopify headers');
    return null;
  }

  return {
    hmac,
    topic,
    shopDomain,
    webhookId,
  };
}

/**
 * Get webhook secret for organization
 * In MVP, uses global env var. In production, fetch from shopify_config table
 * 
 * @param orgId Organization ID
 * @returns Webhook secret
 */
export async function getWebhookSecret(_orgId: string): Promise<string> {
  // MVP: Use global env var
  const globalSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
  
  if (globalSecret) {
    return globalSecret;
  }

  // Production: Fetch from shopify_config
  // const config = await db.query.shopifyConfig.findFirst({
  //   where: eq(shopifyConfig.orgId, orgId),
  // });
  // 
  // if (!config?.webhookSecretRef) {
  //   throw new Error('Shopify webhook secret not configured');
  // }
  // 
  // // Fetch secret from Key Vault using secretRef
  // return await fetchSecretFromKeyVault(config.webhookSecretRef);

  throw new Error('SHOPIFY_WEBHOOK_SECRET environment variable not set');
}

