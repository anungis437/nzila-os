/**
 * Webhook Service
 * Handles webhook signature verification and idempotency
 */

import crypto from 'crypto';
import { withSystemContext } from '@/lib/db/with-rls-context';
import {
  shopifyConfig,
  webhookReceipts,
  type NewWebhookReceipt,
  type WebhookReceipt,
} from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { parseDiscountReference } from './shopify-redemption-rules';

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
  provider: 'shopify' | 'paypal',
  webhookId: string
): Promise<boolean> {
  // webhook_receipts has no organization_id column — it is genuinely global,
  // webhook-invoked (SYSTEM) infrastructure, so this must run on the system
  // connection rather than the plain tenant db import (round 46 fix).
  return withSystemContext(async (tx) => {
    const existing = await tx.query.webhookReceipts.findFirst({
      where: and(
        eq(webhookReceipts.provider, provider),
        eq(webhookReceipts.webhookId, webhookId)
      ),
    });

    return !!existing;
  });
}

/**
 * Record webhook as processed
 * 
 * @param data Webhook receipt data
 * @returns Created webhook receipt
 */
export async function recordWebhookProcessed(
  data: NewWebhookReceipt
): Promise<WebhookReceipt | null> {
  try {
    return await withSystemContext(async (tx) => {
      const [receipt] = await tx
        .insert(webhookReceipts)
        .values({
          ...data,
          processedAt: new Date(),
        })
        .returning();

      return receipt ?? null;
    });
  } catch (error) {
    // A concurrent delivery of the same webhook id may record first; the receipt is the same fact either way.
    const candidate = error as { code?: string; cause?: { code?: string } };
    if (candidate?.code === '23505' || candidate?.cause?.code === '23505' || /duplicate key|unique constraint/i.test(String((error as Error)?.message ?? error))) {
      return null;
    }
    throw error;
  }
}

/** What a webhook handler reports. A retryable miss is not an outcome: the provider must deliver the event again. */
export interface WebhookOutcome {
  status: 'processed' | 'ignored';
  reason?: string;
  /** True when the event cannot be applied yet but may be later (an order event that beat the one that creates the redemption). */
  retryable?: boolean;
  [key: string]: unknown;
}

/**
 * Process a webhook once.
 *
 * The receipt is recorded only after the handler has finished and only for an outcome that is final. A handler that throws records
 * nothing and the error propagates, so the provider sees a failure and redelivers; an event ignored because the record it refers to
 * does not exist yet (retryable) is not recorded either, so its redelivery is applied instead of being skipped as already processed.
 * Handlers are idempotent on their own state, so a delivery repeated before its receipt was written is applied once.
 *
 * Only a summary is kept as the receipt (see receiptSummary), never the purchaser's data.
 */
export async function processWebhookIdempotent<T extends WebhookOutcome>(
  provider: 'shopify',
  webhookId: string,
  eventType: string,
  summary: Record<string, unknown>,
  handler: () => Promise<T>
): Promise<T | 'already_processed'> {
  if (await isWebhookProcessed(provider, webhookId)) {
    logger.info('[WebhookService] Webhook already processed, skipping', { provider, webhookId });
    return 'already_processed';
  }

  let result: T;
  try {
    result = await handler();
  } catch (error) {
    logger.error('[WebhookService] Error processing webhook', { error, provider, webhookId, eventType });
    throw error;
  }

  if (result.retryable) return result;

  await recordWebhookProcessed({ provider, webhookId, eventType, payloadJson: summary });
  return result;
}

/**
 * The organization a Shopify shop belongs to. The shop domain header is bound to exactly one organization (a unique index on the
 * lower-cased domain); a domain no organization has configured, or one that somehow maps to several, resolves to nothing.
 */
export async function resolveShopOrganization(shopDomain: string): Promise<string | null> {
  const domain = shopDomain.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9.-]{0,251}$/.test(domain)) return null;
  const rows = await withSystemContext(async (tx) =>
    tx
      .select({ orgId: shopifyConfig.orgId })
      .from(shopifyConfig)
      .where(sql`lower(${shopifyConfig.shopDomain}) = ${domain}`)
      .limit(2)
  );
  return rows.length === 1 ? rows[0].orgId : null;
}

/**
 * Extract redemption ID from Shopify discount code
 * Discount codes are formatted as "UE" plus the redemption id without dashes (see shopify-redemption-rules)
 * 
 * @param discountCodes Array of discount code objects from Shopify order
 * @returns Redemption ID or null if not found
 */
export function extractRedemptionIdFromDiscount(
  discountCodes: Array<{ code: string; amount?: string }>
): string | null {
  const reference = parseDiscountReference(discountCodes);
  // A legacy 12-character reference names no single id; it is resolved inside one organization by the redemption service.
  return reference?.kind === 'id' ? reference.id : null;
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

