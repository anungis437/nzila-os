/**
 * Transaction Fee Engine — Test Suite
 *
 * Drives every exported function plus the cents-safe decimal helpers through
 * a table+operation-aware Drizzle mock. The mock resolves results based on the
 * queried table's `__name` and the builder operation (select/insert/update),
 * so a single state object configures the whole flow per test.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mutable state — configured per test
// ---------------------------------------------------------------------------
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
        where() { return c; },
        orderBy() { return c; },
        limit() { return c; },
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

vi.mock('@/db/schema', () => ({
  transactionFeeRules: { __name: 'feeRules' },
  transactionFeeEvents: { __name: 'feeEvents' },
  feeSettlementBatches: { __name: 'feeBatches' },
  feeSettlementLines: { __name: 'feeLines' },
  feeAdjustments: { __name: 'feeAdjustments' },
}));

vi.mock('drizzle-orm', () => ({
  eq: (...a: unknown[]) => ({ __op: 'eq', a }),
  and: (...a: unknown[]) => ({ __op: 'and', a }),
  or: (...a: unknown[]) => ({ __op: 'or', a }),
  lte: () => ({}),
  gte: () => ({}),
  isNull: () => ({}),
  desc: () => ({}),
  inArray: () => ({}),
}));

const auditLog = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/audit-logger', () => ({
  auditLog: (...a: unknown[]) => auditLog(...a),
  AuditEventType: { DATA_CREATE: 'data_create', DATA_UPDATE: 'data_update' },
  AuditSeverity: { HIGH: 'high' },
}));

const appendLedgerEntry = vi.fn().mockResolvedValue(undefined);
vi.mock('./ledger-service', () => ({
  appendLedgerEntry: (...a: unknown[]) => appendLedgerEntry(...a),
}));

vi.mock('uuid', () => ({ v4: () => 'abcdef0123456789' }));

import {
  createFeeRule,
  findApplicableRule,
  evaluateFee,
  captureTransactionFee,
  reverseTransactionFee,
  createSettlementBatch,
  closeSettlementBatch,
  getFeeReport,
} from './transaction-fee-engine';

function rule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rule-1',
    name: 'Default',
    feeModel: 'percentage',
    percentageRate: '0.05',
    flatFeeCad: '1.00',
    minimumFeeCad: null,
    maximumFeeCad: null,
    organizationId: 'org-1',
    contractId: null,
    moduleKey: null,
    priority: 0,
    status: 'active',
    effectiveFrom: new Date('2025-01-01'),
    effectiveTo: null,
    ...overrides,
  };
}

function feeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-1',
    organizationId: 'org-1',
    grossAmountCad: '100.00',
    feeAmountCad: '5.00',
    netAmountCad: '95.00',
    billingPeriodId: 'bp-1',
    status: 'captured',
    ...overrides,
  };
}

beforeEach(() => {
  state.selects = {};
  state.inserts = {};
  state.updates = {};
  auditLog.mockClear();
  appendLedgerEntry.mockClear();
});

// ===========================================================================
// createFeeRule
// ===========================================================================
describe('createFeeRule', () => {
  it('inserts a rule and emits an audit event', async () => {
    state.inserts.feeRules = [{ id: 'rule-99' }];
    const result = await createFeeRule({
      organizationId: 'org-1',
      name: 'Stripe pass-through',
      feeModel: 'percentage',
      percentageRate: '0.029',
      flowType: 'payment',
      effectiveFrom: new Date('2025-01-01'),
      createdBy: 'admin-1',
    });
    expect(result.id).toBe('rule-99');
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'fee_rule_created', resourceId: 'rule-99' }),
    );
  });

  it('defaults priority to 0 when omitted', async () => {
    state.inserts.feeRules = [{ id: 'rule-2' }];
    await createFeeRule({
      name: 'Global flat',
      feeModel: 'flat',
      flatFeeCad: '2.50',
      flowType: 'remittance',
      effectiveFrom: new Date('2025-01-01'),
    });
    expect(auditLog).toHaveBeenCalledTimes(1);
  });
});

// ===========================================================================
// findApplicableRule
// ===========================================================================
describe('findApplicableRule', () => {
  it('returns most specific match: contract + module', async () => {
    state.selects.feeRules = [
      rule({ id: 'specific', contractId: 'c-1', moduleKey: 'm-1' }),
      rule({ id: 'org-wide', organizationId: 'org-1', contractId: null }),
    ];
    const r = await findApplicableRule('org-1', 'payment', 'm-1', 'c-1');
    expect(r?.id).toBe('specific');
  });

  it('falls back to contract-specific without module', async () => {
    state.selects.feeRules = [rule({ id: 'contract', contractId: 'c-1', moduleKey: null })];
    const r = await findApplicableRule('org-1', 'payment', undefined, 'c-1');
    expect(r?.id).toBe('contract');
  });

  it('falls back to org-specific rule', async () => {
    state.selects.feeRules = [rule({ id: 'orgrule', organizationId: 'org-1', contractId: null })];
    const r = await findApplicableRule('org-1', 'payment');
    expect(r?.id).toBe('orgrule');
  });

  it('falls back to global rule (no org, no contract)', async () => {
    state.selects.feeRules = [rule({ id: 'global', organizationId: null, contractId: null })];
    const r = await findApplicableRule('org-1', 'payment');
    expect(r?.id).toBe('global');
  });

  it('returns null when no rule matches', async () => {
    state.selects.feeRules = [];
    const r = await findApplicableRule('org-1', 'payment');
    expect(r).toBeNull();
  });
});

// ===========================================================================
// evaluateFee (pure math through every fee model)
// ===========================================================================
describe('evaluateFee', () => {
  it('returns null when no rule applies', async () => {
    state.selects.feeRules = [];
    const r = await evaluateFee({ organizationId: 'org-1', flowType: 'payment', grossAmountCad: '100.00' });
    expect(r).toBeNull();
  });

  it('percentage model computes fee and net', async () => {
    state.selects.feeRules = [rule({ feeModel: 'percentage', percentageRate: '0.05' })];
    const r = await evaluateFee({ organizationId: 'org-1', flowType: 'payment', grossAmountCad: '200.00' });
    expect(r?.feeAmountCad).toBe('10.00');
    expect(r?.netAmountCad).toBe('190.00');
    expect(r?.percentageRateApplied).toBe('0.05');
  });

  it('flat model applies the flat fee', async () => {
    state.selects.feeRules = [rule({ feeModel: 'flat', flatFeeCad: '3.50' })];
    const r = await evaluateFee({ organizationId: 'org-1', flowType: 'payment', grossAmountCad: '100.00' });
    expect(r?.feeAmountCad).toBe('3.50');
    expect(r?.flatFeeApplied).toBe('3.50');
  });

  it('hybrid model sums percentage and flat', async () => {
    state.selects.feeRules = [rule({ feeModel: 'hybrid', percentageRate: '0.02', flatFeeCad: '1.00' })];
    const r = await evaluateFee({ organizationId: 'org-1', flowType: 'payment', grossAmountCad: '100.00' });
    expect(r?.feeAmountCad).toBe('3.00');
    expect(r?.percentageRateApplied).toBe('0.02');
    expect(r?.flatFeeApplied).toBe('1.00');
  });

  it('waived model yields zero fee', async () => {
    state.selects.feeRules = [rule({ feeModel: 'waived' })];
    const r = await evaluateFee({ organizationId: 'org-1', flowType: 'payment', grossAmountCad: '100.00' });
    expect(r?.feeAmountCad).toBe('0.00');
    expect(r?.netAmountCad).toBe('100.00');
  });

  it('subsidized model yields zero fee', async () => {
    state.selects.feeRules = [rule({ feeModel: 'subsidized' })];
    const r = await evaluateFee({ organizationId: 'org-1', flowType: 'payment', grossAmountCad: '50.00' });
    expect(r?.feeAmountCad).toBe('0.00');
  });

  it('applies minimum fee floor', async () => {
    state.selects.feeRules = [
      rule({ feeModel: 'percentage', percentageRate: '0.01', minimumFeeCad: '5.00' }),
    ];
    const r = await evaluateFee({ organizationId: 'org-1', flowType: 'payment', grossAmountCad: '100.00' });
    expect(r?.feeAmountCad).toBe('5.00'); // 1.00 computed -> floored to 5.00
  });

  it('applies maximum fee cap', async () => {
    state.selects.feeRules = [
      rule({ feeModel: 'percentage', percentageRate: '0.50', maximumFeeCad: '10.00' }),
    ];
    const r = await evaluateFee({ organizationId: 'org-1', flowType: 'payment', grossAmountCad: '100.00' });
    expect(r?.feeAmountCad).toBe('10.00'); // 50.00 computed -> capped at 10.00
  });

  it('handles non-numeric gross amount (parseDecimal NaN branch)', async () => {
    state.selects.feeRules = [rule({ feeModel: 'flat', flatFeeCad: '2.00' })];
    const r = await evaluateFee({ organizationId: 'org-1', flowType: 'payment', grossAmountCad: 'not-a-number' });
    expect(r?.grossAmountCad).toBe('0.00');
  });
});

// ===========================================================================
// captureTransactionFee (idempotent)
// ===========================================================================
describe('captureTransactionFee', () => {
  const base = {
    organizationId: 'org-1',
    ruleId: 'rule-1',
    idempotencyKey: 'idem-1',
    sourceTransactionId: 'txn-1',
    sourceTransactionType: 'payment',
    grossAmountCad: '100.00',
    feeAmountCad: '5.00',
    netAmountCad: '95.00',
    feeModel: 'percentage' as const,
    billingPeriodId: 'bp-1',
  };

  it('returns existing event when idempotency key already captured', async () => {
    state.selects.feeEvents = [feeEvent({ id: 'existing-evt' })];
    const r = await captureTransactionFee(base);
    expect(r.id).toBe('existing-evt');
    expect(appendLedgerEntry).not.toHaveBeenCalled();
  });

  it('inserts a new fee event, bridges ledger, and audits', async () => {
    state.selects.feeEvents = []; // no existing
    state.inserts.feeEvents = [{ id: 'evt-new' }];
    const r = await captureTransactionFee(base);
    expect(r.id).toBe('evt-new');
    expect(appendLedgerEntry).toHaveBeenCalledWith(
      expect.objectContaining({ costType: 'transaction_fee', eventType: 'fee_captured' }),
    );
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'fee_captured', resourceId: 'evt-new' }),
    );
  });
});

// ===========================================================================
// reverseTransactionFee
// ===========================================================================
describe('reverseTransactionFee', () => {
  it('throws when the fee event is not found or already reversed', async () => {
    state.selects.feeEvents = [];
    await expect(reverseTransactionFee('evt-x', 'refund-1', 'duplicate')).rejects.toThrow(
      /not found or already reversed/,
    );
  });

  it('fully reverses a captured fee and writes contra ledger entry', async () => {
    state.selects.feeEvents = [feeEvent({ feeAmountCad: '5.00', grossAmountCad: '100.00' })];
    state.updates.feeEvents = [feeEvent({ status: 'reversed' })];
    state.inserts.feeAdjustments = [{ id: 'adj-1', adjustmentType: 'reversal' }];
    const r = await reverseTransactionFee('evt-1', 'refund-1', 'customer refund', 'approver-1');
    expect(r.adjustment.id).toBe('adj-1');
    expect(appendLedgerEntry).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'reversal', amountCad: '-5.00' }),
    );
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'fee_reversed', metadata: expect.objectContaining({ isPartial: false }) }),
    );
  });

  it('proportionally reverses a partial refund', async () => {
    state.selects.feeEvents = [feeEvent({ feeAmountCad: '10.00', grossAmountCad: '100.00' })];
    state.updates.feeEvents = [feeEvent({ status: 'captured' })];
    state.inserts.feeAdjustments = [{ id: 'adj-2', adjustmentType: 'partial_reversal' }];
    await reverseTransactionFee('evt-1', 'refund-2', 'partial refund', 'approver-1', '50.00');
    // 50/100 * 10.00 = 5.00 reversal
    expect(appendLedgerEntry).toHaveBeenCalledWith(
      expect.objectContaining({ amountCad: '-5.00', metadata: expect.objectContaining({ isPartial: true }) }),
    );
  });

  it('handles divide-by-zero gross via divideDecimal guard', async () => {
    state.selects.feeEvents = [feeEvent({ feeAmountCad: '10.00', grossAmountCad: '0.00' })];
    state.updates.feeEvents = [feeEvent()];
    state.inserts.feeAdjustments = [{ id: 'adj-3' }];
    await reverseTransactionFee('evt-1', 'refund-3', 'edge', 'approver-1', '50.00');
    // ratio -> '0.00', reversal 10.00 * 0 = 0.00
    expect(appendLedgerEntry).toHaveBeenCalledWith(
      expect.objectContaining({ amountCad: '-0.00' }),
    );
  });
});

// ===========================================================================
// createSettlementBatch
// ===========================================================================
describe('createSettlementBatch', () => {
  it('throws when there are no un-settled events', async () => {
    state.selects.feeEvents = [];
    await expect(
      createSettlementBatch(new Date('2025-01-01'), new Date('2025-01-31')),
    ).rejects.toThrow(/No un-settled fee events/);
  });

  it('aggregates events, creates a batch, links events, writes lines', async () => {
    state.selects.feeEvents = [
      feeEvent({ id: 'e1', grossAmountCad: '100.00', feeAmountCad: '5.00', netAmountCad: '95.00' }),
      feeEvent({ id: 'e2', grossAmountCad: '200.00', feeAmountCad: '8.00', netAmountCad: '192.00' }),
    ];
    state.inserts.feeBatches = [{ id: 'batch-1', batchNumber: 'STL-X', eventCount: 2 }];
    const batch = await createSettlementBatch(new Date('2025-01-01'), new Date('2025-01-31'), 'admin-1');
    expect(batch.id).toBe('batch-1');
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'settlement_batch_created',
        metadata: expect.objectContaining({ totalFeesCad: '13.00', eventCount: 2 }),
      }),
    );
  });
});

// ===========================================================================
// closeSettlementBatch
// ===========================================================================
describe('closeSettlementBatch', () => {
  it('throws when batch is not open or missing', async () => {
    state.updates.feeBatches = [];
    await expect(closeSettlementBatch('batch-x', 'admin-1')).rejects.toThrow(
      /not found or not open/,
    );
  });

  it('closes batch, settles events, and bridges ledger', async () => {
    state.updates.feeBatches = [
      { id: 'batch-1', batchNumber: 'STL-1', eventCount: 3, totalFeesCad: '20.00', totalGrossCad: '400.00', totalNetCad: '380.00' },
    ];
    const r = await closeSettlementBatch('batch-1', 'admin-1');
    expect(r.id).toBe('batch-1');
    expect(appendLedgerEntry).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'settlement_closed', amountCad: '20.00', organizationId: 'platform' }),
    );
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'settlement_batch_closed' }),
    );
  });
});

// ===========================================================================
// getFeeReport
// ===========================================================================
describe('getFeeReport', () => {
  it('summarizes gross/fee/net totals and groups by org', async () => {
    state.selects.feeEvents = [
      feeEvent({ organizationId: 'org-a', grossAmountCad: '100.00', feeAmountCad: '5.00', netAmountCad: '95.00' }),
      feeEvent({ organizationId: 'org-a', grossAmountCad: '50.00', feeAmountCad: '2.50', netAmountCad: '47.50' }),
      feeEvent({ organizationId: 'org-b', grossAmountCad: '200.00', feeAmountCad: '10.00', netAmountCad: '190.00' }),
    ];
    const report = await getFeeReport(new Date('2025-01-01'), new Date('2025-12-31'));
    expect(report.eventCount).toBe(3);
    expect(report.totalGrossCad).toBe('350.00');
    expect(report.totalFeesCad).toBe('17.50');
    expect(report.totalNetCad).toBe('332.50');
    expect(report.byOrg).toHaveLength(2);
    const orgA = report.byOrg.find((o) => o.organizationId === 'org-a');
    expect(orgA?.count).toBe(2);
    expect(orgA?.feesCad).toBe('7.50');
  });

  it('filters by organizationId when provided', async () => {
    state.selects.feeEvents = [
      feeEvent({ organizationId: 'org-a', grossAmountCad: '100.00', feeAmountCad: '5.00', netAmountCad: '95.00' }),
    ];
    const report = await getFeeReport(new Date('2025-01-01'), new Date('2025-12-31'), 'org-a');
    expect(report.eventCount).toBe(1);
    expect(report.byOrg[0].organizationId).toBe('org-a');
  });

  it('returns zeroed summary when there are no events', async () => {
    state.selects.feeEvents = [];
    const report = await getFeeReport(new Date('2025-01-01'), new Date('2025-12-31'));
    expect(report.eventCount).toBe(0);
    expect(report.totalFeesCad).toBe('0.00');
    expect(report.byOrg).toEqual([]);
  });
});
