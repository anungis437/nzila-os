import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/* ---------- hoisted mocks ---------- */
const mocks = vi.hoisted(() => ({
  mockQueryShopifyConfig: { findFirst: vi.fn(), findMany: vi.fn() },
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  mockFetch: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: any[]) => args),
  and: vi.fn((...args: any[]) => args),
  or: vi.fn((...args: any[]) => args),
  desc: vi.fn(),
  asc: vi.fn(),
  sql: vi.fn(),
  gt: vi.fn(),
  lt: vi.fn(),
  gte: vi.fn(),
  lte: vi.fn(),
  inArray: vi.fn(),
  isNull: vi.fn(),
  between: vi.fn(),
  like: vi.fn(),
  ilike: vi.fn(),
  not: vi.fn(),
  ne: vi.fn((...a: any[]) => a),
  count: vi.fn(),
  sum: vi.fn(),
  avg: vi.fn(),
  min: vi.fn(),
  max: vi.fn(),
  relations: vi.fn(() => ({})),
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      shopifyConfig: mocks.mockQueryShopifyConfig,
    },
  },
}));

vi.mock('@/db/schema/recognition-rewards-schema', () => ({
  shopifyConfig: { orgId: 'orgId' },
}));

vi.mock('@/lib/logger', () => ({ logger: mocks.mockLogger }));

import {
  fetchCuratedCollections,
  createDiscountCode,
  createCheckoutSession,
} from '../shopify-service';

describe('shopify-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mocks.mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /* ============================= fetchCuratedCollections ============================= */
  describe('fetchCuratedCollections', () => {
    it('fetches collections using default when no org config', async () => {
      mocks.mockQueryShopifyConfig.findFirst.mockResolvedValue(null);
      mocks.mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: {
            collectionByHandle: {
              id: 'c-1',
              title: 'Rewards',
              description: 'Test',
              handle: 'rewards',
              products: {
                edges: [
                  {
                    node: {
                      id: 'p-1',
                      title: 'Gift Card',
                      description: 'A gift card',
                      handle: 'gift-card',
                      images: { edges: [] },
                      priceRange: {
                        minVariantPrice: { amount: '10.00', currencyCode: 'CAD' },
                        maxVariantPrice: { amount: '10.00', currencyCode: 'CAD' },
                      },
                      variants: { edges: [] },
                    },
                  },
                ],
              },
            },
          },
        }),
      });

      const result = await fetchCuratedCollections('org-1');

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Rewards');
    });

    it('uses allowed collections from org config', async () => {
      mocks.mockQueryShopifyConfig.findFirst.mockResolvedValue({
        orgId: 'org-1',
        allowedCollections: ['premium', 'basic'],
      });
      mocks.mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            data: {
              collectionByHandle: {
                id: 'c-1',
                title: 'Premium',
                description: '',
                handle: 'premium',
                products: { edges: [] },
              },
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            data: { collectionByHandle: null },
          }),
        });

      const result = await fetchCuratedCollections('org-1');

      expect(result).toHaveLength(1);
      expect(mocks.mockFetch).toHaveBeenCalledTimes(2);
    });

    it('returns empty when Storefront API fails', async () => {
      mocks.mockQueryShopifyConfig.findFirst.mockResolvedValue(null);
      mocks.mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
      });

      const result = await fetchCuratedCollections('org-1');
      expect(result).toHaveLength(0);
    });

    it('returns empty when collection not found', async () => {
      mocks.mockQueryShopifyConfig.findFirst.mockResolvedValue(null);
      mocks.mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ data: { collectionByHandle: null } }),
      });

      const result = await fetchCuratedCollections('org-1');

      expect(result).toHaveLength(0);
    });
  });

  /* ============================= createDiscountCode ============================= */
  describe('createDiscountCode', () => {
    it('creates a price rule and discount code', async () => {
      mocks.mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ price_rule: { id: 'pr-1' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ discount_code: { id: 'dc-1' } }),
        });

      const result = await createDiscountCode('abc-123-def', 50);

      expect(result.amount).toBe(50);
      expect(result.currency).toBe('CAD');
      expect(result.code).toContain('UE');
      expect(mocks.mockFetch).toHaveBeenCalledTimes(2);
    });

    it('throws when price rule creation fails', async () => {
      mocks.mockFetch.mockResolvedValue({
        ok: false,
        text: vi.fn().mockResolvedValue('Bad Request'),
      });

      await expect(createDiscountCode('x', 50)).rejects.toThrow('Failed to create discount code');
    });

    it('allows custom currency', async () => {
      mocks.mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ price_rule: { id: 'pr-1' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ discount_code: { id: 'dc-1' } }),
        });

      const result = await createDiscountCode('abc', 25, 'USD');

      expect(result.currency).toBe('USD');
    });
  });

  /* ============================= createCheckoutSession ============================= */
  describe('createCheckoutSession', () => {
    it('generates checkout URL with discount code', async () => {
      const result = await createCheckoutSession('UEABC123');

      expect(result.checkoutUrl).toContain('discount=UEABC123');
      expect(result.discountCode).toBe('UEABC123');
    });

    it('includes variant IDs in the URL when provided', async () => {
      const result = await createCheckoutSession('UEABC', [
        { id: 'gid://shopify/ProductVariant/12345', quantity: 1 },
      ]);

      expect(result.checkoutUrl).toContain('12345:1');
    });
  });
});
