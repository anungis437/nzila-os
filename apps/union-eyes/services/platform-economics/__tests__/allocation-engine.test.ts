import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'from', 'where', 'limit', 'orderBy', 'insert', 'update', 'set', 'values', 'returning', 'delete', 'execute']) {
      chain[m] = () => chain;
    }
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const v = queue.length ? queue.shift() : [];
      return (v instanceof Error ? Promise.reject(v) : Promise.resolve(v)).then(res, rej);
    };
    return chain;
  };
  const tx = {
    insert: () => makeChain(),
    execute: () => makeChain(),
  };
  const db = {
    select: () => makeChain(),
    insert: () => makeChain(),
    update: () => makeChain(),
    delete: () => makeChain(),
    execute: () => makeChain(),
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
  desc: vi.fn(() => ({})),
  lte: vi.fn(() => ({})),
  gte: vi.fn(() => ({})),
  isNull: vi.fn(() => ({})),
  or: vi.fn(() => ({})),
  sql: vi.fn(() => ({})),
}));
vi.mock('@/lib/audit-logger', () => ({
  auditLog: h.auditLog,
  AuditEventType: { DATA_CREATE: 'data_create' },
  AuditSeverity: { HIGH: 'high', CRITICAL: 'critical' },
}));
vi.mock('uuid', () => ({ v4: () => '00000000-1111-2222-3333-444444444444' }));

import {
  createAllocationRule,
  getActiveRuleVersion,
  getAllocationRules,
  getAllocationRun,
  getChargebacks,
  runAllocation,
} from '../allocation-engine';

const pushSel = (...items: unknown[]) => h.queue.push(...items);

const localBasis = [
  { localId: 'l1', localName: 'L1', memberCount: 1, activeUserCount: 1, caseVolume: 1 },
  { localId: 'l2', localName: 'L2', memberCount: 1, activeUserCount: 1, caseVolume: 1 },
  { localId: 'l3', localName: 'L3', memberCount: 1, activeUserCount: 1, caseVolume: 1 },
];

beforeEach(() => {
  h.queue.length = 0;
  h.auditLog.mockReset();
});

describe('platform-economics/allocation-engine', () => {
  describe('createAllocationRule', () => {
    it('creates a rule with an initial version', async () => {
      pushSel([{ id: 'rule-1' }]); // rule returning
      pushSel([{ id: 'ver-1' }]); // version returning
      const result = await createAllocationRule({
        organizationId: 'o1',
        name: 'Rule',
        method: 'per_member_count' as never,
        effectiveFrom: new Date('2025-01-01'),
        createdBy: 'user-1',
      });
      expect(result.rule.id).toBe('rule-1');
      expect(result.version.id).toBe('ver-1');
      expect(h.auditLog).toHaveBeenCalledTimes(1);
    });
  });

  describe('getActiveRuleVersion', () => {
    it('returns the active version', async () => {
      pushSel([{ id: 'ver-1' }]);
      expect(await getActiveRuleVersion('rule-1')).toEqual({ id: 'ver-1' });
    });

    it('returns null when none is active', async () => {
      pushSel([]);
      expect(await getActiveRuleVersion('rule-1')).toBeNull();
    });
  });

  describe('getAllocationRules', () => {
    it('lists rules for an org', async () => {
      pushSel([{ id: 'rule-1' }]);
      expect(await getAllocationRules('o1')).toHaveLength(1);
    });
  });

  describe('runAllocation', () => {
    it('runs a posted allocation with ledger entries and chargebacks', async () => {
      pushSel([{ id: 'bp1', isClosed: false, label: 'P1' }]); // billing period
      pushSel([{ id: 'ver-1', method: 'per_member_count', weights: null }]); // rule version
      pushSel([{ total: '100.00' }]); // cost total
      const result = await runAllocation({
        organizationId: 'o1',
        billingPeriodId: 'bp1',
        ruleId: 'rule-1',
        localBasis,
        createdBy: 'user-1',
      });
      expect(result.isSimulation).toBe(false);
      expect(result.lines).toHaveLength(3);
      expect(result.totalAmount).toBe('100.00');
      // rounding distributed so the allocations sum to the total
      const sum = result.lines.reduce((s, l) => s + Math.round(Number(l.allocatedAmount) * 100), 0);
      expect(sum).toBe(10000);
    });

    it('runs a simulation with the weighted_hybrid method', async () => {
      pushSel([{ id: 'ver-1', method: 'weighted_hybrid', weights: { per_member_count: 1, per_active_user: 1 } }]);
      pushSel([{ total: '50.00' }]);
      const result = await runAllocation({
        organizationId: 'o1',
        billingPeriodId: 'bp1',
        ruleId: 'rule-1',
        isSimulation: true,
        localBasis: localBasis.slice(0, 2),
      });
      expect(result.isSimulation).toBe(true);
      expect(result.lines).toHaveLength(2);
    });

    it('throws when the billing period is not found', async () => {
      pushSel([]); // period missing
      await expect(
        runAllocation({ organizationId: 'o1', billingPeriodId: 'bp1', ruleId: 'r1', localBasis }),
      ).rejects.toThrow('not found');
    });

    it('throws when the billing period is closed', async () => {
      pushSel([{ id: 'bp1', isClosed: true, label: 'P1' }]);
      await expect(
        runAllocation({ organizationId: 'o1', billingPeriodId: 'bp1', ruleId: 'r1', localBasis }),
      ).rejects.toThrow('is closed');
    });

    it('throws when there is no active rule version', async () => {
      pushSel([{ id: 'bp1', isClosed: false, label: 'P1' }]); // period
      pushSel([]); // rule version missing
      await expect(
        runAllocation({ organizationId: 'o1', billingPeriodId: 'bp1', ruleId: 'r1', localBasis }),
      ).rejects.toThrow('No active version');
    });

    it('throws when there are no unallocated costs', async () => {
      pushSel([{ id: 'bp1', isClosed: false, label: 'P1' }]); // period
      pushSel([{ id: 'ver-1', method: 'per_member_count', weights: null }]); // version
      pushSel([{ total: '0' }]); // zero cost
      await expect(
        runAllocation({ organizationId: 'o1', billingPeriodId: 'bp1', ruleId: 'r1', localBasis }),
      ).rejects.toThrow('No unallocated costs');
    });
  });

  describe('getAllocationRun', () => {
    it('returns the run with lines and snapshots', async () => {
      pushSel([{ id: 'run-1' }]); // run
      pushSel([{ id: 'line-1' }]); // lines
      pushSel([{ id: 'snap-1' }]); // snapshots
      const result = await getAllocationRun('run-1');
      expect(result?.id).toBe('run-1');
      expect(result?.lines).toHaveLength(1);
      expect(result?.snapshots).toHaveLength(1);
    });

    it('returns null when the run is missing', async () => {
      pushSel([]);
      expect(await getAllocationRun('run-x')).toBeNull();
    });
  });

  describe('getChargebacks', () => {
    it('queries chargebacks with filters', async () => {
      pushSel([{ id: 'cb-1' }]);
      const result = await getChargebacks({ organizationId: 'o1', billingPeriodId: 'bp1', localId: 'l1' });
      expect(result).toHaveLength(1);
    });
  });
});
