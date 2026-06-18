import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'from', 'where', 'limit', 'orderBy', 'innerJoin', 'leftJoin', 'insert', 'update', 'set', 'values', 'returning', 'delete']) {
      chain[m] = () => chain;
    }
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const v = queue.length ? queue.shift() : [];
      return (v instanceof Error ? Promise.reject(v) : Promise.resolve(v)).then(res, rej);
    };
    return chain;
  };
  const tx = {
    select: () => makeChain(),
    insert: () => makeChain(),
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
  const appendLedgerEntry = vi.fn(async () => 'ledger-1');
  const requireReconciliation = vi.fn(async () => ({ id: 'run-1' }));
  const getActiveContract = vi.fn();
  return { queue, db, auditLog, appendLedgerEntry, requireReconciliation, getActiveContract };
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
  inArray: vi.fn(() => ({})),
  sql: vi.fn(() => ({})),
  or: vi.fn(() => ({})),
  lt: vi.fn(() => ({})),
}));
vi.mock('@/lib/audit-logger', () => ({
  auditLog: h.auditLog,
  AuditEventType: { DATA_CREATE: 'data_create', DATA_UPDATE: 'data_update', PAYMENT_PROCESSED: 'payment_processed' },
  AuditSeverity: { HIGH: 'high', CRITICAL: 'critical' },
}));
vi.mock('../ledger-service', () => ({ appendLedgerEntry: h.appendLedgerEntry }));
vi.mock('../reconciliation-service', () => ({ requireReconciliation: h.requireReconciliation }));
vi.mock('../contract-service', () => ({ getActiveContract: h.getActiveContract }));

import {
  closeBillingPeriod,
  createBillingAccount,
  generateInvoice,
  getAdminInvoices,
  getAdminPayments,
  getAdminSubscriptions,
  getBillingAccount,
  getInvoices,
  getInvoiceWithLineItems,
  getOrCreateBillingPeriod,
  getPayments,
  recordPayment,
  reconcileExternalInvoicePayment,
  replayInvoiceDeterministically,
  runBillingLifecycleAutomation,
  updateBillingAccount,
} from '../billing-service';

const pushSel = (...items: unknown[]) => h.queue.push(...items);

beforeEach(() => {
  h.queue.length = 0;
  h.auditLog.mockReset();
  h.appendLedgerEntry.mockClear();
  h.requireReconciliation.mockClear();
  h.getActiveContract.mockReset();
});

