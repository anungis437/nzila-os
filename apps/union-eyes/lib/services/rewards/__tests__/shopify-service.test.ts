import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/* ---------- hoisted mocks ---------- */
const mocks = vi.hoisted(() => ({
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  mockFetch: vi.fn(),
}));

// The service makes HTTP calls only: it must not load the database (its one table read, of shopify_config, had no caller and no privilege).
vi.mock('@/db', () => {
  throw new Error('the Shopify service must not use the database');
});

vi.mock('@/lib/logger', () => ({ logger: mocks.mockLogger }));

import {
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

  it('loads without the database', () => {
    expect(typeof createDiscountCode).toBe('function');
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

      const result = await createDiscountCode('0f8fad5b-d9cb-469f-a165-70867728950e', 50);

      expect(result.amount).toBe(50);
      expect(result.currency).toBe('CAD');
      // lossless: the webhook parses the redemption id straight back out of this code
      expect(result.code).toBe('UE0F8FAD5BD9CB469FA16570867728950E');
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

      const result = await createDiscountCode('0f8fad5b-d9cb-469f-a165-70867728950e', 25, 'USD');

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
