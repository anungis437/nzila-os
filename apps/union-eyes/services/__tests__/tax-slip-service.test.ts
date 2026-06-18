import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
  process.env.ACCOUNTING_EMAIL = 'acct@x.com';

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
  const findFirst = vi.fn(async () => undefined);
  const db = {
    select: vi.fn(() => makeChain()),
    insert: vi.fn(() => makeChain()),
    update: vi.fn(() => makeChain()),
    delete: vi.fn(() => makeChain()),
    query: { users: { findFirst } },
  };
  const notifSend = vi.fn(async () => ({ id: 'n1' }));
  const decryptSIN = vi.fn(async () => 'SIN123');
  const proxy = () => new Proxy({}, {
    has: () => true,
    get: (_t: unknown, n: string | symbol) => (n === '__esModule' ? false : new Proxy({}, { get: (_o, c) => ({ __col: c }) })),
  });
  return { queue, db, findFirst, notifSend, decryptSIN, proxy };
});

const pushSel = (...items: unknown[]) => { h.queue.push(...items); };

vi.mock('@/db', () => ({ db: h.db }));
vi.mock('@/db/schema/domains/finance', () => h.proxy());
vi.mock('@/db/schema/domains/member', () => h.proxy());
vi.mock('@/db/schema/domains/member/addresses', () => h.proxy());
vi.mock('@/db/schema/organization-members-schema', () => h.proxy());
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/encryption', () => ({ decryptSIN: h.decryptSIN }));
vi.mock('@/lib/services/notification-service', () => ({ NotificationService: class { send = h.notifSend; } }));
vi.mock('drizzle-orm', async (orig) => ({
  ...(await (orig() as Promise<Record<string, unknown>>)),
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
}));

import { TaxSlipService } from '../tax-slip-service';

const S = TaxSlipService;

beforeEach(() => {
  h.queue.length = 0;
  h.db.select.mockClear();
  h.db.insert.mockClear();
  h.db.update.mockClear();
  h.findFirst.mockReset();
  h.findFirst.mockResolvedValue(undefined);
  h.notifSend.mockClear();
});

describe('tax-slip-service', () => {
  describe('recordDisbursement', () => {
    const base = {
      userId: 'u1', strikeId: 's1', strikeName: 'Strike', paymentDate: new Date('2026-03-10'),
      paymentMethod: 'eft', province: 'ON',
    };

    it('records a disbursement below the threshold (new tracking)', async () => {
      pushSel(
        [], // getWeeklyTotal → 0
        [{ id: 'd1' }], // insert disbursement
        [], // updateWeeklyThresholdTracking existing select → none
        [], // insert tracking
      );
      const r = await S.recordDisbursement({ ...base, paymentAmount: 100 });
      expect(r).toEqual({ id: 'd1' });
      expect(h.findFirst).not.toHaveBeenCalled();
    });

    it('records a disbursement crossing the threshold and notifies (existing tracking)', async () => {
      h.findFirst.mockResolvedValue({ id: 'u1', email: 'u1@x.com', organizationId: 'org1' });
      pushSel(
        [{ paymentAmount: '450.00' }], // getWeeklyTotal → 450
        [{ id: 'd2' }], // insert disbursement
        [{ id: 'w1', paymentCount: '1' }], // existing tracking
        [], // update tracking
      );
      const r = await S.recordDisbursement({ ...base, province: 'QC', paymentAmount: 100 });
      expect(r).toEqual({ id: 'd2' });
      expect(h.notifSend).toHaveBeenCalledTimes(2);
    });
  });

  describe('generateT4ASlips', () => {
    const payer = { name: 'Union', businessNumber: '123', address: 'a', city: 'c', province: 'ON', postalCode: 'p' };

    it('generates slips for users above threshold and skips zero-total users', async () => {
      pushSel(
        [{ userId: 'u1' }, { userId: 'u2' }], // tracking
        [{ paymentAmount: '600.00' }], // u1 yearly disbursements
        [{ firstName: 'A', lastName: 'B', encryptedSin: 'enc' }], // getMemberTaxInfo users
        [{ name: 'A B' }], // orgMembers
        [{ streetAddress: '1 St', city: 'C', province: 'QC', postalCode: 'X' }], // addresses
        [{ id: 't4a1' }], // insert slip
        [], // update disbursements
        [], // u2 yearly disbursements → total 0 → continue
      );
      const r = await S.generateT4ASlips('2025', payer, 'admin');
      expect(r).toEqual([{ id: 't4a1' }]);
      expect(h.decryptSIN).toHaveBeenCalled();
    });
  });

  describe('generateRL1Slips', () => {
    const payer = { name: 'Union', quebecEnterpriseNumber: 'QC1', address: 'a', city: 'c', postalCode: 'p' };

    it('generates RL-1 slips for Quebec residents', async () => {
      pushSel(
        [{ userId: 'u1' }], // tracking
        [{ paymentAmount: '700.00' }], // yearly disbursements
        [{ firstName: 'A', lastName: 'B', encryptedSin: 'enc' }], // users
        [{ name: 'A B' }], // orgMembers
        [{ streetAddress: '1 St', city: 'C', province: 'QC', postalCode: 'X' }], // addresses
        [{ id: 'rl1' }], // insert slip
        [], // update
      );
      const r = await S.generateRL1Slips('2025', payer, 'admin');
      expect(r).toEqual([{ id: 'rl1' }]);
    });
  });

  describe('processYearEnd', () => {
    it('throws when the year is already processed', async () => {
      pushSel([{ processingCompletedAt: new Date() }]);
      await expect(S.processYearEnd('2025', 'admin')).rejects.toThrow('already processed');
    });

    it('creates a new year-end record', async () => {
      pushSel([], []); // existing none, insert
      const r = await S.processYearEnd('2025', 'admin');
      expect(r.taxYear).toBe('2025');
    });

    it('updates an in-progress year-end record', async () => {
      pushSel([{ processingCompletedAt: null }], []); // existing in-progress, update
      const r = await S.processYearEnd('2025', 'admin');
      expect(r.taxYear).toBe('2025');
    });
  });

  it('completeYearEndProcessing updates the processing record', async () => {
    pushSel([]);
    await S.completeYearEndProcessing('2025', 5, 2, 5000, 2000);
    expect(h.db.update).toHaveBeenCalled();
  });

  it('getUsersRequiringTaxSlips queries threshold-exceeding users', async () => {
    pushSel([{ userId: 'u1' }]);
    expect(await S.getUsersRequiringTaxSlips('2025')).toHaveLength(1);
  });

  describe('checkYearEndDeadline', () => {
    it('reports an overdue deadline requiring action', async () => {
      pushSel([]); // no year-end record
      const r = await S.checkYearEndDeadline('2020');
      expect(r.isOverdue).toBe(true);
      expect(r.requiresAction).toBe(true);
    });

    it('reports a future deadline not requiring action', async () => {
      pushSel([{ processingCompletedAt: new Date() }]);
      const r = await S.checkYearEndDeadline('2999');
      expect(r.isOverdue).toBe(false);
      expect(r.requiresAction).toBe(false);
    });
  });
});
