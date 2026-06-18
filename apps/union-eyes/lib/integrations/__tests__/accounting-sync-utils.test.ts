/**
 * Accounting Sync Utilities — Unit Tests
 *
 * sync-utils mixes pure helpers (fuzzy matching, validation, account
 * categorization) with DB-backed query/reconciliation functions. We drive a
 * single ordered queue shared by both the drizzle relational query API
 * (db.query.<table>.findMany/findFirst) and the builder terminals
 * (update/delete await). drizzle-orm operators stay real (they build inert
 * condition objects that the stubbed builder ignores).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
  const q: unknown[] = [];
  const shift = () => (q.length ? q.shift() : []);
  const makeChain = () => {
    const c: Record<string, unknown> = {};
    for (const m of [
      'select', 'from', 'where', 'orderBy', 'limit', 'set', 'values', 'returning',
      'onConflictDoUpdate', 'update', 'insert', 'delete', 'innerJoin', 'leftJoin', 'offset', 'groupBy',
    ]) {
      c[m] = () => c;
    }
    (c as { then: unknown }).then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const v = shift();
      if (v instanceof Error) return Promise.reject(v).then(res, rej);
      return Promise.resolve(v).then(res, rej);
    };
    return c;
  };
  const asyncShift = async () => {
    const v = shift();
    if (v instanceof Error) throw v;
    return v;
  };
  const tableProxy = new Proxy(
    {},
    { get: () => ({ findMany: asyncShift, findFirst: asyncShift }) },
  );
  const db = {
    select: makeChain,
    insert: makeChain,
    update: makeChain,
    delete: makeChain,
    execute: asyncShift,
    query: tableProxy,
  };
  return { q, db };
});

vi.mock('@/db', () => ({ db: h.db }));
vi.mock('@/db/db', () => ({ db: h.db }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import * as u from '../adapters/accounting/sync-utils';
import { IntegrationProvider } from '../types';

const push = (...rows: unknown[]) => h.q.push(...rows);
beforeEach(() => {
  h.q.length = 0;
  vi.clearAllMocks();
});

describe('accounting sync-utils — invoice reconciliation', () => {
  it('findInvoiceMatches maps external invoices to score-0 matches', async () => {
    push([
      { id: 'i1', invoiceNumber: 'INV1', customerName: 'Acme', totalAmount: '100.50' },
      { id: 'i2', invoiceNumber: 'INV2', customerName: 'Beta', totalAmount: null },
    ]);
    const matches = await u.findInvoiceMatches('org1', IntegrationProvider.XERO);
    expect(matches).toHaveLength(2);
    expect(matches[0].amount).toBe(100.5);
    expect(matches[1].amount).toBe(0);
    expect(matches[0].matchScore).toBe(0);
  });
  it('detectInvoiceConflicts returns [] when no external invoice', async () => {
    push(undefined);
    expect(await u.detectInvoiceConflicts('org1', IntegrationProvider.XERO, 'INV1')).toEqual([]);
  });
  it('detectInvoiceConflicts returns [] when external invoice exists (no internal system)', async () => {
    push({ id: 'i1', invoiceNumber: 'INV1' });
    expect(await u.detectInvoiceConflicts('org1', IntegrationProvider.XERO, 'INV1')).toEqual([]);
  });
  it('reconcileInvoices without date range', async () => {
    push([{ externalId: 'e1', invoiceDate: new Date() }]);
    const r = await u.reconcileInvoices('org1', IntegrationProvider.XERO);
    expect(r.unmatched).toBe(1);
    expect(r.details[0].status).toBe('unmatched');
  });
  it('reconcileInvoices with date range adds between condition', async () => {
    push([{ externalId: 'e1' }, { externalId: 'e2' }]);
    const r = await u.reconcileInvoices('org1', IntegrationProvider.XERO, new Date('2024-01-01'), new Date('2024-12-31'));
    expect(r.unmatched).toBe(2);
  });
});

describe('accounting sync-utils — payment matching', () => {
  it('matchPaymentsToInvoices matches by customer+amount', async () => {
    push([
      { id: 'p1', customerId: 'c1', amount: '50', paymentDate: new Date() },
      { id: 'p2', customerId: 'c2', amount: '75', paymentDate: new Date() },
    ]);
    push({ id: 'inv1' }); // first payment finds invoice
    push(undefined); // second payment no match
    const matches = await u.matchPaymentsToInvoices('org1', IntegrationProvider.XERO);
    expect(matches[0].matched).toBe(true);
    expect(matches[0].amount).toBe(50);
    expect(matches[1].matched).toBe(false);
  });
  it('allocatePayment returns true on success and false on error', async () => {
    expect(
      await u.allocatePayment('org1', IntegrationProvider.XERO, 'p1', [
        { invoiceId: 'i1', amount: 10 },
        { invoiceId: 'i2', amount: 20 },
      ]),
    ).toBe(true);
    // null allocations triggers reduce-on-null inside try -> catch -> false
    expect(
      await u.allocatePayment('org1', IntegrationProvider.XERO, 'p1', null as never),
    ).toBe(false);
  });
});

describe('accounting sync-utils — customer mapping + fuzzy matching', () => {
  it('findCustomerMappings returns unmapped score-0 entries', async () => {
    push([{ id: 'c1', name: 'Acme Corp' }]);
    const m = await u.findCustomerMappings('org1', IntegrationProvider.XERO);
    expect(m[0].matchedBy).toBe('none');
    expect(m[0].matchScore).toBe(0);
  });
  it('fuzzyMatchCustomerName: exact, contains, levenshtein, no-match', () => {
    expect(u.fuzzyMatchCustomerName('Acme Inc', 'acme inc')).toEqual({ match: true, score: 100 });
    const contains = u.fuzzyMatchCustomerName('Acme Corporation', 'Acme');
    expect(contains.score).toBeGreaterThan(0);
    const lev = u.fuzzyMatchCustomerName('Acme', 'Acne');
    expect(lev.score).toBeGreaterThanOrEqual(0);
    const none = u.fuzzyMatchCustomerName('Acme', 'Zzzzzzzz');
    expect(none.match).toBe(false);
  });
});

describe('accounting sync-utils — account mapping', () => {
  it('mapAccountsToCategories categorizes QuickBooks + Xero + unknown types', async () => {
    push([
      { id: 'a1', accountName: 'Bank', accountType: 'BANK', accountSubType: '1000' },
      { id: 'a2', accountName: 'Sales', accountType: 'REVENUE', accountSubType: null },
      { id: 'a3', accountName: 'Mystery', accountType: 'WHATEVER', accountSubType: 'x' },
    ]);
    const m = await u.mapAccountsToCategories('org1', IntegrationProvider.XERO);
    expect(m[0].category).toBe('Asset');
    expect(m[1].category).toBe('Revenue');
    expect(m[2].category).toBe('Other');
  });
});

describe('accounting sync-utils — bulk operations', () => {
  it('bulkUpdateInvoiceStatus returns rowCount (and 0 fallback)', async () => {
    push({ rowCount: 5 });
    expect(await u.bulkUpdateInvoiceStatus('org1', IntegrationProvider.XERO, ['i1'], 'paid')).toBe(5);
    push({});
    expect(await u.bulkUpdateInvoiceStatus('org1', IntegrationProvider.XERO, ['i1'], 'paid')).toBe(0);
  });
  it('bulkDeleteOldRecords returns per-table counts', async () => {
    push({ rowCount: 1 }, { rowCount: 2 }, { rowCount: 3 }, {});
    const r = await u.bulkDeleteOldRecords('org1', IntegrationProvider.XERO, new Date());
    expect(r).toEqual({ invoices: 1, payments: 2, customers: 3, accounts: 0 });
  });
});

describe('accounting sync-utils — validation + currency', () => {
  it('validateInvoiceData flags all missing/invalid fields', () => {
    const bad = u.validateInvoiceData({
      invoiceNumber: '',
      customerId: '   ',
      customerName: '',
      totalAmount: 0,
      invoiceDate: new Date('invalid'),
    });
    expect(bad.valid).toBe(false);
    expect(bad.errors.length).toBe(5);
    const good = u.validateInvoiceData({
      invoiceNumber: 'INV1',
      customerId: 'c1',
      customerName: 'Acme',
      totalAmount: 100,
      invoiceDate: new Date('2024-01-01'),
    });
    expect(good.valid).toBe(true);
  });
  it('validatePaymentData flags missing/invalid fields', () => {
    const bad = u.validatePaymentData({ customerId: '', amount: 0, paymentDate: new Date('invalid') });
    expect(bad.valid).toBe(false);
    expect(bad.errors.length).toBe(3);
    expect(u.validatePaymentData({ customerId: 'c1', amount: 10, paymentDate: new Date() }).valid).toBe(true);
  });
  it('convertCurrency returns amount unchanged (same + different currency)', async () => {
    expect(await u.convertCurrency(100, 'CAD', 'CAD')).toBe(100);
    expect(await u.convertCurrency(100, 'CAD', 'USD', new Date())).toBe(100);
    expect(await u.convertCurrency(100, 'CAD', 'USD')).toBe(100);
  });
});

describe('accounting sync-utils — statistics', () => {
  it('getSyncStatistics aggregates invoices/payments/customers/accounts', async () => {
    const past = new Date('2000-01-01');
    push([
      { status: 'paid' },
      { status: 'draft' },
      { status: 'authorised', dueDate: past },
    ]); // invoices
    push([{ amount: '10' }, { amount: '20.5' }]); // payments
    push([{}, {}]); // customers
    push([{ isActive: true }, { isActive: false }]); // accounts
    const s = await u.getSyncStatistics('org1', IntegrationProvider.XERO);
    expect(s.invoices.total).toBe(3);
    expect(s.invoices.paid).toBe(1);
    expect(s.invoices.draft).toBe(1);
    expect(s.invoices.overdue).toBe(1);
    expect(s.payments.totalAmount).toBeCloseTo(30.5);
    expect(s.customers.total).toBe(2);
    expect(s.accounts.active).toBe(1);
  });
});
