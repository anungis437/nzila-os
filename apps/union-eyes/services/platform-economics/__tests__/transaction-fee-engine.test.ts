import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  // The values of every UPDATE ... SET and the rows INSERTed into fee_adjustments, in the order the engine wrote them.
  const updates: Array<Record<string, unknown>> = [];
  const adjustmentRows: Array<Record<string, unknown>> = [];
  // What the database reports for the INSERT into fee_adjustments, which has no RETURNING, and how it answers the write-owned helper's
  // normalisation select (assigned below, where the SQL dialect is available).
  const adjustmentInsert = { count: 1 };
  const database = { normalize: (_shape: Record<string, unknown>): Record<string, unknown> => ({}) };
  const isFeeAdjustments = (table: unknown) => (table as Record<symbol, unknown> | undefined)?.[Symbol.for('drizzle:Name')] === 'fee_adjustments';
  const makeChain = (hooks: { answer?: () => unknown; set?: (values: unknown) => void; values?: (values: unknown) => void } = {}) => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'from', 'where', 'limit', 'orderBy', 'insert', 'update', 'set', 'values', 'returning', 'delete']) {
      chain[m] = () => chain;
    }
    chain.set = (values: unknown) => {
      hooks.set?.(values);
      return chain;
    };
    chain.values = (values: unknown) => {
      hooks.values?.(values);
      return chain;
    };
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const v = hooks.answer ? hooks.answer() : queue.length ? queue.shift() : [];
      return (v instanceof Error ? Promise.reject(v) : Promise.resolve(v)).then(res, rej);
    };
    return chain;
  };
  const handle = {
    select: (shape?: Record<string, unknown>) =>
      shape && 'createdAtValue' in shape ? makeChain({ answer: () => [database.normalize(shape)] }) : makeChain(),
    insert: (table: unknown) =>
      isFeeAdjustments(table)
        ? makeChain({
            answer: () => Object.assign([], { count: adjustmentInsert.count }),
            values: (values) => adjustmentRows.push(values as Record<string, unknown>),
          })
        : makeChain(),
    update: () => makeChain({ set: (values) => updates.push(values as Record<string, unknown>) }),
    delete: () => makeChain(),
  };
  const db = {
    ...handle,
    transaction: (fn: (t: typeof handle) => Promise<unknown>) => fn(handle),
  };
  const auditLog = vi.fn();
  const persistAtomicAudit = vi.fn(async (_tx: unknown, _entry: Record<string, unknown>) => undefined);
  const appendLedgerEntry = vi.fn(async (_entry: Record<string, unknown>, _tx?: unknown) => 'ledger-1');
  return { queue, updates, adjustmentRows, adjustmentInsert, database, db, auditLog, persistAtomicAudit, appendLedgerEntry };
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
  lte: vi.fn(() => ({})),
  gte: vi.fn(() => ({})),
  isNull: vi.fn(() => ({})),
  or: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
  inArray: vi.fn(() => ({})),
}));
vi.mock('@/lib/audit-logger', () => ({
  auditLog: h.auditLog,
  AuditEventType: { DATA_CREATE: 'data_create', DATA_UPDATE: 'data_update' },
  AuditSeverity: { HIGH: 'high' },
}));
vi.mock('../ledger-service', () => ({ appendLedgerEntry: h.appendLedgerEntry }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: h.persistAtomicAudit }));
vi.mock('uuid', () => ({ v4: () => '00000000-1111-2222-3333-444444444444' }));

import {
  captureTransactionFee,
  closeSettlementBatch,
  createFeeRule,
  createSettlementBatch,
  evaluateFee,
  findApplicableRule,
  getFeeReport,
  reverseTransactionFee,
} from '../transaction-fee-engine';

const pushSel = (...items: unknown[]) => h.queue.push(...items);

// PostgreSQL answers the helper's normalisation select with one row: each bound parameter (cast to its column's type, which is not modelled)
// and the transaction's timestamp. The row therefore carries exactly what the engine asked to be recorded.
const dialect = new PgDialect();
h.database.normalize = (shape) =>
  Object.fromEntries(
    Object.entries(shape).map(([column, expression]) => {
      const { params } = dialect.sqlToQuery(expression as SQL);
      if (params.length > 0) return [column, params[0]];
      return [column, column === 'createdAtValue' ? '2025-01-15 12:00:00+00' : new Date('2025-01-15T12:00:00Z')];
    }),
  );

beforeEach(() => {
  h.queue.length = 0;
  h.updates.length = 0;
  h.adjustmentRows.length = 0;
  h.adjustmentInsert.count = 1;
  h.auditLog.mockReset();
  h.persistAtomicAudit.mockClear();
  h.appendLedgerEntry.mockClear();
});

