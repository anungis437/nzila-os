import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  type Write = { table: string; values: Record<string, unknown>; via: 'db' | 'tx' };
  // What the service read and what it kept. A write on the shared handle is kept at once; a write in a transaction is kept only when the
  // transaction's callback returns, as the database keeps it only when the transaction commits.
  const reads: string[] = [];
  const committed: Write[] = [];
  const transactions: unknown[] = [];
  const tableOf = (table: unknown) => (table as { __table?: string } | undefined)?.__table ?? 'unknown';
  const makeChain = (hooks: { from?: (table: unknown) => void; values?: (values: unknown) => void } = {}) => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'from', 'where', 'limit', 'offset', 'orderBy', 'innerJoin', 'leftJoin', 'insert', 'update', 'set', 'values', 'returning', 'delete']) {
      chain[m] = () => chain;
    }
    chain.from = (table: unknown) => {
      hooks.from?.(table);
      return chain;
    };
    chain.values = (values: unknown) => {
      hooks.values?.(values);
      return chain;
    };
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const v = queue.length ? queue.shift() : [];
      return (v instanceof Error ? Promise.reject(v) : Promise.resolve(v)).then(res, rej);
    };
    return chain;
  };
  const makeHandle = (via: Write['via'], keep: (write: Write) => void) => ({
    select: () => makeChain({ from: (table) => reads.push(tableOf(table)) }),
    insert: (table: unknown) => makeChain({ values: (values) => keep({ table: tableOf(table), values: values as Record<string, unknown>, via }) }),
    update: () => makeChain(),
    delete: () => makeChain(),
  });
  const db = {
    ...makeHandle('db', (write) => committed.push(write)),
    transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
      const written: Write[] = [];
      const tx = makeHandle('tx', (write) => written.push(write));
      transactions.push(tx);
      const result = await fn(tx);
      committed.push(...written);
      return result;
    },
  };
  const auditLog = vi.fn();
  const persistAtomicAudit = vi.fn(async (_tx: unknown, _entry: Record<string, unknown>) => undefined);
  const appendLedgerEntry = vi.fn(async (_entry: Record<string, unknown>, _tx?: unknown) => 'ledger-1');
  const requireReconciliation = vi.fn(async () => ({ id: 'run-1' }));
  const getActiveContract = vi.fn();
  return { queue, reads, committed, transactions, db, auditLog, persistAtomicAudit, appendLedgerEntry, requireReconciliation, getActiveContract };
});

vi.mock('@/db', () => ({ db: h.db }));
vi.mock('@/db/schema', () => {
  // One named object per table, so a statement can be attributed to the table it names.
  const tables = new Map<string, unknown>();
  const table = (name: string) => {
    if (!tables.has(name)) {
      tables.set(name, new Proxy({ __table: name } as Record<string | symbol, unknown>, { get: (o, c) => (c in o ? o[c] : { __col: c }) }));
    }
    return tables.get(name);
  };
  return new Proxy({}, { has: () => true, get: (_t, n) => (n === '__esModule' ? false : table(String(n))) });
});
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
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: h.persistAtomicAudit }));
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
  h.reads.length = 0;
  h.committed.length = 0;
  h.transactions.length = 0;
  h.auditLog.mockReset();
  h.persistAtomicAudit.mockClear();
  h.appendLedgerEntry.mockClear();
  h.requireReconciliation.mockClear();
  h.getActiveContract.mockReset();
});

