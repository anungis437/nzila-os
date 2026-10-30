import { describe, expect, it } from 'vitest';
import {
  clientAddress, creditsToReturn, discountCodeFor, minimalOrderFacts, parseDiscountReference, receiptSummary,
} from '../shopify-redemption-rules';

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

describe('discount code round trip', () => {
  it('parses exactly the code that is issued', () => {
    const code = discountCodeFor(ID);
    expect(code).toBe('UE0F8FAD5BD9CB469FA16570867728950E');
    expect(parseDiscountReference([{ code }])).toEqual({ kind: 'id', id: ID });
  });

  it('still accepts the dashed form and resolves a legacy 12-character code only as a prefix', () => {
    expect(parseDiscountReference([{ code: `UE${ID}` }])).toEqual({ kind: 'id', id: ID });
    expect(parseDiscountReference([{ code: 'UE0F8FAD5BD9CB' }])).toEqual({ kind: 'legacy-prefix', prefix: '0f8fad5bd9cb' });
  });

  it('ignores codes that are not ours or are malformed, and finds ours among others', () => {
    expect(parseDiscountReference([{ code: 'SUMMER20' }, { code: 'UE' }, { code: 'UEZZZZ' }, { code: 'UE0F8FAD5BD9CB4' }])).toBeNull();
    expect(parseDiscountReference([{ code: 'SUMMER20' }, { code: discountCodeFor(ID) }])).toEqual({ kind: 'id', id: ID });
    expect(parseDiscountReference([])).toBeNull();
    expect(parseDiscountReference([{ code: 42 as unknown as string }])).toBeNull();
  });

  it('refuses to issue a code for something that is not a UUID', () => {
    expect(() => discountCodeFor('not-a-uuid')).toThrow();
  });
});

describe('creditsToReturn', () => {
  const base = { creditsSpent: 1000, creditsAlreadyReturned: 0, orderCents: 5000 };

  it('returns the share a partial refund covers, rounded down', () => {
    expect(creditsToReturn({ ...base, refundCents: 1250 })).toBe(250);
    expect(creditsToReturn({ ...base, refundCents: 1 })).toBe(0);
    expect(creditsToReturn({ creditsSpent: 7, creditsAlreadyReturned: 0, orderCents: 3, refundCents: 1 })).toBe(2);
  });

  it('returns exactly what is left on the last refund, and never more than was spent over all refunds', () => {
    expect(creditsToReturn({ ...base, creditsAlreadyReturned: 250, refundCents: 5000 })).toBe(750);
    expect(creditsToReturn({ ...base, creditsAlreadyReturned: 1000, refundCents: 5000 })).toBe(0);
    expect(creditsToReturn({ ...base, creditsAlreadyReturned: 900, refundCents: 4000 })).toBe(100);
  });

  it('returns nothing for a refund of nothing, and the remainder when the order value is unknown', () => {
    expect(creditsToReturn({ ...base, refundCents: 0 })).toBe(0);
    expect(creditsToReturn({ ...base, orderCents: 0, refundCents: 100 })).toBe(1000);
  });
});

describe('what is stored', () => {
  const payload = {
    id: 99, order_number: 1001, currency: 'CAD', total_price: '0.00', total_line_items_price: '50.00', created_at: '2026-01-01',
    customer: { id: 7, email: 'person@example.com', first_name: 'Pat', last_name: 'Member' },
    email: 'person@example.com',
    line_items: [{ product_id: 1, variant_id: 2, title: 'Jacket for Pat', quantity: 2, price: '25.00' }],
    discount_codes: [{ code: 'UE0F8FAD5BD9CB469FA16570867728950E' }],
  };

  it('keeps the order facts and none of the purchaser', () => {
    const facts = minimalOrderFacts(payload);
    expect(facts).toMatchObject({ order_number: '1001', currency: 'CAD', line_items_total_cents: 5000 });
    expect(JSON.stringify(facts)).not.toMatch(/person@example|Pat|Member|customer|Jacket/);
  });

  it('sizes the order from the line items when the total is not declared', () => {
    expect(minimalOrderFacts({ ...payload, total_line_items_price: undefined }).line_items_total_cents).toBe(5000);
  });

  it('keeps only which event it was as the receipt', () => {
    expect(receiptSummary('orders/paid', 'shop.myshopify.com', payload)).toEqual({
      topic: 'orders/paid', shop_domain: 'shop.myshopify.com', order_id: '99', refund_id: undefined,
    });
    expect(receiptSummary('refunds/create', 's', { id: 5, order_id: 99, note: 'secret' })).toMatchObject({ order_id: '99', refund_id: '5' });
    expect(JSON.stringify(receiptSummary('orders/paid', 's', payload))).not.toMatch(/person@|customer|UE0F8/);
  });
});

describe('clientAddress', () => {
  it('uses one normalised address however the header is lengthened or padded', () => {
    expect(clientAddress('203.0.113.7', null)).toBe('203.0.113.7');
    expect(clientAddress(' 203.0.113.7 , 10.0.0.1, 10.0.0.2', null)).toBe('203.0.113.7');
    expect(clientAddress(null, '2001:DB8::1')).toBe('2001:db8::1');
  });
  it('collapses anything that is not an address into one shared bucket', () => {
    expect(clientAddress('<script>', null)).toBe('unknown');
    expect(clientAddress(null, null)).toBe('unknown');
    expect(clientAddress('x'.repeat(300), null)).toBe('unknown');
  });
});