describe('platform-economics/billing-service', () => {
  describe('createBillingAccount', () => {
    it('creates an account and audits', async () => {
      pushSel([{ id: 'acct-1' }]);
      const account = await createBillingAccount({ organizationId: 'o1', displayName: 'Org', billingEmail: 'a@b.c' });
      expect(account.id).toBe('acct-1');
      expect(h.auditLog).toHaveBeenCalledTimes(1);
    });
  });

  describe('getBillingAccount', () => {
    it('returns the account', async () => {
      pushSel([{ id: 'acct-1' }]);
      expect(await getBillingAccount('o1')).toEqual({ id: 'acct-1' });
    });

    it('returns null when not found', async () => {
      pushSel([]);
      expect(await getBillingAccount('o1')).toBeNull();
    });
  });

  describe('updateBillingAccount', () => {
    it('updates and audits', async () => {
      pushSel([{ id: 'acct-1' }]);
      const result = await updateBillingAccount('o1', { displayName: 'New' }, 'user-1');
      expect(result?.id).toBe('acct-1');
      expect(h.auditLog).toHaveBeenCalledTimes(1);
    });

    it('returns null when not found', async () => {
      pushSel([]);
      expect(await updateBillingAccount('o1', { displayName: 'New' })).toBeNull();
    });
  });

  describe('getOrCreateBillingPeriod', () => {
    it('returns an existing period', async () => {
      pushSel([{ id: 'bp-1' }]);
      const result = await getOrCreateBillingPeriod('o1', '2025-01', new Date(), new Date());
      expect(result.id).toBe('bp-1');
    });

    it('creates a period when none exists', async () => {
      pushSel([]); // existing
      pushSel([{ id: 'bp-2' }]); // created
      const result = await getOrCreateBillingPeriod('o1', '2025-01', new Date(), new Date());
      expect(result.id).toBe('bp-2');
    });
  });

  describe('closeBillingPeriod', () => {
    it('closes a period after reconciliation', async () => {
      pushSel([{ id: 'bp-1', isClosed: false, label: 'P1', organizationId: 'o1' }]); // select
      pushSel([{ id: 'bp-1', isClosed: true }]); // update returning
      const result = await closeBillingPeriod('bp-1', 'user-1');
      expect(result.isClosed).toBe(true);
      expect(h.requireReconciliation).toHaveBeenCalledTimes(1);
    });

    it('throws when the period is missing', async () => {
      pushSel([]);
      await expect(closeBillingPeriod('bp-1', 'user-1')).rejects.toThrow('not found');
    });

    it('throws when the period is already closed', async () => {
      pushSel([{ id: 'bp-1', isClosed: true, label: 'P1' }]);
      await expect(closeBillingPeriod('bp-1', 'user-1')).rejects.toThrow('already closed');
    });
  });

  describe('generateInvoice', () => {
    const account = { id: 'acct-1', netTermsDays: 30 };
    const period = { id: 'bp-1', isClosed: false, label: 'P1', periodStart: new Date('2025-01-01'), periodEnd: new Date('2025-01-31') };
    const subscription = {
      organizationId: 'o1',
      status: 'active',
      planId: 'plan-1',
      localCount: 2,
      seatCount: 3,
      moduleList: ['m1'],
      discountPercent: '1000', // 10%
      subsidyAmount: '5.00',
    };
    const plan = {
      id: 'plan-1',
      code: 'PLAN',
      name: 'Plan',
      baseFee: '100.00',
      perLocalFee: '10.00',
      perSeatFee: '5.00',
      perModuleFee: '20.00',
      updatedAt: new Date('2025-01-01'),
    };

    it('generates an invoice with all line-item types, discount, subsidy and usage', async () => {
      pushSel([account]); // getBillingAccount
      pushSel([period]); // billing period
      pushSel([]); // no existing invoice
      h.getActiveContract.mockResolvedValueOnce({ id: 'ctr-1' });
      pushSel([subscription]); // subscription
      pushSel([plan]); // plan
      pushSel([
        { id: 'agg-1', meterId: 'mtr-1', billableQuantity: '10', unitPrice: '0.50', totalAmount: '5.00', status: 'open', meterCode: 'API', meterUnit: 'calls' },
      ]); // usage aggregates
      pushSel([{ id: 'ue-1' }]); // usage events for agg
      pushSel([{ id: 'inv-1' }]); // tx insert invoice returning
      // line item inserts default to []
      const result = await generateInvoice({ organizationId: 'o1', billingPeriodId: 'bp-1', createdBy: 'user-1' });
      expect(result.id).toBe('inv-1');
      expect(h.appendLedgerEntry).toHaveBeenCalled();
      expect(h.auditLog).toHaveBeenCalledTimes(1);
    });

    it('throws when there is no billing account', async () => {
      pushSel([]); // getBillingAccount empty
      await expect(generateInvoice({ organizationId: 'o1', billingPeriodId: 'bp-1' })).rejects.toThrow('No billing account');
    });

    it('throws when the period is closed', async () => {
      pushSel([account]);
      pushSel([{ id: 'bp-1', isClosed: true, label: 'P1' }]);
      await expect(generateInvoice({ organizationId: 'o1', billingPeriodId: 'bp-1' })).rejects.toThrow('is closed');
    });

    it('throws when an invoice already exists', async () => {
      pushSel([account]);
      pushSel([period]);
      pushSel([{ id: 'inv-x', invoiceNumber: 'INV-X' }]);
      await expect(generateInvoice({ organizationId: 'o1', billingPeriodId: 'bp-1' })).rejects.toThrow('already exists');
    });

    it('throws when there is no active contract', async () => {
      pushSel([account]);
      pushSel([period]);
      pushSel([]);
      h.getActiveContract.mockResolvedValueOnce(null);
      await expect(generateInvoice({ organizationId: 'o1', billingPeriodId: 'bp-1' })).rejects.toThrow('no active contract');
    });

    it('throws when there is no active subscription', async () => {
      pushSel([account]);
      pushSel([period]);
      pushSel([]);
      h.getActiveContract.mockResolvedValueOnce({ id: 'ctr-1' });
      pushSel([]); // no subscription
      await expect(generateInvoice({ organizationId: 'o1', billingPeriodId: 'bp-1' })).rejects.toThrow('No active subscription');
    });

    it('throws when the plan is missing', async () => {
      pushSel([account]);
      pushSel([period]);
      pushSel([]);
      h.getActiveContract.mockResolvedValueOnce({ id: 'ctr-1' });
      pushSel([subscription]);
      pushSel([]); // no plan
      await expect(generateInvoice({ organizationId: 'o1', billingPeriodId: 'bp-1' })).rejects.toThrow('not found');
    });
  });

  describe('recordPayment', () => {
    const account = { id: 'acct-1' };
    const invoice = { id: 'inv-1', organizationId: 'o1', amountPaid: '0.00', totalAmount: '100.00', billingPeriodId: 'bp-1' };

    it('records a full payment and marks the invoice paid', async () => {
      pushSel([account]); // getBillingAccount
      pushSel([invoice]); // invoice
      pushSel([{ id: 'pay-1' }]); // tx insert payment returning
      // allocation insert + invoice update default []
      const result = await recordPayment({ organizationId: 'o1', invoiceId: 'inv-1', amount: '100.00', method: 'card' });
      expect(result.id).toBe('pay-1');
      expect(h.appendLedgerEntry).toHaveBeenCalledTimes(1);
    });

    it('returns the existing payment on idempotency key match', async () => {
      pushSel([account]); // getBillingAccount
      pushSel([{ id: 'pay-existing' }]); // existing by idempotency
      const result = await recordPayment({ organizationId: 'o1', invoiceId: 'inv-1', amount: '10.00', method: 'card', idempotencyKey: 'idem-1' });
      expect(result.id).toBe('pay-existing');
    });

    it('throws when there is no billing account', async () => {
      pushSel([]);
      await expect(recordPayment({ organizationId: 'o1', invoiceId: 'inv-1', amount: '10.00', method: 'card' })).rejects.toThrow('No billing account');
    });

    it('throws when the invoice is missing', async () => {
      pushSel([account]);
      pushSel([]); // invoice missing
      await expect(recordPayment({ organizationId: 'o1', invoiceId: 'inv-1', amount: '10.00', method: 'card' })).rejects.toThrow('not found');
    });

    it('throws when the invoice belongs to another org', async () => {
      pushSel([account]);
      pushSel([{ id: 'inv-1', organizationId: 'other', amountPaid: '0.00', totalAmount: '100.00' }]);
      await expect(recordPayment({ organizationId: 'o1', invoiceId: 'inv-1', amount: '10.00', method: 'card' })).rejects.toThrow('does not belong');
    });

    it('throws when the amount is not positive', async () => {
      pushSel([account]);
      pushSel([invoice]);
      await expect(recordPayment({ organizationId: 'o1', invoiceId: 'inv-1', amount: '0', method: 'card' })).rejects.toThrow('must be positive');
    });
  });

  describe('reconcileExternalInvoicePayment', () => {
    const invoice = { id: 'inv-1', organizationId: 'o1', amountPaid: '0.00', totalAmount: '100.00', status: 'issued', metadata: null };

    it('reconciles a completed external payment', async () => {
      pushSel([invoice]); // invoice
      pushSel([]); // no existing payment
      pushSel([{ id: 'acct-1' }]); // getBillingAccount
      pushSel([{ id: 'pay-1' }]); // insert payment returning
      // transaction allocation + invoice update default []
      const result = await reconcileExternalInvoicePayment({
        organizationId: 'o1',
        invoiceId: 'inv-1',
        amount: '100.00',
        method: 'eft',
        externalReference: 'ext-1',
      });
      expect(result.id).toBe('pay-1');
    });

    it('marks the invoice overdue on a failed payment', async () => {
      pushSel([invoice]); // invoice
      pushSel([]); // no existing payment
      pushSel([{ id: 'acct-1' }]); // account
      pushSel([{ id: 'pay-2' }]); // insert payment returning
      pushSel([]); // update invoice
      const result = await reconcileExternalInvoicePayment({
        organizationId: 'o1',
        invoiceId: 'inv-1',
        amount: '100.00',
        method: 'eft',
        externalReference: 'ext-2',
        status: 'failed',
        failureReason: 'declined',
      });
      expect(result.id).toBe('pay-2');
    });

    it('returns the existing payment when already reconciled', async () => {
      pushSel([invoice]);
      pushSel([{ id: 'pay-existing' }]); // existing payment
      const result = await reconcileExternalInvoicePayment({
        organizationId: 'o1',
        invoiceId: 'inv-1',
        amount: '100.00',
        method: 'eft',
        externalReference: 'ext-1',
      });
      expect(result.id).toBe('pay-existing');
    });

    it('throws when the invoice is missing', async () => {
      pushSel([]);
      await expect(
        reconcileExternalInvoicePayment({ organizationId: 'o1', invoiceId: 'inv-1', amount: '10.00', method: 'eft', externalReference: 'ext-3' }),
      ).rejects.toThrow('not found');
    });
  });

  describe('runBillingLifecycleAutomation', () => {
    it('processes active subscriptions, finalizes drafts and marks overdue', async () => {
      const runAt = new Date('2025-02-15T00:00:00Z');
      pushSel([{ organizationId: 'o1' }]); // active subscriptions
      // loop org o1:
      pushSel([{ id: 'bp-1' }]); // getOrCreateBillingPeriod existing
      // generateInvoice → throws 'already exists' (skipped)
      pushSel([{ id: 'acct-1', netTermsDays: 30 }]); // getBillingAccount
      pushSel([{ id: 'bp-1', isClosed: false, label: 'P', periodStart: runAt, periodEnd: runAt }]); // period
      pushSel([{ id: 'inv-x', invoiceNumber: 'INV-X' }]); // existing invoice → throws already exists
      // draft invoices query
      pushSel([{ id: 'draft-1', metadata: null }]);
      pushSel([]); // update draft
      // overdue invoices query
      pushSel([{ id: 'ov-1', metadata: null }]);
      // update overdue default []
      const result = await runBillingLifecycleAutomation(runAt, 'cron');
      expect(result.organizationsScanned).toBe(1);
      expect(result.invoiceGenerationSkipped).toBe(1);
      expect(result.invoicesFinalized).toBe(1);
      expect(result.invoicesMarkedOverdue).toBe(1);
    });
  });

  describe('getInvoices', () => {
    it('lists invoices for an org', async () => {
      pushSel([{ id: 'inv-1' }]);
      expect(await getInvoices('o1')).toHaveLength(1);
    });
  });

  describe('getInvoiceWithLineItems', () => {
    it('returns an invoice with line items', async () => {
      pushSel([{ id: 'inv-1' }]); // invoice
      pushSel([{ id: 'li-1' }]); // line items
      const result = await getInvoiceWithLineItems('inv-1');
      expect(result?.lineItems).toHaveLength(1);
    });

    it('returns null when not found', async () => {
      pushSel([]);
      expect(await getInvoiceWithLineItems('inv-1')).toBeNull();
    });
  });

  describe('replayInvoiceDeterministically', () => {
    it('recomputes the subtotal and lineage', async () => {
      pushSel([{ id: 'inv-1', subtotal: '100.00', totalAmount: '100.00', metadata: { pricingRuleVersion: 'v1' } }]); // invoice
      pushSel([
        { id: 'li-1', costType: 'base_subscription', amount: '100.00', metadata: { usageAggregateId: 'agg-1', usageEventIds: ['ue-1', 'ue-2'] } },
      ]); // line items
      const result = await replayInvoiceDeterministically('inv-1');
      expect(result?.recomputed.isMatch).toBe(true);
      expect(result?.lineage[0]!.usageEventIds).toEqual(['ue-1', 'ue-2']);
    });

    it('returns null when the invoice is missing', async () => {
      pushSel([]); // getInvoiceWithLineItems invoice missing
      expect(await replayInvoiceDeterministically('inv-1')).toBeNull();
    });
  });

  describe('getPayments', () => {
    it('lists payments with an invoice filter', async () => {
      pushSel([{ id: 'pay-1' }]);
      const result = await getPayments('o1', 'inv-1');
      expect(result).toHaveLength(1);
    });

    it('lists payments without an invoice filter', async () => {
      pushSel([{ id: 'pay-1' }]);
      expect(await getPayments('o1')).toHaveLength(1);
    });
  });

  describe('admin queries', () => {
    it('getAdminSubscriptions returns rows', async () => {
      pushSel([{ id: 's1' }]);
      expect(await getAdminSubscriptions()).toHaveLength(1);
    });

    it('getAdminInvoices returns rows', async () => {
      pushSel([{ id: 'i1' }]);
      expect(await getAdminInvoices()).toHaveLength(1);
    });

    it('getAdminPayments returns rows', async () => {
      pushSel([{ id: 'p1' }]);
      expect(await getAdminPayments()).toHaveLength(1);
    });
  });
});
