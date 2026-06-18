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
  const auditLog = vi.fn();
  const getActiveContract = vi.fn();
  return { queue, db, auditLog, getActiveContract };
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
  lte: vi.fn(() => ({})),
}));
vi.mock('@/lib/audit-logger', () => ({
  auditLog: h.auditLog,
  AuditEventType: { DATA_UPDATE: 'data_update' },
  AuditSeverity: { HIGH: 'high', MEDIUM: 'medium' },
}));
vi.mock('../contract-service', () => ({ getActiveContract: h.getActiveContract }));

import {
  expireTrials,
  getTrialsEndingSoon,
  pauseSubscription,
  processAutoRenewals,
  resumeSubscription,
} from '../subscription-lifecycle-service';

const pushSel = (...items: unknown[]) => h.queue.push(...items);

beforeEach(() => {
  h.queue.length = 0;
  h.auditLog.mockReset();
  h.getActiveContract.mockReset();
});

describe('platform-economics/subscription-lifecycle-service', () => {
  describe('expireTrials', () => {
    it('converts trials with a payment method to active', async () => {
      pushSel([{ id: 'sub-1', organizationId: 'o1' }]); // expired trials
      pushSel([]); // update
      pushSel([]); // insert events log
      const actions = await expireTrials(async () => true);
      expect(actions).toHaveLength(1);
      expect(actions[0]!.action).toBe('trial_converted');
      expect(actions[0]!.newStatus).toBe('active');
    });

    it('cancels trials without a payment method', async () => {
      pushSel([{ id: 'sub-1', organizationId: 'o1' }]);
      pushSel([]); // update
      pushSel([]); // insert
      const actions = await expireTrials(async () => false);
      expect(actions[0]!.action).toBe('trial_expired');
      expect(actions[0]!.newStatus).toBe('cancelled');
    });

    it('returns an empty list when no trials are expired', async () => {
      pushSel([]);
      const actions = await expireTrials(async () => true);
      expect(actions).toEqual([]);
    });
  });

  describe('getTrialsEndingSoon', () => {
    it('returns the subscriptions ending soon', async () => {
      pushSel([{ id: 'sub-1' }]);
      const result = await getTrialsEndingSoon(5);
      expect(result).toHaveLength(1);
    });
  });

  describe('pauseSubscription', () => {
    it('pauses an active subscription', async () => {
      pushSel([{ id: 'sub-1', organizationId: 'o1' }]); // update returning
      pushSel([]); // insert events log
      const action = await pauseSubscription('sub-1', 'user-1', 'maintenance');
      expect(action.action).toBe('paused');
      expect(h.auditLog).toHaveBeenCalledTimes(1);
    });

    it('throws when the subscription is not active', async () => {
      pushSel([]); // update returning empty
      await expect(pauseSubscription('sub-1', 'user-1')).rejects.toThrow('not found or not active');
    });
  });

  describe('resumeSubscription', () => {
    it('resumes a paused subscription', async () => {
      pushSel([{ id: 'sub-1', organizationId: 'o1' }]); // update returning
      pushSel([]); // insert events log
      const action = await resumeSubscription('sub-1', 'user-1');
      expect(action.action).toBe('resumed');
      expect(h.auditLog).toHaveBeenCalledTimes(1);
    });

    it('throws when the subscription is not paused', async () => {
      pushSel([]); // update returning empty
      await expect(resumeSubscription('sub-1', 'user-1')).rejects.toThrow('not found or not paused');
    });
  });

  describe('processAutoRenewals', () => {
    it('skips renewal when there is no active contract', async () => {
      pushSel([{ id: 'sub-1', organizationId: 'o1', endDate: new Date('2025-02-01') }]); // expiring
      h.getActiveContract.mockResolvedValueOnce(null);
      const renewed = await processAutoRenewals();
      expect(renewed).toEqual([]);
    });

    it('renews and caps the end date at the contract expiration', async () => {
      pushSel([{ id: 'sub-1', organizationId: 'o1', endDate: new Date('2025-02-01') }]); // expiring
      h.getActiveContract.mockResolvedValueOnce({ expirationDate: new Date('2025-02-15') });
      pushSel([]); // update
      pushSel([]); // insert events log
      const renewed = await processAutoRenewals();
      expect(renewed).toEqual(['sub-1']);
    });

    it('renews by one month when within the contract window', async () => {
      pushSel([{ id: 'sub-1', organizationId: 'o1', endDate: new Date('2025-02-01') }]);
      h.getActiveContract.mockResolvedValueOnce({ expirationDate: new Date('2026-01-01') });
      pushSel([]); // update
      pushSel([]); // insert
      const renewed = await processAutoRenewals();
      expect(renewed).toEqual(['sub-1']);
    });

    it('handles a subscription with a null end date', async () => {
      pushSel([{ id: 'sub-1', organizationId: 'o1', endDate: null }]);
      h.getActiveContract.mockResolvedValueOnce({ expirationDate: null });
      pushSel([]); // update
      pushSel([]); // insert
      const renewed = await processAutoRenewals();
      expect(renewed).toEqual(['sub-1']);
    });
  });
});
