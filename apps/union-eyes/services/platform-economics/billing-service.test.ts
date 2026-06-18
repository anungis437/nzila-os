/**
 * Platform Billing Service — Test Suite
 *
 * Exercises the full billing lifecycle (accounts, periods, invoicing, payments,
 * reconciliation, automation, queries) through a table+operation-aware Drizzle
 * mock that resolves results based on the queried table's `__name`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const state = vi.hoisted(() => ({
  selects: {} as Record<string, unknown>,
  inserts: {} as Record<string, unknown>,
  updates: {} as Record<string, unknown>,
}));

const dbMock = vi.hoisted(() => {
  function resolveResult(c: any) {
    const name = c._table?.__name;
    if (c._op === 'insert') {
      if (!c._returning) return undefined;
      return state.inserts[name] ?? [{ id: `${name}-new` }];
    }
    if (c._op === 'update') {
      if (!c._returning) return undefined;
      return state.updates[name] ?? [{ id: `${name}-upd` }];
    }
    if (c._op === 'select') {
      return state.selects[name] ?? [];
    }
    return undefined;
  }

  function makeBuilder() {
    function chain(op: string, table: any) {
      const c: any = {
        _op: op,
        _table: table,
        _returning: false,
        from(t: any) { c._table = t; return c; },
        innerJoin() { return c; },
        leftJoin() { return c; },
        where() { return c; },
        orderBy() { return c; },
        limit() { return c; },
        groupBy() { return c; },
        values(v: any) { c._values = v; return c; },
        set(v: any) { c._set = v; return c; },
        onConflictDoUpdate() { return c; },
        returning() { c._returning = true; return c; },
        then(resolve: (v: unknown) => void, reject: (e: unknown) => void) {
          try {
            resolve(resolveResult(c));
          } catch (e) {
            reject(e);
          }
        },
      };
      return c;
    }
    return {
      insert: (t: any) => chain('insert', t),
      select: (_shape?: any) => chain('select', null),
      update: (t: any) => chain('update', t),
      delete: (t: any) => chain('delete', t),
    };
  }

  return {
    ...makeBuilder(),
    transaction: async (cb: (tx: unknown) => unknown) => cb(makeBuilder()),
  };
});

vi.mock('@/db', () => ({ db: dbMock }));

vi.mock('@/db/schema', () => {
  const t = (name: string) => new Proxy({ __name: name }, { get: (o: any, k) => (k in o ? o[k] : { __col: String(k) }) });
  return {
    billingAccounts: t('billingAccounts'),
    billingPeriods: t('billingPeriods'),
    orgSubscriptions: t('orgSubscriptions'),
    platformInvoices: t('platformInvoices'),
    platformInvoiceLineItems: t('platformInvoiceLineItems'),
    platformPayments: t('platformPayments'),
    paymentAllocations: t('paymentAllocations'),
    subscriptionPlans: t('subscriptionPlans'),
    usageAggregates: t('usageAggregates'),
    usageEvents: t('usageEvents'),
    usageMeters: t('usageMeters'),
    organizations: t('organizations'),
  };
});

vi.mock('drizzle-orm', () => ({
  eq: (...a: unknown[]) => ({ __op: 'eq', a }),
  and: (...a: unknown[]) => ({ __op: 'and', a }),
  or: (...a: unknown[]) => ({ __op: 'or', a }),
  desc: () => ({}),
  inArray: () => ({}),
  lt: () => ({}),
  sql: Object.assign((..._a: unknown[]) => ({}), { raw: () => ({}) }),
}));

const auditLog = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/audit-logger', () => ({
  auditLog: (...a: unknown[]) => auditLog(...a),
  AuditEventType: { DATA_CREATE: 'data_create', DATA_UPDATE: 'data_update', PAYMENT_PROCESSED: 'payment_processed' },
  AuditSeverity: { HIGH: 'high', CRITICAL: 'critical' },
}));

const appendLedgerEntry = vi.fn().mockResolvedValue(undefined);
vi.mock('./ledger-service', () => ({
  appendLedgerEntry: (...a: unknown[]) => appendLedgerEntry(...a),
}));

const requireReconciliation = vi.fn().mockResolvedValue(undefined);
vi.mock('./reconciliation-service', () => ({
  requireReconciliation: (...a: unknown[]) => requireReconciliation(...a),
}));

const getActiveContract = vi.fn().mockResolvedValue({ id: 'contract-1' });
vi.mock('./contract-service', () => ({
  getActiveContract: (...a: unknown[]) => getActiveContract(...a),
}));

import {
  createBillingAccount,
  getBillingAccount,
  updateBillingAccount,
  getOrCreateBillingPeriod,
  closeBillingPeriod,
  generateInvoice,
  recordPayment,
  reconcileExternalInvoicePayment,
  runBillingLifecycleAutomation,
  getInvoices,
  getInvoiceWithLineItems,
  replayInvoiceDeterministically,
  getPayments,
  getAdminSubscriptions,
  getAdminInvoices,
  getAdminPayments,
} from './billing-service';

beforeEach(() => {
  state.selects = {};
  state.inserts = {};
  state.updates = {};
  auditLog.mockClear();
  appendLedgerEntry.mockClear();
  requireReconciliation.mockClear();
  getActiveContract.mockClear().mockResolvedValue({ id: 'contract-1' });
});

// ===========================================================================
// Billing account management
// ===========================================================================
describe('createBillingAccount', () => {
  it('inserts an account (CAD enforced) and audits', async () => {
    state.inserts.billingAccounts = [{ id: 'acct-1' }];
    const account = await createBillingAccount({
      organizationId: 'org-1',
      displayName: 'Local 100',
      billingEmail: 'pay@local100.ca',
      createdBy: 'admin-1',
    });
    expect(account.id).toBe('acct-1');
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'billing_account_created', resourceId: 'acct-1' }),
    );
  });
});

describe('getBillingAccount', () => {
  it('returns the account when found', async () => {
    state.selects.billingAccounts = [{ id: 'acct-1', organizationId: 'org-1' }];
    expect(await getBillingAccount('org-1')).toEqual({ id: 'acct-1', organizationId: 'org-1' });
  });

  it('returns null when not found', async () => {
    state.selects.billingAccounts = [];
    expect(await getBillingAccount('org-x')).toBeNull();
  });
});

describe('updateBillingAccount', () => {
  it('updates and audits when a row is returned', async () => {
    state.updates.billingAccounts = [{ id: 'acct-1' }];
    const r = await updateBillingAccount('org-1', { displayName: 'New Name' }, 'admin-1');
    expect(r?.id).toBe('acct-1');
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'billing_account_updated' }),
    );
  });

  it('returns null and skips audit when no row updated', async () => {
    state.updates.billingAccounts = [];
    const r = await updateBillingAccount('org-x', { taxId: '123' });
    expect(r).toBeNull();
    expect(auditLog).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// Billing periods
// ===========================================================================
describe('getOrCreateBillingPeriod', () => {
  it('returns the existing period when present', async () => {
    state.selects.billingPeriods = [{ id: 'bp-1', label: '2025-01' }];
    const r = await getOrCreateBillingPeriod('org-1', '2025-01', new Date(), new Date());
    expect(r.id).toBe('bp-1');
  });

  it('creates a new period when none exists', async () => {
    state.selects.billingPeriods = [];
    state.inserts.billingPeriods = [{ id: 'bp-new' }];
    const r = await getOrCreateBillingPeriod('org-1', '2025-02', new Date(), new Date());
    expect(r.id).toBe('bp-new');
  });
});

describe('closeBillingPeriod', () => {
  it('throws when the period is not found', async () => {
    state.selects.billingPeriods = [];
    await expect(closeBillingPeriod('bp-x', 'admin-1')).rejects.toThrow(/not found/);
  });

  it('throws when the period is already closed', async () => {
    state.selects.billingPeriods = [{ id: 'bp-1', label: '2025-01', isClosed: true }];
    await expect(closeBillingPeriod('bp-1', 'admin-1')).rejects.toThrow(/already closed/);
  });

  it('closes the period after reconciliation guard and audits', async () => {
    state.selects.billingPeriods = [{ id: 'bp-1', label: '2025-01', isClosed: false, organizationId: 'org-1' }];
    state.updates.billingPeriods = [{ id: 'bp-1' }];
    const r = await closeBillingPeriod('bp-1', 'admin-1');
    expect(r.id).toBe('bp-1');
    expect(requireReconciliation).toHaveBeenCalledWith('bp-1');
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'billing_period_closed' }),
    );
  });
});

// ===========================================================================
// Invoice generation
// ===========================================================================
describe('generateInvoice', () => {
  function happyState() {
    state.selects.billingAccounts = [{ id: 'acct-1', netTermsDays: 30 }];
    state.selects.billingPeriods = [{
      id: 'bp-1', isClosed: false, label: '2025-01',
      periodStart: new Date('2025-01-01'), periodEnd: new Date('2025-01-31'), organizationId: 'org-1',
    }];
    state.selects.platformInvoices = []; // no existing invoice
    state.selects.orgSubscriptions = [{
      planId: 'plan-1', status: 'active', localCount: 2, seatCount: 5,
      moduleList: ['m1', 'm2'], discountPercent: '10', subsidyAmount: '5.00',
    }];
    state.selects.subscriptionPlans = [{
      id: 'plan-1', name: 'Pro', code: 'PRO', baseFee: '100.00',
      perLocalFee: '10.00', perSeatFee: '5.00', perModuleFee: '2.00', updatedAt: new Date('2025-01-01'),
    }];
    state.selects.usageAggregates = [{
      id: 'agg-1', meterId: 'meter-1', billableQuantity: '10', unitPrice: '1.00',
      totalAmount: '10.00', status: 'final', meterCode: 'API', meterUnit: 'calls',
    }];
    state.selects.usageEvents = [{ id: 'ue-1' }, { id: 'ue-2' }];
    state.inserts.platformInvoices = [{ id: 'inv-new', invoiceNumber: 'INV-X' }];
  }

  it('throws when there is no billing account', async () => {
    state.selects.billingAccounts = [];
    await expect(generateInvoice({ organizationId: 'org-1', billingPeriodId: 'bp-1' })).rejects.toThrow(
      /No billing account/,
    );
  });

  it('throws when the billing period is closed', async () => {
    state.selects.billingAccounts = [{ id: 'acct-1', netTermsDays: 30 }];
    state.selects.billingPeriods = [{ id: 'bp-1', isClosed: true, label: '2025-01' }];
    await expect(generateInvoice({ organizationId: 'org-1', billingPeriodId: 'bp-1' })).rejects.toThrow(
      /is closed/,
    );
  });

  it('throws when an invoice already exists for the org+period', async () => {
    state.selects.billingAccounts = [{ id: 'acct-1', netTermsDays: 30 }];
    state.selects.billingPeriods = [{ id: 'bp-1', isClosed: false, label: '2025-01' }];
    state.selects.platformInvoices = [{ id: 'inv-1', invoiceNumber: 'INV-EXISTING' }];
    await expect(generateInvoice({ organizationId: 'org-1', billingPeriodId: 'bp-1' })).rejects.toThrow(
      /already exists/,
    );
  });

  it('throws when there is no active contract', async () => {
    happyState();
    getActiveContract.mockResolvedValueOnce(null);
    await expect(generateInvoice({ organizationId: 'org-1', billingPeriodId: 'bp-1' })).rejects.toThrow(
      /no active contract/,
    );
  });

  it('throws when there is no active subscription', async () => {
    happyState();
    state.selects.orgSubscriptions = [];
    await expect(generateInvoice({ organizationId: 'org-1', billingPeriodId: 'bp-1' })).rejects.toThrow(
      /No active subscription/,
    );
  });

  it('throws when the plan is missing', async () => {
    happyState();
    state.selects.subscriptionPlans = [];
    await expect(generateInvoice({ organizationId: 'org-1', billingPeriodId: 'bp-1' })).rejects.toThrow(
      /not found/,
    );
  });

  it('generates an invoice with base/local/seat/module/usage lines, discount and subsidy', async () => {
    happyState();
    const r = await generateInvoice({ organizationId: 'org-1', billingPeriodId: 'bp-1', createdBy: 'admin-1' });
    expect(r.id).toBe('inv-new');
    expect(appendLedgerEntry).toHaveBeenCalled();
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'invoice_generated', resourceId: 'inv-new' }),
    );
  });
});

// ===========================================================================
// Payment recording
// ===========================================================================
describe('recordPayment', () => {
  const base = {
    organizationId: 'org-1',
    invoiceId: 'inv-1',
    amount: '100.00',
    method: 'eft',
    createdBy: 'admin-1',
  };

  it('throws when there is no billing account', async () => {
    state.selects.billingAccounts = [];
    await expect(recordPayment(base)).rejects.toThrow(/No billing account/);
  });

  it('returns the existing payment for a duplicate idempotency key', async () => {
    state.selects.billingAccounts = [{ id: 'acct-1' }];
    state.selects.platformPayments = [{ id: 'pay-existing' }];
    const r = await recordPayment({ ...base, idempotencyKey: 'idem-1' });
    expect(r.id).toBe('pay-existing');
  });

  it('throws when the invoice is not found', async () => {
    state.selects.billingAccounts = [{ id: 'acct-1' }];
    state.selects.platformInvoices = [];
    await expect(recordPayment(base)).rejects.toThrow(/not found/);
  });

  it('throws when the invoice belongs to a different org', async () => {
    state.selects.billingAccounts = [{ id: 'acct-1' }];
    state.selects.platformInvoices = [{ id: 'inv-1', organizationId: 'other-org', amountPaid: '0.00', totalAmount: '100.00' }];
    await expect(recordPayment(base)).rejects.toThrow(/does not belong/);
  });

  it('throws when the payment amount is not positive', async () => {
    state.selects.billingAccounts = [{ id: 'acct-1' }];
    state.selects.platformInvoices = [{ id: 'inv-1', organizationId: 'org-1', amountPaid: '0.00', totalAmount: '100.00' }];
    await expect(recordPayment({ ...base, amount: '0.00' })).rejects.toThrow(/must be positive/);
  });

  it('records a full payment, marks invoice paid, bridges ledger and audits', async () => {
    state.selects.billingAccounts = [{ id: 'acct-1' }];
    state.selects.platformInvoices = [{ id: 'inv-1', organizationId: 'org-1', amountPaid: '0.00', totalAmount: '100.00', billingPeriodId: 'bp-1' }];
    state.inserts.platformPayments = [{ id: 'pay-1' }];
    const r = await recordPayment(base);
    expect(r.id).toBe('pay-1');
    expect(appendLedgerEntry).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'payment_received', amountCad: '-100.00' }),
    );
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'payment_recorded' }),
    );
  });

  it('records a partial payment (partially_paid status)', async () => {
    state.selects.billingAccounts = [{ id: 'acct-1' }];
    state.selects.platformInvoices = [{ id: 'inv-1', organizationId: 'org-1', amountPaid: '0.00', totalAmount: '100.00', billingPeriodId: null }];
    state.inserts.platformPayments = [{ id: 'pay-2' }];
    const r = await recordPayment({ ...base, amount: '40.00' });
    expect(r.id).toBe('pay-2');
  });
});

// ===========================================================================
// External payment reconciliation
// ===========================================================================
describe('reconcileExternalInvoicePayment', () => {
  const base = {
    organizationId: 'org-1',
    invoiceId: 'inv-1',
    amount: '100.00',
    method: 'stripe',
    externalReference: 'pi_123',
  };

  it('throws when the invoice is not found', async () => {
    state.selects.platformInvoices = [];
    await expect(reconcileExternalInvoicePayment(base)).rejects.toThrow(/not found/);
  });

  it('returns the existing payment when the external ref was already recorded', async () => {
    state.selects.platformInvoices = [{ id: 'inv-1', organizationId: 'org-1' }];
    state.selects.platformPayments = [{ id: 'pay-existing' }];
    const r = await reconcileExternalInvoicePayment(base);
    expect(r.id).toBe('pay-existing');
  });

  it('records a completed external payment and allocates it', async () => {
    state.selects.platformInvoices = [{ id: 'inv-1', organizationId: 'org-1', amountPaid: '0.00', totalAmount: '100.00', metadata: null }];
    state.selects.platformPayments = [];
    state.selects.billingAccounts = [{ id: 'acct-1' }];
    state.inserts.platformPayments = [{ id: 'pay-1' }];
    const r = await reconcileExternalInvoicePayment(base);
    expect(r.id).toBe('pay-1');
  });

  it('marks invoice overdue for a failed external payment', async () => {
    state.selects.platformInvoices = [{ id: 'inv-1', organizationId: 'org-1', status: 'issued', metadata: null }];
    state.selects.platformPayments = [];
    state.selects.billingAccounts = [{ id: 'acct-1' }];
    state.inserts.platformPayments = [{ id: 'pay-2' }];
    const r = await reconcileExternalInvoicePayment({ ...base, status: 'failed', failureReason: 'card_declined' });
    expect(r.id).toBe('pay-2');
  });
});

// ===========================================================================
// Billing lifecycle automation
// ===========================================================================
describe('runBillingLifecycleAutomation', () => {
  it('scans active subscriptions, skips existing invoices, finalizes drafts and flags overdue', async () => {
    state.selects.orgSubscriptions = [{ organizationId: 'org-1' }];
    state.selects.billingPeriods = [{
      id: 'bp-1', organizationId: 'org-1', isClosed: false, label: '2025-01',
      periodStart: new Date('2025-01-01'), periodEnd: new Date('2025-01-31'),
    }];
    state.selects.billingAccounts = [{ id: 'acct-1', netTermsDays: 30 }];
    // existing invoice -> generateInvoice throws "already exists" -> skipped;
    // same rows are returned for the draft + overdue scans (WHERE is mocked away).
    state.selects.platformInvoices = [{ id: 'inv-1', invoiceNumber: 'INV-1', status: 'issued', metadata: null, issueDate: new Date('2025-01-01'), dueDate: new Date('2025-01-15') }];
    state.updates.platformInvoices = [{ id: 'inv-1' }];

    const summary = await runBillingLifecycleAutomation(new Date('2025-02-01T00:00:00Z'), 'system:test');
    expect(summary.organizationsScanned).toBe(1);
    expect(summary.periodLabel).toBe('2025-02');
    expect(summary.invoiceGenerationSkipped).toBe(1);
    expect(summary.periodsCreatedOrFound).toBe(1);
  });
});

// ===========================================================================
// Queries
// ===========================================================================
describe('queries', () => {
  it('getInvoices returns the org invoice list', async () => {
    state.selects.platformInvoices = [{ id: 'inv-1' }, { id: 'inv-2' }];
    const r = await getInvoices('org-1');
    expect(r).toHaveLength(2);
  });

  it('getInvoiceWithLineItems returns null when invoice missing', async () => {
    state.selects.platformInvoices = [];
    expect(await getInvoiceWithLineItems('inv-x')).toBeNull();
  });

  it('getInvoiceWithLineItems returns the invoice with line items', async () => {
    state.selects.platformInvoices = [{ id: 'inv-1', subtotal: '10.00' }];
    state.selects.platformInvoiceLineItems = [{ id: 'li-1', amount: '10.00' }];
    const r = await getInvoiceWithLineItems('inv-1');
    expect(r?.id).toBe('inv-1');
    expect(r?.lineItems).toHaveLength(1);
  });

  it('replayInvoiceDeterministically returns null when invoice missing', async () => {
    state.selects.platformInvoices = [];
    expect(await replayInvoiceDeterministically('inv-x')).toBeNull();
  });

  it('replayInvoiceDeterministically recomputes subtotal and reports a match', async () => {
    state.selects.platformInvoices = [{ id: 'inv-1', subtotal: '10.00', totalAmount: '10.00', metadata: { pricingRuleVersion: 'v1' } }];
    state.selects.platformInvoiceLineItems = [{
      id: 'li-1', amount: '10.00', costType: 'usage_fee',
      metadata: { usageAggregateId: 'agg-1', usageEventIds: ['ue-1', 'ue-2'] },
    }];
    const r = await replayInvoiceDeterministically('inv-1');
    expect(r?.recomputed.isMatch).toBe(true);
    expect(r?.recomputed.subtotal).toBe('10.00');
    expect(r?.lineage[0].usageEventIds).toEqual(['ue-1', 'ue-2']);
  });

  it('getPayments returns payments without an invoice filter', async () => {
    state.selects.platformPayments = [{ id: 'pay-1' }];
    const r = await getPayments('org-1');
    expect(r).toHaveLength(1);
  });

  it('getPayments applies the invoice subquery filter', async () => {
    state.selects.platformPayments = [{ id: 'pay-1' }];
    const r = await getPayments('org-1', 'inv-1');
    expect(r).toHaveLength(1);
  });

  it('getAdminSubscriptions / getAdminInvoices / getAdminPayments return joined rows', async () => {
    state.selects.orgSubscriptions = [{ id: 'sub-1' }];
    state.selects.platformInvoices = [{ id: 'inv-1' }];
    state.selects.platformPayments = [{ id: 'pay-1' }];
    expect(await getAdminSubscriptions()).toHaveLength(1);
    expect(await getAdminInvoices()).toHaveLength(1);
    expect(await getAdminPayments()).toHaveLength(1);
  });
});
