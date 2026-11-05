import { describe, expect, it } from 'vitest';
import { ApiShapeError } from '../api-envelope';
import { envelopeTotal } from '../list-total';

describe('envelopeTotal', () => {
  it('reads the route’s own total, which is not the length of the page', () => {
    const body = { success: true, data: { data: [{ id: 'a' }], pagination: { page: 1, limit: 20, total: 45, totalPages: 3 } }, timestamp: 'now' };
    expect(envelopeTotal(body)).toBe(45);
    expect(envelopeTotal({ success: true, data: { data: [], pagination: { total: 0 } } })).toBe(0);
  });

  it('refuses an answer that does not carry a whole, non-negative total instead of counting the rows in hand', () => {
    for (const pagination of [undefined, null, {}, { total: '45' }, { total: 4.5 }, { total: -1 }, { total: Number.NaN }, [45]]) {
      expect(() => envelopeTotal({ success: true, data: { data: [{ id: 'a' }], pagination } })).toThrow(ApiShapeError);
    }
    expect(() => envelopeTotal({ success: true })).toThrow(ApiShapeError);
    expect(() => envelopeTotal(null)).toThrow(ApiShapeError);
  });
});
