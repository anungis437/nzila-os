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
vi.mock('@/db/schema/domains/finance', () => new Proxy({}, {
  has: () => true,
  get: (_t, n) => (n === '__esModule' ? false : new Proxy({}, { get: (_o, c) => ({ __col: c }) })),
}));
vi.mock('drizzle-orm', async (orig) => ({
  ...(await (orig() as Promise<Record<string, unknown>>)),
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  gte: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
}));

import { TransferPricingService } from '../transfer-pricing-service';

const S = TransferPricingService;
const enabledPolicy = (over: Record<string, unknown> = {}) => ({ enforcementEnabled: true, ...over });

beforeEach(() => {
  h.queue.length = 0;
});

describe('transfer-pricing-service', () => {
  describe('validateTransactionCurrency', () => {
    it('allows everything when enforcement is disabled', async () => {
      pushSel([enabledPolicy({ enforcementEnabled: false })]);
      const r = await S.validateTransactionCurrency('USD', 100, 'tx1', 'u1');
      expect(r.allowed).toBe(true);
    });

    it('allows CAD transactions', async () => {
      pushSel([enabledPolicy()]);
      const r = await S.validateTransactionCurrency('CAD', 100, 'tx1', 'u1');
      expect(r.allowed).toBe(true);
    });

    it('denies and logs a violation for foreign currency', async () => {
      pushSel([enabledPolicy()], []); // policy, logViolation insert
      const r = await S.validateTransactionCurrency('USD', 100, 'tx1', 'u1');
      expect(r.allowed).toBe(false);
      expect(r.reason).toContain('CAD');
    });

    it('creates a default policy when none exists', async () => {
      pushSel([], [enabledPolicy()]); // getPolicy: select empty, insert default
      const r = await S.validateTransactionCurrency('CAD', 100, 'tx1', 'u1');
      expect(r.allowed).toBe(true);
    });
  });

  describe('convertToCAN', () => {
    const req = { transactionId: 'tx1', originalCurrency: 'USD', originalAmount: 100, transactionType: 'service', requestedBy: 'u1' };

    it('throws when no Bank of Canada rate is available', async () => {
      // getPolicy, getBankOfCanadaRate select → empty then its own throw
      pushSel([enabledPolicy()], []);
      await expect(S.convertToCAN(req)).rejects.toThrow('Bank of Canada rate');
    });

    it('converts and records the conversion (below T106 threshold)', async () => {
      pushSel(
        [enabledPolicy()], // getPolicy
        [{ noonRate: '1.35', rateDate: new Date('2026-01-02') }], // getBankOfCanadaRate
        [{ id: 'conv1' }], // conversion insert
        [], // logAuditAction
        // checkT106Threshold: cadAmount=135 < 1M → returns early, no more queue
      );
      const r = await S.convertToCAN(req);
      expect(r.cadAmount).toBeCloseTo(135);
      expect(r.fxRate).toBe(1.35);
    });

    it('converts a large amount and tracks T106 threshold (new tracking)', async () => {
      pushSel(
        [enabledPolicy()], // getPolicy
        [{ noonRate: '2.00', rateDate: new Date('2026-01-02') }], // rate
        [{ id: 'conv2' }], // conversion insert
        [], // logAuditAction
        // checkT106Threshold: cadAmount = 1,000,000 (500000*2) ≥ 1M
        [], // tracking select empty
        [{ totalCADEquivalent: '0.00' }], // tracking insert returning
        [], // tracking update
        [], // logAuditAction (threshold exceeded)
      );
      const r = await S.convertToCAN({ ...req, originalAmount: 500000 });
      expect(r.cadAmount).toBeCloseTo(1000000);
    });

    it('tracks T106 threshold with an existing tracking record', async () => {
      pushSel(
        [enabledPolicy()],
        [{ noonRate: '2.00', rateDate: new Date('2026-01-02') }],
        [{ id: 'conv3' }],
        [],
        [{ totalCADEquivalent: '0.00' }], // tracking exists
        [], // tracking update
        [], // logAuditAction
      );
      const r = await S.convertToCAN({ ...req, originalAmount: 500000 });
      expect(r.cadAmount).toBeCloseTo(1000000);
    });
  });

  describe('getBankOfCanadaRate', () => {
    it('returns an existing rate', async () => {
      pushSel([{ noonRate: '1.35' }]);
      const r = await S.getBankOfCanadaRate('USD');
      expect(r).toEqual({ noonRate: '1.35' });
    });

    it('throws when no rate exists', async () => {
      pushSel([]);
      await expect(S.getBankOfCanadaRate('USD')).rejects.toThrow('not available in database');
    });
  });

  it('importBankOfCanadaRates inserts each rate and logs', async () => {
    pushSel([{ id: 'r1' }], [], [{ id: 'r2' }], []); // 2 rates: insert+log each
    const r = await S.importBankOfCanadaRates([
      { currency: 'USD', noonRate: 1.35, rateDate: new Date('2026-01-02') },
      { currency: 'EUR', noonRate: 1.45, rateDate: new Date('2026-01-02') },
    ]);
    expect(r).toHaveLength(2);
  });

  it('fileT106Return updates tracking and logs', async () => {
    pushSel([], []); // update, logAuditAction
    await S.fileT106Return({ fiscalYear: '2025', reportableTransactions: ['tx1'], totalCADEquivalent: 1500000 }, 'admin');
    expect(h.db.update).toHaveBeenCalled();
  });

  it('documentTransferPricing inserts and returns documentation', async () => {
    pushSel([{ id: 'doc1' }]);
    const r = await S.documentTransferPricing({
      transactionId: 'tx1',
      transactionType: 'service',
      fromParty: 'a',
      toParty: 'b',
      cadAmount: 1000,
      pricingJustification: 'j',
      documentedBy: 'u1',
    });
    expect(r).toEqual({ id: 'doc1' });
  });

  describe('verifyArmsLengthPricing', () => {
    it('confirms arms-length pricing', async () => {
      pushSel([], []);
      await S.verifyArmsLengthPricing('doc1', 'reviewer', true, 'ok');
      expect(h.db.update).toHaveBeenCalled();
    });

    it('rejects arms-length pricing', async () => {
      pushSel([], []);
      await S.verifyArmsLengthPricing('doc1', 'reviewer', false);
      expect(h.db.update).toHaveBeenCalled();
    });
  });

  describe('getT106Status', () => {
    it('returns defaults when no tracking exists', async () => {
      pushSel([]);
      const r = await S.getT106Status('2025');
      expect(r.filingRequired).toBe(false);
      expect(r.filingStatus).toBe('not_required');
    });

    it('returns the tracking record when present', async () => {
      pushSel([{ fiscalYear: '2025', filingStatus: 'filed' }]);
      const r = await S.getT106Status('2025');
      expect(r).toEqual({ fiscalYear: '2025', filingStatus: 'filed' });
    });
  });

  describe('getViolations', () => {
    it('filters by status when provided', async () => {
      pushSel([{ id: 'v1' }]);
      expect(await S.getViolations('pending')).toEqual([{ id: 'v1' }]);
    });

    it('returns all violations without a status filter', async () => {
      pushSel([{ id: 'v1' }, { id: 'v2' }]);
      expect(await S.getViolations()).toHaveLength(2);
    });
  });
});