describe('platform-economics/transaction-fee-engine', () => {
  describe('createFeeRule', () => {
    it('creates a fee rule and audits', async () => {
      pushSel([{ id: 'rule-1' }]);
      const rule = await createFeeRule({
        organizationId: 'o1',
        name: 'Rule',
        feeModel: 'percentage' as never,
        flowType: 'payment',
        effectiveFrom: new Date('2025-01-01'),
        createdBy: 'user-1',
      });
      expect(rule.id).toBe('rule-1');
      expect(h.auditLog).toHaveBeenCalledTimes(1);
    });
  });

  describe('findApplicableRule', () => {
    it('returns the most specific contract+module match', async () => {
      pushSel([
        { id: 'r1', contractId: 'c1', moduleKey: 'm1', organizationId: 'o1' },
      ]);
      const rule = await findApplicableRule('o1', 'payment', 'm1', 'c1');
      expect(rule?.id).toBe('r1');
    });

    it('falls back through contract, org, and global matches', async () => {
      pushSel([
        { id: 'rc', contractId: 'c1', moduleKey: null, organizationId: null },
        { id: 'ro', contractId: null, moduleKey: null, organizationId: 'o1' },
        { id: 'rg', contractId: null, moduleKey: null, organizationId: null },
      ]);
      const rule = await findApplicableRule('o1', 'payment', undefined, 'c1');
      expect(rule?.id).toBe('rc');
    });

    it('returns null when no rules match', async () => {
      pushSel([]);
      expect(await findApplicableRule('o1', 'payment')).toBeNull();
    });
  });

  describe('evaluateFee', () => {
    it('returns null when no rule applies', async () => {
      pushSel([]); // findApplicableRule
      expect(await evaluateFee({ organizationId: 'o1', flowType: 'payment', grossAmountCad: '100.00' })).toBeNull();
    });

    it('computes a percentage fee', async () => {
      pushSel([{ id: 'r1', organizationId: 'o1', contractId: null, moduleKey: null, feeModel: 'percentage', percentageRate: '0.02', name: 'Pct' }]);
      const result = await evaluateFee({ organizationId: 'o1', flowType: 'payment', grossAmountCad: '100.00' });
      expect(result?.feeAmountCad).toBe('2.00');
      expect(result?.netAmountCad).toBe('98.00');
    });

    it('computes a flat fee', async () => {
      pushSel([{ id: 'r1', organizationId: 'o1', contractId: null, moduleKey: null, feeModel: 'flat', flatFeeCad: '1.50', name: 'Flat' }]);
      const result = await evaluateFee({ organizationId: 'o1', flowType: 'payment', grossAmountCad: '100.00' });
      expect(result?.feeAmountCad).toBe('1.50');
    });

    it('computes a hybrid fee with min/max caps', async () => {
      pushSel([{ id: 'r1', organizationId: 'o1', contractId: null, moduleKey: null, feeModel: 'hybrid', percentageRate: '0.01', flatFeeCad: '0.25', minimumFeeCad: '2.00', maximumFeeCad: '5.00', name: 'Hybrid' }]);
      const result = await evaluateFee({ organizationId: 'o1', flowType: 'payment', grossAmountCad: '100.00' });
      // 1.00 + 0.25 = 1.25, below min 2.00 → 2.00
      expect(result?.feeAmountCad).toBe('2.00');
    });

    it('computes a waived fee', async () => {
      pushSel([{ id: 'r1', organizationId: 'o1', contractId: null, moduleKey: null, feeModel: 'waived', name: 'Waived', maximumFeeCad: '0.50' }]);
      const result = await evaluateFee({ organizationId: 'o1', flowType: 'payment', grossAmountCad: '100.00' });
      expect(result?.feeAmountCad).toBe('0.00');
    });
  });

  describe('captureTransactionFee', () => {
    const baseInput = {
      organizationId: 'o1',
      ruleId: 'r1',
      idempotencyKey: 'idem-1',
      sourceTransactionId: 'txn-1',
      sourceTransactionType: 'payment',
      grossAmountCad: '100.00',
      feeAmountCad: '2.00',
      netAmountCad: '98.00',
      feeModel: 'percentage' as never,
    };

    it('returns the existing event on duplicate idempotency key', async () => {
      pushSel([{ id: 'existing', idempotencyKey: 'idem-1' }]);
      const result = await captureTransactionFee(baseInput);
      expect(result.id).toBe('existing');
      expect(h.appendLedgerEntry).not.toHaveBeenCalled();
    });

    it('captures a new fee event and writes its ledger entry and its audit record in the transaction that wrote the event', async () => {
      pushSel([]); // no existing
      pushSel([{ id: 'evt-1' }]); // insert returning
      const result = await captureTransactionFee(baseInput);
      expect(result.id).toBe('evt-1');
      expect(h.appendLedgerEntry).toHaveBeenCalledTimes(1);
      expect(h.persistAtomicAudit).toHaveBeenCalledTimes(1);
      expect(h.persistAtomicAudit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ organizationId: 'o1', action: 'fee_captured', resourceType: 'transaction_fee_event', resourceId: 'evt-1' }),
      );
      // The ledger entry and the audit record are handed the transaction the event was written in, so none of the three commits alone.
      expect(h.appendLedgerEntry.mock.calls[0][1]).toBeDefined();
      expect(h.appendLedgerEntry.mock.calls[0][1]).toBe(h.persistAtomicAudit.mock.calls[0][0]);
      expect(h.auditLog).not.toHaveBeenCalled();
    });
  });

  describe('reverseTransactionFee', () => {
    it('throws when the event is missing or already reversed', async () => {
      pushSel([]); // select event empty
      await expect(reverseTransactionFee('evt-1', 'refund-1', 'reason')).rejects.toThrow('not found or already reversed');
    });

    it('reverses a full fee', async () => {
      pushSel([{ id: 'evt-1', organizationId: 'o1', grossAmountCad: '100.00', feeAmountCad: '2.00', billingPeriodId: 'bp1' }]); // select
      pushSel([{ id: 'evt-1', status: 'reversed' }]); // update returning
      // The adjustment insert (no RETURNING) answers with the row it wrote and reports exactly one row.
      const result = await reverseTransactionFee('evt-1', 'refund-1', 'reason', 'approver');
      // The whole fee is reversed, as a negative adjustment, and the event is marked reversed.
      expect(result.event.status).toBe('reversed');
      expect(h.updates).toEqual([{ status: 'reversed' }]);
      expect(result.adjustment).toMatchObject({
        feeEventId: 'evt-1',
        organizationId: 'o1',
        adjustmentType: 'reversal',
        amountCad: '-2.00',
        reason: 'reason',
        sourceRefundId: 'refund-1',
        approvedBy: 'approver',
      });
      expect(h.adjustmentRows).toEqual([expect.objectContaining({ id: result.adjustment.id, adjustmentType: 'reversal', amountCad: '-2.00' })]);
      // The contra entry in the ledger carries the same amount, and it and the audit record are written in the transaction that wrote the adjustment.
      expect(h.appendLedgerEntry).toHaveBeenCalledTimes(1);
      expect(h.appendLedgerEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'o1',
          billingPeriodId: 'bp1',
          costType: 'transaction_fee',
          eventType: 'reversal',
          sourceId: 'evt-1',
          unitPriceCad: '-2.00',
          amountCad: '-2.00',
          metadata: expect.objectContaining({ originalFeeAmountCad: '2.00', reversalAmountCad: '2.00', isPartial: false }),
        }),
        expect.anything(),
      );
      expect(h.persistAtomicAudit).toHaveBeenCalledTimes(1);
      expect(h.persistAtomicAudit).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          organizationId: 'o1',
          userId: 'approver',
          action: 'fee_reversed',
          resourceId: 'evt-1',
          details: expect.objectContaining({ reversalAmount: '-2.00', isPartial: false, sourceRefundId: 'refund-1', reason: 'reason' }),
        }),
      );
      expect(h.appendLedgerEntry.mock.calls[0][1]).toBe(h.persistAtomicAudit.mock.calls[0][0]);
      expect(h.auditLog).not.toHaveBeenCalled();
    });

    it('reverses a partial fee proportionally', async () => {
      pushSel([{ id: 'evt-1', organizationId: 'o1', grossAmountCad: '100.00', feeAmountCad: '2.00', billingPeriodId: null }]); // select
      pushSel([{ id: 'evt-1', status: 'captured' }]); // update returning
      const result = await reverseTransactionFee('evt-1', 'refund-1', 'partial', undefined, '50.00');
      // A refund of half the gross reverses half the fee, and the event stays captured for further refunds.
      expect(result.adjustment).toMatchObject({ adjustmentType: 'partial_reversal', amountCad: '-1.00', reason: 'partial', approvedBy: null, approvedAt: null });
      expect(h.updates).toEqual([{ status: 'captured' }]);
      expect(h.adjustmentRows).toEqual([expect.objectContaining({ id: result.adjustment.id, adjustmentType: 'partial_reversal', amountCad: '-1.00' })]);
      expect(h.appendLedgerEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          amountCad: '-1.00',
          metadata: expect.objectContaining({ originalFeeAmountCad: '2.00', reversalAmountCad: '1.00', isPartial: true }),
        }),
        expect.anything(),
      );
    });

    it.each([
      ['25.00', '100.00', '2.00', '-0.50'],
      ['33.33', '100.00', '3.00', '-1.00'],
      ['10.00', '40.00', '1.60', '-0.40'],
    ])('reverses a refund of %s on a %s sale with a %s fee as %s', async (refund, gross, fee, expected) => {
      pushSel([{ id: 'evt-1', organizationId: 'o1', grossAmountCad: gross, feeAmountCad: fee, billingPeriodId: 'bp1' }]);
      pushSel([{ id: 'evt-1', status: 'captured' }]);
      const result = await reverseTransactionFee('evt-1', 'refund-1', 'partial', undefined, refund);
      expect(result.adjustment.amountCad).toBe(expected);
      expect(h.appendLedgerEntry).toHaveBeenCalledWith(expect.objectContaining({ amountCad: expected }), expect.anything());
    });

    it('records no reversal when the adjustment insert does not report exactly one row', async () => {
      h.adjustmentInsert.count = 0;
      pushSel([{ id: 'evt-1', organizationId: 'o1', grossAmountCad: '100.00', feeAmountCad: '2.00', billingPeriodId: 'bp1' }]);
      pushSel([{ id: 'evt-1', status: 'reversed' }]);
      await expect(reverseTransactionFee('evt-1', 'refund-1', 'reason', 'approver')).rejects.toThrow('FEE_ADJUSTMENT_EXACT_INSERT_COUNT_REQUIRED');
      // Nothing follows an adjustment that was not recorded: no contra entry in the ledger and no audit record of a reversal.
      expect(h.appendLedgerEntry).not.toHaveBeenCalled();
      expect(h.persistAtomicAudit).not.toHaveBeenCalled();
    });
  });

  describe('createSettlementBatch', () => {
    it('throws when there are no un-settled events', async () => {
      pushSel([]); // events empty
      await expect(
        createSettlementBatch(new Date('2025-01-01'), new Date('2025-01-31')),
      ).rejects.toThrow('No un-settled fee events');
    });

    it('creates a settlement batch from captured events', async () => {
      pushSel([
        { id: 'e1', organizationId: 'o1', grossAmountCad: '100.00', feeAmountCad: '2.00', netAmountCad: '98.00' },
        { id: 'e2', organizationId: 'o2', grossAmountCad: '50.00', feeAmountCad: '1.00', netAmountCad: '49.00' },
      ]); // events
      pushSel([{ id: 'batch-1', batchNumber: 'STL-X' }]); // batch returning
      const batch = await createSettlementBatch(new Date('2025-01-01'), new Date('2025-01-31'), 'user-1');
      expect(batch.id).toBe('batch-1');
      expect(h.auditLog).toHaveBeenCalledTimes(1);
    });
  });

  describe('closeSettlementBatch', () => {
    it('throws when the batch is not open', async () => {
      pushSel([]); // update returning empty
      await expect(closeSettlementBatch('batch-1', 'user-1')).rejects.toThrow('not found or not open');
    });

    it('closes the batch and bridges to the ledger', async () => {
      pushSel([{ id: 'batch-1', batchNumber: 'STL-X', eventCount: 2, totalFeesCad: '3.00', totalGrossCad: '150.00', totalNetCad: '147.00' }]); // update returning
      const result = await closeSettlementBatch('batch-1', 'user-1');
      expect(result.id).toBe('batch-1');
      expect(h.appendLedgerEntry).toHaveBeenCalledTimes(1);
    });
  });

  describe('getFeeReport', () => {
    it('aggregates fees by org', async () => {
      pushSel([
        { id: 'e1', organizationId: 'o1', grossAmountCad: '100.00', feeAmountCad: '2.00', netAmountCad: '98.00' },
        { id: 'e2', organizationId: 'o1', grossAmountCad: '50.00', feeAmountCad: '1.00', netAmountCad: '49.00' },
        { id: 'e3', organizationId: 'o2', grossAmountCad: '20.00', feeAmountCad: '0.50', netAmountCad: '19.50' },
      ]);
      const report = await getFeeReport(new Date('2025-01-01'), new Date('2025-01-31'), 'o1');
      expect(report.totalFeesCad).toBe('3.50');
      expect(report.eventCount).toBe(3);
      expect(report.byOrg).toHaveLength(2);
    });
  });
});
