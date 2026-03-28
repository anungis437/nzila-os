import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ---------- hoisted mocks ---------- */
const mocks = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockFindMany: vi.fn(),
  mockInsert: vi.fn(),
  mockValues: vi.fn(),
  mockReturning: vi.fn(),
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  mockCreateHmac: vi.fn(),
  mockTimingSafeEqual: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  or: vi.fn((...args: unknown[]) => args),
  desc: vi.fn(),
  sql: vi.fn(),
  relations: vi.fn(() => ({})),
}));

vi.mock('@/db/schema', () => ({
  webhookReceipts: {
    provider: 'provider',
    webhookId: 'webhookId',
    eventType: 'eventType',
    payload: 'payload',
    processedAt: 'processedAt',
  },
}));

vi.mock('crypto', () => {
  const mockDigest = vi.fn().mockReturnValue('computed-hmac');
  const mockUpdate = vi.fn().mockReturnValue({ digest: mockDigest });
  mocks.mockCreateHmac.mockReturnValue({ update: mockUpdate });
  return {
    default: {
      createHmac: mocks.mockCreateHmac,
      timingSafeEqual: mocks.mockTimingSafeEqual,
    },
    createHmac: mocks.mockCreateHmac,
    timingSafeEqual: mocks.mockTimingSafeEqual,
  };
});

vi.mock('@/db', () => {
  mocks.mockReturning.mockResolvedValue([]);
  mocks.mockValues.mockReturnValue({ returning: mocks.mockReturning });
  mocks.mockInsert.mockReturnValue({ values: mocks.mockValues });

  return {
    db: {
      insert: mocks.mockInsert,
      query: {
        webhookReceipts: {
          findFirst: mocks.mockFindFirst,
          findMany: mocks.mockFindMany,
        },
      },
    },
  };
});



vi.mock('@/lib/logger', () => ({
  default: mocks.mockLogger,
  logger: mocks.mockLogger,
}));

import {
  verifyShopifySignature,
  isWebhookProcessed,
  recordWebhookProcessed,
  processWebhookIdempotent,
  extractRedemptionIdFromDiscount,
  parseShopifyHeaders,
  getWebhookSecret,
} from '../webhook-service';

describe('webhook-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  /* =================== verifyShopifySignature =================== */
  describe('verifyShopifySignature', () => {
    it('returns true when signatures match', () => {
      mocks.mockTimingSafeEqual.mockReturnValue(true);

      const result = verifyShopifySignature(
        '{"data":"test"}',
        'sha256=abc123',
        'secret-key'
      );

      expect(result).toBe(true);
      expect(mocks.mockCreateHmac).toHaveBeenCalledWith('sha256', 'secret-key');
    });

    it('returns false when signatures do not match', () => {
      mocks.mockTimingSafeEqual.mockReturnValue(false);

      const result = verifyShopifySignature(
        '{"data":"test"}',
        'sha256=wrong',
        'secret-key'
      );

      expect(result).toBe(false);
    });

    it('returns false on crypto error', () => {
      mocks.mockTimingSafeEqual.mockImplementation(() => {
        throw new Error('Buffer length mismatch');
      });

      const result = verifyShopifySignature('body', 'bad', 'key');

      expect(result).toBe(false);
    });
  });

  /* =================== extractRedemptionIdFromDiscount =================== */
  describe('extractRedemptionIdFromDiscount', () => {
    it('extracts UUID from UE-prefixed discount code', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const result = extractRedemptionIdFromDiscount([{ code: `UE${uuid}` }]);

      expect(result).toBe(uuid);
    });

    it('returns null for non-UE discount codes', () => {
      const result = extractRedemptionIdFromDiscount([{ code: 'SUMMER20OFF' }]);

      expect(result).toBeNull();
    });

    it('returns null for empty array', () => {
      const result = extractRedemptionIdFromDiscount([]);

      expect(result).toBeNull();
    });
  });

  /* =================== parseShopifyHeaders =================== */
  describe('parseShopifyHeaders', () => {
    it('extracts shopify-specific headers', () => {
      const headers = new Headers();
      headers.set('x-shopify-topic', 'orders/create');
      headers.set('x-shopify-hmac-sha256', 'hmac-val');
      headers.set('x-shopify-shop-domain', 'test.myshopify.com');
      headers.set('x-shopify-webhook-id', 'wh-123');

      const result = parseShopifyHeaders(headers);

      expect(result.topic).toBe('orders/create');
      expect(result.hmac).toBe('hmac-val');
      expect(result.shopDomain).toBe('test.myshopify.com');
      expect(result.webhookId).toBe('wh-123');
    });

    it('returns null for missing headers', () => {
      const headers = new Headers();

      const result = parseShopifyHeaders(headers);

      expect(result).toBeNull();
    });
  });

  /* =================== isWebhookProcessed =================== */
  describe('isWebhookProcessed', () => {
    it('returns true when receipt exists', async () => {
      mocks.mockFindFirst.mockResolvedValue({ id: 'wr-1' });

      const result = await isWebhookProcessed('shopify', 'wh-123');

      expect(result).toBe(true);
    });

    it('returns false when no receipt found', async () => {
      mocks.mockFindFirst.mockResolvedValue(undefined);

      const result = await isWebhookProcessed('shopify', 'wh-456');

      expect(result).toBe(false);
    });
  });

  /* =================== recordWebhookProcessed =================== */
  describe('recordWebhookProcessed', () => {
    it('inserts webhook receipt record', async () => {
      const receipt = { id: 'wr-1', provider: 'shopify', webhookId: 'wh-1' };
      mocks.mockReturning.mockResolvedValueOnce([receipt]);

      const result = await recordWebhookProcessed({
        provider: 'shopify',
        webhookId: 'wh-1',
        eventType: 'orders/create',
        payloadJson: { orderId: 123 },
      });

      expect(result).toEqual(receipt);
      expect(mocks.mockInsert).toHaveBeenCalled();
    });
  });

  /* =================== processWebhookIdempotent =================== */
  describe('processWebhookIdempotent', () => {
    it('runs handler when webhook has not been processed', async () => {
      mocks.mockFindFirst.mockResolvedValue(undefined);
      const receipt = { id: 'wr-1' };
      mocks.mockReturning.mockResolvedValueOnce([receipt]);

      const handler = vi.fn().mockResolvedValue({ success: true });

      const result = await processWebhookIdempotent(
        'shopify',
        'wh-new',
        'orders/create',
        {},
        handler
      );

      expect(handler).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('skips handler when webhook already processed', async () => {
      mocks.mockFindFirst.mockResolvedValue({ id: 'wr-existing' });

      const handler = vi.fn();

      await processWebhookIdempotent(
        'shopify',
        'wh-old',
        'orders/create',
        {},
        handler
      );

      expect(handler).not.toHaveBeenCalled();
    });
  });

  /* =================== getWebhookSecret =================== */
  describe('getWebhookSecret', () => {
    it('returns env var value for shopify', async () => {
      vi.stubEnv('SHOPIFY_WEBHOOK_SECRET', 'shp_secret_xyz');

      const result = await getWebhookSecret('shopify');

      expect(result).toBe('shp_secret_xyz');
    });

    it('throws when secret is not configured', async () => {
      vi.stubEnv('SHOPIFY_WEBHOOK_SECRET', '');

      await expect(getWebhookSecret('shopify')).rejects.toThrow();
    });
  });
});
