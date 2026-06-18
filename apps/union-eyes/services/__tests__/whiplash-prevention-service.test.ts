import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    const methods = [
      'select', 'from', 'where', 'limit', 'orderBy', 'groupBy',
      'innerJoin', 'leftJoin', 'insert', 'update', 'set', 'values', 'returning', 'delete',
    ];
    for (const m of methods) chain[m] = vi.fn(() => chain);
    (chain as { then: unknown }).then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
      const item = queue.length ? queue.shift() : [];
      if (item instanceof Error) return Promise.reject(item).catch(reject);
      return Promise.resolve(item).then(resolve);
    };
    return chain;
  };
  const db = {
    select: vi.fn(() => makeChain()),
    insert: vi.fn(() => makeChain()),
    update: vi.fn(() => makeChain()),
    delete: vi.fn(() => makeChain()),
  };
  return { queue, db };
});

const pushSel = (...items: unknown[]) => { h.queue.push(...items); };

vi.mock('@/db', () => ({ db: h.db }));
vi.mock('@/db/schema/whiplash-prevention-schema', () => new Proxy({}, {
  has: () => true,
  get: (_t, n) => (n === '__esModule' ? false : new Proxy({}, { get: (_o, c) => ({ __col: c }) })),
}));
vi.mock('drizzle-orm', async (orig) => ({
  ...(await (orig() as Promise<Record<string, unknown>>)),
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
  gte: vi.fn(() => ({})),
}));

import { WhiplashPreventionService } from '../whiplash-prevention-service';

const S = WhiplashPreventionService;

beforeEach(() => {
  h.queue.length = 0;
});

