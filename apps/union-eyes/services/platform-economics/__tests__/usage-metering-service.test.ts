import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    for (const m of [
      'select',
      'from',
      'where',
      'limit',
      'orderBy',
      'insert',
      'update',
      'set',
      'values',
      'returning',
      'delete',
      'onConflictDoNothing',
      'onConflictDoUpdate',
    ]) {
      chain[m] = () => chain;
    }
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const v = queue.length ? queue.shift() : [];
      return (v instanceof Error ? Promise.reject(v) : Promise.resolve(v)).then(res, rej);
    };
    return chain;
  };
  const db = {
    select: () => makeChain(),
    insert: () => makeChain(),
    update: () => makeChain(),
    delete: () => makeChain(),
  };
  const appendLedgerEntry = vi.fn();
  const auditLog = vi.fn();
  return { queue, db, appendLedgerEntry, auditLog };
});

vi.mock('@/db', () => ({ db: h.db }));
vi.mock('@/db/schema', () =>
  new Proxy(
    {},
    {
      has: () => true,
      get: (_t, n) => (n === '__esModule' ? false : new Proxy({}, { get: (_o, c) => ({ __col: c }) })),
    },
  ),
);
vi.mock('drizzle-orm', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  sql: vi.fn(() => ({})),
  gte: vi.fn(() => ({})),
  lte: vi.fn(() => ({})),
}));
vi.mock('../ledger-service', () => ({ appendLedgerEntry: h.appendLedgerEntry }));
vi.mock('@/lib/audit-logger', () => ({
  auditLog: h.auditLog,
  AuditEventType: { DATA_UPDATE: 'data_update' },
  AuditSeverity: { MEDIUM: 'medium' },
}));
vi.mock('uuid', () => ({ v4: () => 'fixed-uuid' }));

import {
  aggregateUsageForPeriod,
  closeAggregatesForPeriod,
  createMeter,
  listActiveMeters,
  recordUsage,
} from '../usage-metering-service';

const pushSel = (...items: unknown[]) => h.queue.push(...items);

beforeEach(() => {
  h.queue.length = 0;
  h.appendLedgerEntry.mockReset();
  h.auditLog.mockReset();
});

describe('platform-economics/usage-metering-service', () => {
  it('createMeter returns the inserted meter', async () => {
    pushSel([{ id: 'meter-1', code: 'api_calls' }]);
    const meter = await createMeter({ code: 'api_calls' } as never);
    expect(meter).toEqual({ id: 'meter-1', code: 'api_calls' });
  });

  it('listActiveMeters returns active meters', async () => {
    pushSel([{ id: 'meter-1' }, { id: 'meter-2' }]);
    const meters = await listActiveMeters();
    expect(meters).toHaveLength(2);
  });

  describe('recordUsage', () => {
    it('throws for an unknown meter code', async () => {
      pushSel([]); // meter lookup empty
      await expect(recordUsage({ meterCode: 'nope', organizationId: 'o1', quantity: 1 })).rejects.toThrow(
        'Unknown meter code: nope',
      );
    });

    it('throws when the meter is inactive', async () => {
      pushSel([{ id: 'meter-1', isActive: false }]);
      await expect(recordUsage({ meterCode: 'api_calls', organizationId: 'o1', quantity: 1 })).rejects.toThrow(
        'is inactive',
      );
    });

    it('records a new usage event', async () => {
      pushSel([{ id: 'meter-1', isActive: true }]); // meter
      pushSel([{ id: 'event-1' }]); // insert returning
      const result = await recordUsage({ meterCode: 'api_calls', organizationId: 'o1', quantity: 2 });
      expect(result).toEqual({ deduplicated: false, eventId: 'event-1' });
    });

    it('reports deduplication when the insert conflicts', async () => {
      pushSel([{ id: 'meter-1', isActive: true }]); // meter
      pushSel([]); // insert returning -> conflict, no row
      const result = await recordUsage({
        meterCode: 'api_calls',
        organizationId: 'o1',
        quantity: 2,
        idempotencyKey: 'k1',
      });
      expect(result).toEqual({ deduplicated: true, eventId: null });
    });
  });

  describe('aggregateUsageForPeriod', () => {
    it('throws when the meter is missing', async () => {
      pushSel([{ total: '100' }]); // sum
      pushSel([]); // meter lookup empty
      await expect(
        aggregateUsageForPeriod('o1', 'meter-1', 'bp-1', new Date('2025-01-01'), new Date('2025-01-31')),
      ).rejects.toThrow('not found');
    });

    it('computes the billable amount and upserts the aggregate', async () => {
      pushSel([{ total: '120' }]); // sum
      pushSel([{ id: 'meter-1', includedQuantity: 20, pricePerUnit: '0.50' }]); // meter
      pushSel([{ id: 'agg-1', billableQuantity: '100', totalAmount: '50.00' }]); // upsert returning
      const agg = await aggregateUsageForPeriod(
        'o1',
        'meter-1',
        'bp-1',
        new Date('2025-01-01'),
        new Date('2025-01-31'),
      );
      expect(agg).toEqual({ id: 'agg-1', billableQuantity: '100', totalAmount: '50.00' });
    });
  });

  describe('closeAggregatesForPeriod', () => {
    it('closes open aggregates and posts to the ledger when amount > 0', async () => {
      pushSel([
        { id: 'agg-1', totalAmount: '50.00', billableQuantity: '100', unitPrice: '0.50', meterId: 'meter-1' },
      ]); // open aggs
      pushSel([{ id: 'agg-1', status: 'closed' }]); // update returning
      const closed = await closeAggregatesForPeriod({
        organizationId: 'o1',
        billingPeriodId: 'bp-1',
        postToLedger: true,
        createdBy: 'user-1',
      });
      expect(closed).toHaveLength(1);
      expect(h.appendLedgerEntry).toHaveBeenCalledTimes(1);
      expect(h.auditLog).toHaveBeenCalledTimes(1);
    });

    it('does not post to the ledger when amount is zero', async () => {
      pushSel([{ id: 'agg-1', totalAmount: '0.00', billableQuantity: '0', unitPrice: '0', meterId: 'meter-1' }]);
      pushSel([{ id: 'agg-1', status: 'closed' }]); // update returning
      const closed = await closeAggregatesForPeriod({
        organizationId: 'o1',
        billingPeriodId: 'bp-1',
        postToLedger: true,
      });
      expect(closed).toHaveLength(1);
      expect(h.appendLedgerEntry).not.toHaveBeenCalled();
    });

    it('skips ledger posting when postToLedger is false', async () => {
      pushSel([{ id: 'agg-1', totalAmount: '50.00', billableQuantity: '100', unitPrice: '0.50', meterId: 'meter-1' }]);
      pushSel([{ id: 'agg-1', status: 'closed' }]);
      await closeAggregatesForPeriod({ organizationId: 'o1', billingPeriodId: 'bp-1' });
      expect(h.appendLedgerEntry).not.toHaveBeenCalled();
    });
  });
});
