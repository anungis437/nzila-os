import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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
  return { queue, db, fetch: vi.fn() };
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
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import { CurrencyEnforcementService, currencyEnforcementService } from '../currency-enforcement-service';

const okJson = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const rate135 = { observations: [{ FXUSDCAD: { v: '1.35' } }] };

let svc: CurrencyEnforcementService;

beforeEach(() => {
  h.queue.length = 0;
  h.fetch.mockReset();
  h.fetch.mockResolvedValue(okJson(rate135));
  vi.stubGlobal('fetch', h.fetch);
  svc = new CurrencyEnforcementService();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('currency-enforcement-service', () => {
  describe('enforceCurrencyCAD', () => {
    it('approves CAD invoices', async () => {
      const r = await svc.enforceCurrencyCAD({ amount: 100, currency: 'CAD', customerId: 'c1', invoiceDate: new Date() });
      expect(r).toEqual({ approved: true, amountCAD: 100 });
    });

    it('rejects non-CAD invoices', async () => {
      const r = await svc.enforceCurrencyCAD({ amount: 100, currency: 'USD', customerId: 'c1', invoiceDate: new Date() });
      expect(r.approved).toBe(false);
      expect(r.reason).toContain('USD');
    });
  });

  describe('convertUSDToCAD', () => {
    it('converts using the noon rate', async () => {
      const r = await svc.convertUSDToCAD(100, new Date('2026-01-02'));
      expect(r.amountCAD).toBeCloseTo(135);
      expect(r.exchangeRate).toBe(1.35);
      expect(r.source).toContain('Bank of Canada');
    });

    it('returns truthful fresh-fetch provenance', async () => {
      const r = await svc.convertUSDToCAD(100, new Date('2026-01-02'));
      expect(r.provenance.source).toBe('bank_of_canada');
      expect(r.provenance.cacheStatus).toBe('fresh');
      expect(r.source).toBe('Bank of Canada (FXUSDCAD)');
    });

    it('does NOT claim fresh BOC when the value is a cached fallback', async () => {
      // Reality-remediation guard: cached fallback MUST be labelled honestly.
      // If this assertion ever regresses, the endpoint has resumed
      // fabricating provenance and Wave 0 §12 has been violated.
      h.fetch.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
      pushSel([{ bocNoonRate: '1.4', transactionDate: new Date('2026-01-01') }]);
      const r = await svc.convertUSDToCAD(100, new Date('2026-01-02'));
      expect(r.provenance.source).toBe('bank_of_canada_cached');
      expect(r.provenance.cacheStatus).toBe('stale-fallback');
      expect(r.source).toBe('Bank of Canada (cached FXUSDCAD from 2026-01-01)');
      expect(r.source).not.toBe('Bank of Canada (FXUSDCAD)');
    });
  });

  describe('getBankOfCanadaNoonRate', () => {
    it('returns the fetched rate', async () => {
      const r = await svc.getBankOfCanadaNoonRate(new Date('2026-01-02'));
      expect(r).toBe(1.35);
    });

    it('falls back to cached rate on non-ok response', async () => {
      h.fetch.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
      pushSel([{ bocNoonRate: '1.4', transactionDate: new Date('2026-01-01') }]);
      const r = await svc.getBankOfCanadaNoonRate(new Date('2026-01-02'));
      expect(r).toBe(1.4);
    });

    it('falls back when no observations are returned', async () => {
      h.fetch.mockResolvedValue(okJson({ observations: [] }));
      pushSel([{ bocNoonRate: '1.41', transactionDate: new Date('2026-01-01') }]);
      const r = await svc.getBankOfCanadaNoonRate(new Date('2026-01-02'));
      expect(r).toBe(1.41);
    });

    it('falls back when the rate is NaN', async () => {
      h.fetch.mockResolvedValue(okJson({ observations: [{ FXUSDCAD: { v: 'not-a-number' } }] }));
      pushSel([{ bocNoonRate: '1.42', transactionDate: new Date('2026-01-01') }]);
      const r = await svc.getBankOfCanadaNoonRate(new Date('2026-01-02'));
      expect(r).toBe(1.42);
    });

    it('throws when no cached rate is available', async () => {
      h.fetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
      pushSel([]); // getCachedBOCRate returns null
      await expect(svc.getBankOfCanadaNoonRate(new Date('2026-01-02'))).rejects.toThrow('Unable to fetch or find cached');
    });
  });

  describe('checkT106Requirement', () => {
    it('skips for Canadian counterparties', async () => {
      const r = await svc.checkT106Requirement({ amount: 5, currency: 'CAD', counterpartyCountry: 'CA', isRelatedParty: true, transactionDate: new Date() });
      expect(r.requiresT106).toBe(false);
      expect(r.reason).toContain('Canadian');
    });

    it('skips for non-related-party transactions', async () => {
      const r = await svc.checkT106Requirement({ amount: 5, currency: 'CAD', counterpartyCountry: 'US', isRelatedParty: false, transactionDate: new Date() });
      expect(r.requiresT106).toBe(false);
      expect(r.reason).toContain('Not a related-party');
    });

    it('requires T106 above the threshold (USD converted)', async () => {
      const r = await svc.checkT106Requirement({ amount: 1_000_000, currency: 'USD', counterpartyCountry: 'US', isRelatedParty: true, transactionDate: new Date() });
      expect(r.requiresT106).toBe(true);
      expect(r.amountCAD).toBeCloseTo(1_350_000);
    });

    it('does not require T106 below the threshold', async () => {
      const r = await svc.checkT106Requirement({ amount: 100, currency: 'USD', counterpartyCountry: 'US', isRelatedParty: true, transactionDate: new Date() });
      expect(r.requiresT106).toBe(false);
      expect(r.reason).toContain('below');
    });
  });

  describe('recordCrossBorderTransaction', () => {
    const baseData = (over: Record<string, unknown> = {}) => ({
      amountCAD: '500',
      currency: 'CAD',
      counterpartyCountry: 'US',
      counterpartyName: 'Acme',
      isRelatedParty: false,
      transactionDate: new Date('2026-03-01'),
      ...over,
    });

    it('records a CAD transaction without T106', async () => {
      pushSel([{ id: 'tx-cad' }]);
      const r = await svc.recordCrossBorderTransaction(baseData() as never);
      expect(r).toEqual({ id: 'tx-cad' });
    });

    it('records a USD transaction requiring T106 (creates new filing)', async () => {
      pushSel([{ id: 'tx-usd' }], [], []);
      const r = await svc.recordCrossBorderTransaction(
        baseData({ amountCAD: '2000000', currency: 'USD', isRelatedParty: true }) as never,
      );
      expect(r).toEqual({ id: 'tx-usd' });
    });

    it('adds the transaction to an existing T106 filing', async () => {
      pushSel([{ id: 'tx-usd2' }], [{ id: 'f1', transactionIds: ['old'] }], []);
      const r = await svc.recordCrossBorderTransaction(
        baseData({ amountCAD: '2000000', currency: 'USD', isRelatedParty: true }) as never,
      );
      expect(r).toEqual({ id: 'tx-usd2' });
    });

    it('skips updating when the filing already includes the transaction', async () => {
      pushSel([{ id: 'tx-usd3' }], [{ id: 'f1', transactionIds: ['tx-usd3'] }]);
      const r = await svc.recordCrossBorderTransaction(
        baseData({ amountCAD: '2000000', currency: 'USD', isRelatedParty: true }) as never,
      );
      expect(r).toEqual({ id: 'tx-usd3' });
    });
  });

  describe('generateT106Filing', () => {
    it('generates a filing for eligible transactions', async () => {
      pushSel(
        [{ id: 'a', amountCAD: '1500000', counterpartyName: 'X', counterpartyCountry: 'US', transactionType: 'service' }],
        [],
      );
      const r = await svc.generateT106Filing(2025);
      expect(r.taxYear).toBe(2025);
      expect(r.transactions).toHaveLength(1);
      expect(r.totalAmount).toBeCloseTo(1_500_000);
    });

    it('throws when no eligible transactions exist', async () => {
      pushSel([]);
      await expect(svc.generateT106Filing(2025)).rejects.toThrow('No T106-eligible transactions');
    });
  });

  describe('getT106FilingStatus', () => {
    it('returns filings for a specific tax year', async () => {
      pushSel([
        { taxYear: 2024, status: 'pending', transactionIds: ['a', 'b'], filingData: { totalAmount: 100 }, filingDeadline: new Date('2025-06-30') },
      ]);
      const r = await svc.getT106FilingStatus(2024);
      expect(r[0].taxYear).toBe(2024);
      expect(r[0].transactionCount).toBe(2);
      expect(r[0].totalAmount).toBe(100);
    });

    it('defaults to recent years when no tax year is provided', async () => {
      pushSel([
        { taxYear: 2023, status: 'filed', transactionIds: null, filingData: null, filingDeadline: new Date('2024-06-30') },
      ]);
      const r = await svc.getT106FilingStatus();
      expect(r[0].transactionCount).toBe(0);
      expect(r[0].totalAmount).toBe(0);
    });
  });

  describe('validateBillingRequest', () => {
    it('passes for CAD billing', async () => {
      const r = await svc.validateBillingRequest({ customerId: 'c', amount: 10, currency: 'CAD', description: 'd', invoiceDate: new Date() });
      expect(r).toEqual({ valid: true });
    });

    it('fails for non-CAD billing', async () => {
      const r = await svc.validateBillingRequest({ customerId: 'c', amount: 10, currency: 'EUR', description: 'd', invoiceDate: new Date() });
      expect(r.valid).toBe(false);
      expect(r.error).toContain('EUR');
    });
  });

  describe('getCurrencyEnforcementReport', () => {
    it('summarizes enforcement and T106 status', async () => {
      const now = new Date();
      const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      pushSel(
        [
          { currency: 'CAD', transactionDate: now, requiresT106: false, bocNoonRate: null },
          { currency: 'USD', transactionDate: now, requiresT106: true, bocNoonRate: '1.35' },
        ],
        [
          { taxYear: now.getFullYear(), status: 'pending', transactionIds: ['a'], filingData: { totalAmount: 5 }, filingDeadline: soon },
          { taxYear: now.getFullYear() - 1, status: 'filed', transactionIds: ['b'], filingData: { totalAmount: 3 }, filingDeadline: new Date('2020-06-30') },
        ],
      );
      const r = await svc.getCurrencyEnforcementReport();
      expect(r.cadEnforcement.totalInvoices).toBe(2);
      expect(r.cadEnforcement.cadInvoices).toBe(1);
      expect(r.cadEnforcement.nonCADRejected).toBe(1);
      expect(r.cadEnforcement.complianceRate).toBe(50);
      expect(r.t106Status.pendingFilings).toBe(1);
      expect(r.t106Status.completedFilings).toBe(1);
      expect(r.t106Status.upcomingDeadlines).toHaveLength(1);
      expect(r.bocRateUsage.conversionsThisMonth).toBe(1);
      expect(r.bocRateUsage.lastRate).toBe(1.35);
    });

    it('reports a 100% compliance rate when there are no transactions', async () => {
      pushSel([], []);
      const r = await svc.getCurrencyEnforcementReport();
      expect(r.cadEnforcement.complianceRate).toBe(100);
      expect(r.bocRateUsage.lastRate).toBe(0);
    });
  });

  it('exports a singleton instance', () => {
    expect(currencyEnforcementService).toBeInstanceOf(CurrencyEnforcementService);
  });
});