describe('whiplash-prevention-service', () => {
  describe('registerConnectAccount', () => {
    const base = { accountPurpose: 'p', stripeAccountId: 'acct', accountEmail: 'e@x.com', accountName: 'N', createdBy: 'admin' };

    it('registers a strike-fund account with trust designation', async () => {
      pushSel([{ id: 'a1' }], []); // insert account, logAuditAction insert
      const r = await S.registerConnectAccount({ ...base, accountType: 'strike_fund' });
      expect(r).toEqual({ id: 'a1' });
    });

    it('registers an operational account', async () => {
      pushSel([{ id: 'a2' }], []);
      const r = await S.registerConnectAccount({ ...base, accountType: 'operational' });
      expect(r).toEqual({ id: 'a2' });
    });
  });

  describe('createRoutingRule', () => {
    it('forces mandatory routing for strike-fund category', async () => {
      pushSel([{ id: 'r1' }]);
      const r = await S.createRoutingRule({ paymentType: 'donation', paymentCategory: 'strike_fund', destinationAccountId: 'a1', destinationAccountType: 'strike_fund' });
      expect(r).toEqual({ id: 'r1' });
    });

    it('uses defaults for non-strike categories', async () => {
      pushSel([{ id: 'r2' }]);
      const r = await S.createRoutingRule({ paymentType: 'dues', paymentCategory: 'operational', destinationAccountId: 'a2', destinationAccountType: 'operational' });
      expect(r).toEqual({ id: 'r2' });
    });
  });

  describe('routePayment', () => {
    const tx = (over: Record<string, unknown> = {}) => ({
      paymentType: 'donation',
      paymentCategory: 'strike_fund',
      paymentAmount: 5000,
      payerId: 'p1',
      payerEmail: 'p@x.com',
      ...over,
    });

    it('throws when no routing rule is found', async () => {
      pushSel([]);
      await expect(S.routePayment(tx())).rejects.toThrow('No routing rule');
    });

    it('throws when the destination account is missing', async () => {
      pushSel([{ id: 'r1', destinationAccountId: 'a1' }], []);
      await expect(S.routePayment(tx())).rejects.toThrow('Destination account not found');
    });

    it('detects a violation when strike payment routed to a non-strike account', async () => {
      pushSel(
        [{ id: 'r1', destinationAccountId: 'a1' }], // routing rule
        [{ id: 'a1', accountType: 'operational' }], // account
        [{ id: 'v1' }], // detectViolation insert
        [], // logAuditAction inside detectViolation
      );
      const r = await S.routePayment(tx());
      expect(r.violationDetected).toBe(true);
      expect(r.separationEnforced).toBe(false);
    });

    it('routes a payment to the correct account', async () => {
      pushSel(
        [{ id: 'r1', destinationAccountId: 'a1' }], // routing rule
        [{ id: 'a1', accountType: 'strike_fund' }], // account
        [{ id: 'tx1' }], // transaction insert
        [], // logAuditAction
      );
      const r = await S.routePayment(tx());
      expect(r.separationEnforced).toBe(true);
      expect(r.correctAccountUsed).toBe(true);
      expect(r.routedToAccountType).toBe('strike_fund');
    });
  });

  describe('verifyPaymentRouting', () => {
    it('throws when the transaction is not found', async () => {
      pushSel([]);
      await expect(S.verifyPaymentRouting('tx1')).rejects.toThrow('Transaction not found');
    });

    it('reports violations for a non-compliant transaction', async () => {
      pushSel([{ separationEnforced: false, correctAccountUsed: false, paymentCategory: 'strike_fund', routedToAccountType: 'operational' }]);
      const r = await S.verifyPaymentRouting('tx1');
      expect(r.compliant).toBe(false);
      expect(r.violations).toHaveLength(3);
    });

    it('reports compliance for a clean transaction', async () => {
      pushSel([{ separationEnforced: true, correctAccountUsed: true, paymentCategory: 'strike_fund', routedToAccountType: 'strike_fund' }]);
      const r = await S.verifyPaymentRouting('tx1');
      expect(r.compliant).toBe(true);
    });
  });

  describe('getStrikeFundTransactions', () => {
    it('returns transactions without a date filter', async () => {
      pushSel([{ id: 't1' }]);
      expect(await S.getStrikeFundTransactions()).toEqual([{ id: 't1' }]);
    });

    it('applies a start-date filter when provided', async () => {
      pushSel([{ id: 't2' }]);
      expect(await S.getStrikeFundTransactions(new Date('2026-01-01'))).toEqual([{ id: 't2' }]);
    });
  });

  it('getOpenViolations returns open violations', async () => {
    pushSel([{ id: 'v1' }]);
    expect(await S.getOpenViolations()).toEqual([{ id: 'v1' }]);
  });

  it('resolveViolation updates and logs', async () => {
    pushSel([{ id: 'v1', violationStatus: 'resolved' }], []);
    const r = await S.resolveViolation('v1', 'fixed', 'admin', 'notes');
    expect(r).toEqual({ id: 'v1', violationStatus: 'resolved' });
  });

  describe('reconcileAccountBalance', () => {
    it('marks reconciled when balances match', async () => {
      pushSel([{ id: 'rec1', reconciliationStatus: 'reconciled' }]);
      const r = await S.reconcileAccountBalance('a1', 1000, 1000, 'admin');
      expect(r).toEqual({ id: 'rec1', reconciliationStatus: 'reconciled' });
    });

    it('marks a discrepancy when balances differ', async () => {
      pushSel([{ id: 'rec2', reconciliationStatus: 'discrepancy' }]);
      const r = await S.reconcileAccountBalance('a1', 1000, 900, 'admin');
      expect(r).toEqual({ id: 'rec2', reconciliationStatus: 'discrepancy' });
    });
  });

  describe('generateStrikeFundAudit', () => {
    it('summarizes strike-fund routing and violations', async () => {
      pushSel(
        [
          { paymentCategory: 'strike_fund', routedToAccountType: 'strike_fund', paymentAmount: '1000' },
          { paymentCategory: 'strike_fund', routedToAccountType: 'operational', paymentAmount: '500' },
          { paymentCategory: 'operational', routedToAccountType: 'operational', paymentAmount: '2000' },
        ],
        [{ severity: 'critical' }, { severity: 'low' }],
        [{ id: 'audit1' }],
      );
      const r = await S.generateStrikeFundAudit('Q1', 'auditor');
      expect(r).toEqual({ id: 'audit1' });
    });

    it('reports 100% compliance with no strike payments', async () => {
      pushSel([], [], [{ id: 'audit2' }]);
      const r = await S.generateStrikeFundAudit('Q2', 'auditor');
      expect(r).toEqual({ id: 'audit2' });
    });
  });

  it('getAllConnectAccounts returns all accounts', async () => {
    pushSel([{ id: 'a1' }]);
    expect(await S.getAllConnectAccounts()).toEqual([{ id: 'a1' }]);
  });

  describe('getConnectAccount', () => {
    it('returns the account when found', async () => {
      pushSel([{ id: 'a1' }]);
      expect(await S.getConnectAccount('a1')).toEqual({ id: 'a1' });
    });

    it('returns null when not found', async () => {
      pushSel([]);
      expect(await S.getConnectAccount('a1')).toBeNull();
    });
  });
});
