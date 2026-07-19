import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'from', 'where', 'limit', 'orderBy', 'insert', 'update', 'set', 'values', 'returning', 'delete']) {
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
  return { queue, db, auditLog, appendLedgerEntry };
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

beforeEach(() => {
  h.queue.length = 0;
  h.auditLog.mockReset();
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

    it('captures a new fee event and bridges to the ledger', async () => {
      pushSel([]); // no existing
      pushSel([{ id: 'evt-1' }]); // insert returning
      const result = await captureTransactionFee(baseInput);
      expect(result.id).toBe('evt-1');
      expect(h.appendLedgerEntry).toHaveBeenCalledTimes(1);
      expect(h.auditLog).toHaveBeenCalledTimes(1);
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
      pushSel([{ id: 'adj-1' }]); // adjustment returning
      const result = await reverseTransactionFee('evt-1', 'refund-1', 'reason', 'approver');
      expect(result.adjustment.id).toBe('adj-1');
      expect(h.appendLedgerEntry).toHaveBeenCalledTimes(1);
    });

    it('reverses a partial fee proportionally', async () => {
      pushSel([{ id: 'evt-1', organizationId: 'o1', grossAmountCad: '100.00', feeAmountCad: '2.00', billingPeriodId: null }]); // select
      pushSel([{ id: 'evt-1', status: 'captured' }]); // update returning
      pushSel([{ id: 'adj-1' }]); // adjustment returning
      const result = await reverseTransactionFee('evt-1', 'refund-1', 'partial', undefined, '50.00');
      expect(result.adjustment.id).toBe('adj-1');
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
