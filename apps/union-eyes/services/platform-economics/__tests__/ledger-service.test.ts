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
      'offset',
      'orderBy',
      'groupBy',
      'insert',
      'update',
      'set',
      'values',
      'returning',
      'delete',
    ]) {
      chain[m] = () => chain;
    }
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const v = queue.length ? queue.shift() : [];
      return (v instanceof Error ? Promise.reject(v) : Promise.resolve(v)).then(res, rej);
    };
    return chain;
  };
  const tx = { insert: () => makeChain() };
  const db = {
    select: () => makeChain(),
    insert: () => makeChain(),
    update: () => makeChain(),
    delete: () => makeChain(),
    transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };
  const auditLog = vi.fn();
  return { queue, db, auditLog };
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
  desc: vi.fn(() => ({})),
}));
vi.mock('@/lib/audit-logger', () => ({
  auditLog: h.auditLog,
  AuditEventType: { DATA_CREATE: 'data_create' },
  AuditSeverity: { HIGH: 'high' },
}));
vi.mock('uuid', () => ({ v4: () => '00000000-1111-2222-3333-444444444444' }));

import {
  appendLedgerEntries,
  appendLedgerEntry,
  getLedgerEntries,
  getLedgerSummary,
  getLocalLedgerBalance,
  reverseLedgerEntry,
} from '../ledger-service';

const pushSel = (...items: unknown[]) => h.queue.push(...items);

const baseInput = {
  organizationId: 'o1',
  costType: 'compute' as never,
  eventType: 'usage' as never,
  sourceType: 'meter' as never,
  unitPriceCad: '1.00',
  amountCad: '10.00',
};

beforeEach(() => {
  h.queue.length = 0;
  h.auditLog.mockReset();
});

describe('platform-economics/ledger-service', () => {
  describe('appendLedgerEntry', () => {
    it('inserts an entry and writes an audit log', async () => {
      pushSel([]); // insert
      const id = await appendLedgerEntry(baseInput);
      expect(id).toBe('00000000-1111-2222-3333-444444444444');
      expect(h.auditLog).toHaveBeenCalledTimes(1);
    });
  });

  describe('appendLedgerEntries', () => {
    it('inserts multiple entries inside a transaction', async () => {
      pushSel([]); // insert 1
      pushSel([]); // insert 2
      const ids = await appendLedgerEntries([baseInput, baseInput]);
      expect(ids).toHaveLength(2);
    });
  });

  describe('reverseLedgerEntry', () => {
    it('throws when the original entry is missing', async () => {
      pushSel([]); // select empty
      await expect(reverseLedgerEntry('e1', 'oops')).rejects.toThrow('not found');
    });

    it('creates a negated reversal entry', async () => {
      pushSel([
        {
          id: 'e1',
          organizationId: 'o1',
          amountCad: '10.00',
          unitPriceCad: '1.00',
          costType: 'compute',
          sourceType: 'meter',
          quantity: '1',
          parentOrganizationId: null,
          localId: null,
          employerId: null,
          regionId: null,
          bargainingUnitId: null,
          billingPeriodId: null,
          costCenterId: null,
        },
      ]); // select original
      pushSel([]); // insert (appendLedgerEntry)
      const id = await reverseLedgerEntry('e1', 'mistake', 'user-1');
      expect(id).toBe('00000000-1111-2222-3333-444444444444');
    });
  });

  describe('getLedgerEntries', () => {
    it('queries entries with optional filters', async () => {
      pushSel([{ id: 'e1' }]);
      const rows = await getLedgerEntries({
        organizationId: 'o1',
        billingPeriodId: 'bp1',
        costType: 'compute' as never,
      });
      expect(rows).toHaveLength(1);
    });

    it('queries with defaults when filters are omitted', async () => {
      pushSel([]);
      const rows = await getLedgerEntries({ organizationId: 'o1' });
      expect(rows).toEqual([]);
    });
  });

  describe('getLedgerSummary', () => {
    it('aggregates totals across cost types', async () => {
      pushSel([
        { costType: 'compute', total: '10.00', count: 2 },
        { costType: 'storage', total: '5.50', count: 1 },
      ]);
      const summary = await getLedgerSummary({ organizationId: 'o1', billingPeriodId: 'bp1' });
      expect(summary.totalAmountCad).toBe('15.50');
      expect(summary.entryCount).toBe(3);
      expect(summary.byCostType.compute).toBe('10.00');
    });

    it('handles no rows', async () => {
      pushSel([]);
      const summary = await getLedgerSummary({ organizationId: 'o1' });
      expect(summary.totalAmountCad).toBe('0.00');
      expect(summary.entryCount).toBe(0);
    });
  });

  describe('getLocalLedgerBalance', () => {
    it('returns the balance for a local', async () => {
      pushSel([{ total: '42.00', count: 7 }]);
      const result = await getLocalLedgerBalance({
        organizationId: 'o1',
        localId: 'l1',
        billingPeriodId: 'bp1',
      });
      expect(result.totalAmountCad).toBe('42.00');
      expect(result.entryCount).toBe(7);
    });
  });
});
