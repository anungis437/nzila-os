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
  const tx = {
    insert: () => makeChain(),
    select: () => makeChain(),
    update: () => makeChain(),
  };
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
  lte: vi.fn(() => ({})),
  gte: vi.fn(() => ({})),
  isNull: vi.fn(() => ({})),
  or: vi.fn(() => ({})),
  sql: Object.assign(vi.fn(() => ({})), { raw: vi.fn(() => ({})) }),
  desc: vi.fn(() => ({})),
  inArray: vi.fn(() => ({})),
}));
vi.mock('@/lib/audit-logger', () => ({
  auditLog: h.auditLog,
  AuditEventType: { DATA_CREATE: 'data_create', DATA_UPDATE: 'data_update' },
  AuditSeverity: { HIGH: 'high', MEDIUM: 'medium', CRITICAL: 'critical' },
}));
vi.mock('uuid', () => ({ v4: () => '00000000-1111-2222-3333-444444444444' }));

import {
  activateContract,
  checkContractEntitlement,
  createContract,
  getActiveContract,
  getContractLineItems,
  recordEntitlementUsage,
  resetExpiredUsagePeriods,
  terminateContract,
} from '../contract-service';

const pushSel = (...items: unknown[]) => h.queue.push(...items);

const baseContract = {
  organizationId: 'o1',
  billingAccountId: 'ba1',
  name: 'Test',
  effectiveDate: new Date('2025-01-01'),
  expirationDate: new Date('2025-12-31'),
  createdBy: 'user-1',
};

beforeEach(() => {
  h.queue.length = 0;
  h.auditLog.mockReset();
});

describe('platform-economics/contract-service', () => {
  describe('createContract', () => {
    it('creates a contract with line items', async () => {
      pushSel([{ id: 'ctr-1', organizationId: 'o1' }]); // contract returning
      pushSel([{ id: 'li-1' }]); // line item returning
      const result = await createContract({
        ...baseContract,
        lineItems: [
          {
            lineType: 'feature' as never,
            featureKey: 'f1',
            description: 'd',
            effectiveDate: new Date('2025-01-01'),
          },
        ],
      });
      expect(result.contract.id).toBe('ctr-1');
      expect(result.lineItems).toHaveLength(1);
      expect(h.auditLog).toHaveBeenCalledTimes(1);
    });

    it('creates a contract with no line items', async () => {
      pushSel([{ id: 'ctr-2', organizationId: 'o1' }]); // contract returning
      const result = await createContract(baseContract);
      expect(result.lineItems).toEqual([]);
    });
  });

  describe('activateContract', () => {
    it('activates and provisions entitlements', async () => {
      pushSel([{ id: 'ctr-1', organizationId: 'o1', expirationDate: new Date('2025-12-31') }]); // update returning
      pushSel([{ id: 'li-1', featureKey: 'f1', expirationDate: null }]); // line items
      pushSel([{ id: 'ent-1' }]); // entitlement upsert returning
      const result = await activateContract('ctr-1', 'approver');
      expect(result.entitlements).toHaveLength(1);
      expect(h.auditLog).toHaveBeenCalledTimes(1);
    });

    it('throws when the contract is not in draft', async () => {
      pushSel([]); // update returning empty
      await expect(activateContract('ctr-1', 'approver')).rejects.toThrow('not found or not in draft');
    });
  });

  describe('terminateContract', () => {
    it('terminates and revokes entitlements', async () => {
      pushSel([{ id: 'ctr-1', organizationId: 'o1' }]); // update returning
      pushSel([{ id: 'li-1' }]); // line items
      pushSel([]); // update entitlements revoke
      const result = await terminateContract('ctr-1', 'user-1', 'reason');
      expect(result.id).toBe('ctr-1');
      expect(h.auditLog).toHaveBeenCalledTimes(1);
    });

    it('handles a contract with no line items', async () => {
      pushSel([{ id: 'ctr-1', organizationId: 'o1' }]); // update returning
      pushSel([]); // no line items
      const result = await terminateContract('ctr-1', 'user-1');
      expect(result.id).toBe('ctr-1');
    });

    it('throws when the contract is not active', async () => {
      pushSel([]); // update returning empty
      await expect(terminateContract('ctr-1', 'user-1')).rejects.toThrow('not found or not active');
    });
  });

  describe('getActiveContract', () => {
    it('returns the active contract', async () => {
      pushSel([{ id: 'ctr-1' }]);
      expect(await getActiveContract('o1')).toEqual({ id: 'ctr-1' });
    });

    it('returns null when none found', async () => {
      pushSel([]);
      expect(await getActiveContract('o1')).toBeNull();
    });
  });

  describe('getContractLineItems', () => {
    it('returns the line items', async () => {
      pushSel([{ id: 'li-1' }]);
      expect(await getContractLineItems('ctr-1')).toHaveLength(1);
    });
  });

  describe('checkContractEntitlement', () => {
    it('denies when no active entitlement exists', async () => {
      pushSel([]);
      const result = await checkContractEntitlement('o1', 'f1');
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/No active entitlement/);
    });

    it('denies when usage limit is exceeded', async () => {
      pushSel([{ usageLimit: 5, currentUsage: 5 }]);
      const result = await checkContractEntitlement('o1', 'f1');
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/Usage limit exceeded/);
    });

    it('allows when within the usage limit', async () => {
      pushSel([{ usageLimit: 10, currentUsage: 2 }]);
      const result = await checkContractEntitlement('o1', 'f1');
      expect(result.allowed).toBe(true);
      expect(result.usageLimit).toBe(10);
    });

    it('allows when there is no usage limit', async () => {
      pushSel([{ usageLimit: null, currentUsage: 3 }]);
      const result = await checkContractEntitlement('o1', 'f1');
      expect(result.allowed).toBe(true);
      expect(result.usageLimit).toBeUndefined();
    });
  });

  describe('recordEntitlementUsage', () => {
    it('increments usage and writes the log', async () => {
      pushSel([{ id: 'ent-1', currentUsage: 3, usageLimit: 10 }]); // update returning
      pushSel([]); // insert usage log
      const result = await recordEntitlementUsage('o1', 'f1', 'user-1', 2);
      expect(result.newUsage).toBe(3);
      expect(result.limit).toBe(10);
    });

    it('throws when there is no active entitlement', async () => {
      pushSel([]); // update returning empty
      await expect(recordEntitlementUsage('o1', 'f1', 'user-1')).rejects.toThrow('No active entitlement');
    });
  });

  describe('resetExpiredUsagePeriods', () => {
    it('returns the number of reset entitlements', async () => {
      pushSel([{ id: 'e1' }, { id: 'e2' }]); // update returning
      expect(await resetExpiredUsagePeriods()).toBe(2);
    });
  });
});