describe('platform-economics/billing-service', () => {
  describe('replayInvoiceDeterministically integrity', () => {
    it.each([
      ['negative line amount', '-1.00', '0.00'],
      ['unsafe line amount', '90071992547410.00', '0.00'],
      ['aggregate overflow', '1.00', '90071992547409.00'],
    ])('rejects %s rather than returning a misleading replay', async (_name, amount, subtotal) => {
      pushSel([{ id: 'inv-1', organizationId: 'o1', subtotal, totalAmount: subtotal }]);
      pushSel([{ id: 'line-1', amount, costType: 'base', metadata: {} }]);
      await expect(replayInvoiceDeterministically('inv-1', 'o1'))
        .rejects.toThrow('Invoice replay contains invalid or overflowing line-item amounts');
    });
  });

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
      pushSel([{ id: 'bp-1', organizationId: 'o1', isClosed: true, label: 'P1' }]);
      await expect(closeBillingPeriod('bp-1', 'user-1')).rejects.toThrow('already closed');
    });
  });

  describe('generateInvoice', () => {
    const account = { id: 'acct-1', netTermsDays: 30 };
    const period = { id: 'bp-1', organizationId: 'o1', isClosed: false, label: 'P1', periodStart: new Date('2025-01-01'), periodEnd: new Date('2025-01-31') };
    const subscription = {
      organizationId: 'o1',
      status: 'active',
      planId: 'plan-1',
      localCount: 2,
      seatCount: 3,
      moduleList: ['m1'],
      discountPercent: '10.00', // decimal(5,2): 10%
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

    it.each([
      ['non-array modules', { ...subscription, moduleList: 'm1' }],
      ['duplicate modules', { ...subscription, moduleList: ['m1', 'm1'] }],
      ['empty module id', { ...subscription, moduleList: [''] }],
      ['non-string module id', { ...subscription, moduleList: [7] }],
    ])('refuses %s before financial writes', async (_name, badSubscription) => {
      pushSel([account]);
      pushSel([period]);
      pushSel([]);
      h.getActiveContract.mockResolvedValueOnce({ id: 'ctr-1' });
      pushSel([badSubscription]);
      pushSel([plan]);
      await expect(generateInvoice({ organizationId: 'o1', billingPeriodId: 'bp-1' }))
        .rejects.toThrow('Invoice subscription modules are invalid');
      expect(h.committed).toHaveLength(0);
      expect(h.persistAtomicAudit).not.toHaveBeenCalled();
    });

    it.each([
      ['negative local count', { ...subscription, localCount: -1 }, plan, /Invoice local count is invalid/],
      ['fractional local count', { ...subscription, localCount: 1.5 }, plan, /Invoice local count is invalid/],
      ['negative seat count', { ...subscription, seatCount: -1 }, plan, /Invoice seat count is invalid/],
      ['unsafe seat count', { ...subscription, seatCount: Number.MAX_SAFE_INTEGER + 1 }, plan, /Invoice seat count is invalid/],
      ['discount over 100 percent', { ...subscription, discountPercent: '101.00' }, plan, /Invoice discount exceeds 100 percent/],
      ['subsidy exceeding charges', { ...subscription, discountPercent: '0.00', subsidyAmount: '156.00' }, plan, /Invoice subsidy exceeds remaining charges/],
      ['subsidy exceeding discounted charges', { ...subscription, discountPercent: '100.00', subsidyAmount: '0.01' }, plan, /Invoice subsidy exceeds remaining charges/],
      ['aggregate subtotal overflow', { ...subscription, discountPercent: '0.00' }, { ...plan, baseFee: '90071992547409.00', perLocalFee: '10.00' }, /Invoice subtotal exceeds safe CAD limits/],
    ])('refuses %s before financial writes', async (_name, badSubscription, badPlan, error) => {
      pushSel([account]);
      pushSel([period]);
      pushSel([]);
      h.getActiveContract.mockResolvedValueOnce({ id: 'ctr-1' });
      pushSel([badSubscription]);
      pushSel([badPlan]);
      await expect(generateInvoice({ organizationId: 'o1', billingPeriodId: 'bp-1' })).rejects.toThrow(error);
      expect(h.committed).toHaveLength(0);
      expect(h.persistAtomicAudit).not.toHaveBeenCalled();
    });

    it('generates the subscription lines, discount and subsidy, bills no usage, and writes the invoice, its lines, its ledger entries and its audit record in one transaction', async () => {
      pushSel([account]); // getBillingAccount
      pushSel([period]); // billing period
      pushSel([]); // no existing invoice
      h.getActiveContract.mockResolvedValueOnce({ id: 'ctr-1' });
      pushSel([subscription]); // subscription
      pushSel([plan]); // plan
      pushSel([{ id: 'inv-1' }]); // tx insert invoice returning
      // line item inserts default to []
      const result = await generateInvoice({ organizationId: 'o1', billingPeriodId: 'bp-1', createdBy: 'user-1' });
      expect(result.id).toBe('inv-1');

      // Usage is not billed (metering is not implemented): no metering table is read, and every fixture was consumed by a read the service makes.
      expect(h.reads).toEqual(['billingAccounts', 'billingPeriods', 'platformInvoices', 'orgSubscriptions', 'subscriptionPlans']);
      expect(h.queue).toHaveLength(0);

      // 100.00 + 2 × 10.00 + 3 × 5.00 + 1 × 20.00 = 155.00, less a 10% discount (15.50) and a 5.00 subsidy: 134.50.
      const lines = [
        ['base_subscription', '100.00'],
        ['local_fee', '20.00'],
        ['seat_fee', '15.00'],
        ['module_fee', '20.00'],
        ['credit', '-15.50'],
        ['subsidy', '-5.00'],
      ];
      const [invoice] = h.committed.filter((w) => w.table === 'platformInvoices');
      expect(invoice.values).toMatchObject({
        billingAccountId: 'acct-1',
        organizationId: 'o1',
        billingPeriodId: 'bp-1',
        subtotal: '134.50',
        totalAmount: '134.50',
        currency: 'CAD',
        status: 'issued',
        createdBy: 'user-1',
      });
      const lineRows = h.committed.filter((w) => w.table === 'platformInvoiceLineItems');
      expect(lineRows.map((w) => [w.values.costType, w.values.amount])).toEqual(lines);
      expect(lineRows.every((w) => w.values.invoiceId === 'inv-1')).toBe(true);

      // The invoice, its lines, its ledger entries and its audit record share one transaction (DEF-0B3-BILLING-AUDIT-NOT-ATOMIC); nothing is written outside it.
      expect(h.transactions).toHaveLength(1);
      const [tx] = h.transactions;
      expect(h.committed.every((w) => w.via === 'tx')).toBe(true);
      expect(h.appendLedgerEntry.mock.calls.map(([entry]) => [entry.costType, entry.amountCad])).toEqual(lines);
      for (const [entry, handle] of h.appendLedgerEntry.mock.calls) {
        expect(handle).toBe(tx);
        expect(entry).toMatchObject({ organizationId: 'o1', billingPeriodId: 'bp-1', eventType: 'invoice_generated', sourceType: 'invoice', sourceId: 'inv-1' });
      }
      expect(h.persistAtomicAudit).toHaveBeenCalledTimes(1);
      const [auditHandle, audit] = h.persistAtomicAudit.mock.calls[0];
      expect(auditHandle).toBe(tx);
      expect(audit).toMatchObject({
        organizationId: 'o1',
        userId: 'user-1',
        action: 'invoice_generated',
        resourceType: 'platform_invoice',
        resourceId: 'inv-1',
        details: { totalAmount: '134.50', lineItemCount: 6 },
      });
      expect(h.auditLog).not.toHaveBeenCalled();
    });

    it('writes no invoice when its audit record cannot be written', async () => {
      pushSel([account]);
      pushSel([period]);
      pushSel([]);
      h.getActiveContract.mockResolvedValueOnce({ id: 'ctr-1' });
      pushSel([subscription]);
      pushSel([plan]);
      pushSel([{ id: 'inv-1' }]); // tx insert invoice returning
      h.persistAtomicAudit.mockRejectedValueOnce(new Error('audit down'));
      await expect(generateInvoice({ organizationId: 'o1', billingPeriodId: 'bp-1', createdBy: 'user-1' })).rejects.toThrow('audit down');
      // The audit record is written on the invoice's own transaction, so its failure leaves the invoice, its lines and its ledger entries uncommitted.
      expect(h.transactions).toHaveLength(1);
      expect(h.persistAtomicAudit.mock.calls[0][0]).toBe(h.transactions[0]);
      expect(h.appendLedgerEntry).toHaveBeenCalled();
      expect(h.committed).toEqual([]);
    });

    it('throws when there is no billing account', async () => {
      pushSel([]); // getBillingAccount empty
      await expect(generateInvoice({ organizationId: 'o1', billingPeriodId: 'bp-1' })).rejects.toThrow('No billing account');
    });

    it('throws when the period is closed', async () => {
      pushSel([account]);
      pushSel([{ id: 'bp-1', organizationId: 'o1', isClosed: true, label: 'P1' }]);
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

    it('refuses multiple active subscriptions before reading a plan or issuing an invoice', async () => {
      pushSel([account]);
      pushSel([period]);
      pushSel([]); // no existing invoice
      h.getActiveContract.mockResolvedValueOnce({ id: 'ctr-1' });
      pushSel([subscription, { ...subscription, planId: 'plan-2' }]);
      await expect(generateInvoice({ organizationId: 'o1', billingPeriodId: 'bp-1' }))
        .rejects.toThrow('multiple active subscriptions');
      expect(h.appendLedgerEntry).not.toHaveBeenCalled();
      expect(h.persistAtomicAudit).not.toHaveBeenCalled();
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

    it('fails closed on an unverified idempotency replay', async () => {
      pushSel([account]); // getBillingAccount
      pushSel([{ id: 'pay-existing', organizationId: 'o1', amount: '10.00' }]); // existing by idempotency
      await expect(recordPayment({ organizationId: 'o1', invoiceId: 'inv-1', amount: '10.00', method: 'card', idempotencyKey: 'idem-1' })).rejects.toThrow('requires verified invoice allocation');
    });

    it('fails closed on a new keyed payment until database uniqueness is enforced', async () => {
      pushSel([account]);
      pushSel([]);
      await expect(recordPayment({ organizationId: 'o1', invoiceId: 'inv-1', amount: '10.00', method: 'card', idempotencyKey: 'new-key' })).rejects.toThrow('Keyed payment recording unavailable');
      expect(h.appendLedgerEntry).not.toHaveBeenCalled();
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

    it('fails closed when external payment allocation is unverified', async () => {
      pushSel([invoice]);
      pushSel([{ id: 'pay-existing', organizationId: 'o1', amount: '100.00' }]); // existing payment
      await expect(reconcileExternalInvoicePayment({
        organizationId: 'o1',
        invoiceId: 'inv-1',
        amount: '100.00',
        method: 'eft',
        externalReference: 'ext-1',
      })).rejects.toThrow('requires verified invoice allocation');
    });

    it.each([
      ['negative paid balance', '-1.00', '100.00'],
      ['negative invoice total', '0.00', '-1.00'],
      ['paid amount greater than total', '101.00', '100.00'],
      ['unsafe invoice total', '0.00', '90071992547410.00'],
    ])('rejects %s before external financial writes', async (_label, amountPaid, totalAmount) => {
      pushSel([{ ...invoice, amountPaid, totalAmount }]);
      pushSel([]); // external reference lookup
      pushSel([{ id: 'acct-1' }]); // account
      await expect(reconcileExternalInvoicePayment({
        organizationId: 'o1',
        invoiceId: 'inv-1',
        amount: '1.00',
        method: 'eft',
        externalReference: 'ext-corrupt',
      })).rejects.toThrow('External settlement invoice balance is invalid');
      expect(h.appendLedgerEntry).not.toHaveBeenCalled();
      expect(h.persistAtomicAudit).not.toHaveBeenCalled();
      expect(h.committed).toEqual([]);
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
      pushSel([{ id: 'bp-1', organizationId: 'o1', isClosed: false, label: 'P', periodStart: runAt, periodEnd: runAt }]); // period
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
      pushSel([{ id: 'inv-1', organizationId: 'o1' }]); // invoice
      pushSel([{ id: 'li-1' }]); // line items
      const result = await getInvoiceWithLineItems('inv-1', 'o1');
      expect(result?.lineItems).toHaveLength(1);
    });

    it('returns null when not found', async () => {
      pushSel([]);
      expect(await getInvoiceWithLineItems('inv-1', 'o1')).toBeNull();
    });
  });

  describe('replayInvoiceDeterministically', () => {
    it('replays valid discount and subsidy lines without rejecting negative adjustments', async () => {
      pushSel([{ id: 'inv-1', organizationId: 'o1', subtotal: '75.00', totalAmount: '75.00', metadata: null }]);
      pushSel([
        { id: 'base', costType: 'base_subscription', amount: '100.00', metadata: {} },
        { id: 'discount', costType: 'credit', amount: '-20.00', metadata: {} },
        { id: 'subsidy', costType: 'subsidy', amount: '-5.00', metadata: {} },
      ]);
      const result = await replayInvoiceDeterministically('inv-1', 'o1');
      expect(result?.recomputed).toMatchObject({ subtotal: '75.00', isMatch: true });
    });

    it.each([
      ['negative charge', [{ costType: 'base_subscription', amount: '-1.00' }]],
      ['positive credit', [{ costType: 'credit', amount: '1.00' }]],
      ['fractional cent', [{ costType: 'base_subscription', amount: '1.001' }]],
      ['non-numeric amount', [{ costType: 'base_subscription', amount: 'NaN' }]],
      ['adjustments exceeding charges', [
        { costType: 'base_subscription', amount: '1.00' },
        { costType: 'subsidy', amount: '-2.00' },
      ]],
    ])('refuses %s in invoice replay', async (_name, lines) => {
      pushSel([{ id: 'inv-1', organizationId: 'o1', subtotal: '0.00', totalAmount: '0.00', metadata: null }]);
      pushSel(lines.map((line, i) => ({ id: String(i), metadata: {}, ...line })));
      await expect(replayInvoiceDeterministically('inv-1', 'o1'))
        .rejects.toThrow('Invoice replay contains invalid or overflowing line-item amounts');
    });

    it('refuses a foreign invoice before reading its line items', async () => {
      pushSel([{ id: 'inv-1', organizationId: 'foreign-org' }]);
      expect(await replayInvoiceDeterministically('inv-1', 'o1')).toBeNull();
    });

    it('recomputes the subtotal and lineage', async () => {
      pushSel([{ id: 'inv-1', organizationId: 'o1', subtotal: '100.00', totalAmount: '100.00', metadata: { pricingRuleVersion: 'v1' } }]); // invoice
      pushSel([
        { id: 'li-1', costType: 'base_subscription', amount: '100.00', metadata: { usageAggregateId: 'agg-1', usageEventIds: ['ue-1', 'ue-2'] } },
      ]); // line items
      const result = await replayInvoiceDeterministically('inv-1', 'o1');
      expect(result?.recomputed.isMatch).toBe(true);
      expect(result?.lineage[0]!.usageEventIds).toEqual(['ue-1', 'ue-2']);
    });

    it('returns null when the invoice is missing', async () => {
      pushSel([]); // getInvoiceWithLineItems invoice missing
      expect(await replayInvoiceDeterministically('inv-1', 'o1')).toBeNull();
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
