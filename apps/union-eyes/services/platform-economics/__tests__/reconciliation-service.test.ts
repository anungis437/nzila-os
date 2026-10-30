import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    for (const m of [
      'select',
      'from',
      'where',
      'limit',
      'offset',
      'orderBy',
      'groupBy',
      'insert',
      'update',
      'set',
      'values',
      'returning',
      'delete',
    ]) {
      chain[m] = () => chain;
    }
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const v = queue.length ? queue.shift() : [];
      return (v instanceof Error ? Promise.reject(v) : Promise.resolve(v)).then(res, rej);
    };
    return chain;
  };
  const tx = {
    insert: () => makeChain(),
    select: () => makeChain(),
    update: () => makeChain(),
    execute: async () => [],
  };
  const db = {
    select: () => makeChain(),
    insert: () => makeChain(),
    update: () => makeChain(),
    delete: () => makeChain(),
    transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
  };
  const auditLog = vi.fn();
  return { queue, db, auditLog };
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
  gte: vi.fn(() => ({})),
  lte: vi.fn(() => ({})),
  inArray: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
}));
vi.mock('@/lib/audit-logger', () => ({
  auditLog: h.auditLog,
  AuditEventType: { DATA_CREATE: 'data_create', DATA_UPDATE: 'data_update' },
  AuditSeverity: { HIGH: 'high', MEDIUM: 'medium', CRITICAL: 'critical' },
}));

import { eq } from 'drizzle-orm';
import {
  getReconciliationRun,
  listExceptions,
  requireReconciliation,
  resolveException,
  runReconciliation,
} from '../reconciliation-service';

const pushSel = (...items: unknown[]) => h.queue.push(...items);

beforeEach(() => {
  h.queue.length = 0;
  h.auditLog.mockReset();
});

describe('platform-economics/reconciliation-service', () => {
  describe('runReconciliation', () => {
    it('matches payments to invoices and records exceptions', async () => {
      const inv1 = { id: 'inv1', organizationId: 'o1', totalAmount: '10.00', invoiceNumber: 'INV-1', status: 'issued' };
      const inv2 = { id: 'inv2', organizationId: 'o1', totalAmount: '5.00', invoiceNumber: 'INV-2', status: 'issued' };
      const pmt1 = { id: 'pmt1', organizationId: 'o1', amount: '12.00' };
      const pmt2 = { id: 'pmt2', organizationId: 'o1', amount: '1.00' };
      const pmt3 = { id: 'pmt3', organizationId: 'o1', amount: '1.00' };
      const alloc1 = { paymentId: 'pmt1', invoiceId: 'inv1', amount: '12.00' };
      const alloc3 = { paymentId: 'pmt3', invoiceId: 'missing', amount: '1.00' };
      const fee1 = { id: 'fee1', settlementBatchId: 'sb1', feeAmountCad: '1.00' };
      const fee2 = { id: 'fee2', settlementBatchId: null, feeAmountCad: '1.00' };

      pushSel([{ id: 'bp1' }]); // 0a the billing period is the organization's
      pushSel([]); // 0b no earlier run for the period
      pushSel([{ id: 'run-1' }]); // 1 insert run returning
      pushSel([inv1, inv2]); // 2 invoices
      pushSel([pmt1, pmt2, pmt3]); // 3 payments
      pushSel([alloc1, alloc3]); // 4 allocations
      pushSel([]); // 5 match pmt1
      pushSel([]); // 6 discrepancy exception
      pushSel([]); // 7 unmatched pmt2
      pushSel([]); // 8 unmatched pmt3 (missing invoice)
      pushSel([]); // 9 unmatched inv2
      pushSel([fee1, fee2]); // 10 fee events
      pushSel([]); // 11 fee1 match
      pushSel([]); // 12 update run

      const result = await runReconciliation({
        organizationId: 'o1',
        billingPeriodId: 'bp1',
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
        runBy: 'user-1',
      });

      expect(result.runId).toBe('run-1');
      expect(result.totalInvoices).toBe(2);
      expect(result.totalPayments).toBe(3);
      expect(result.totalMatches).toBe(2); // pmt1↔inv1 + fee1↔sb1
      expect(result.totalExceptions).toBe(4); // discrepancy + 2 unmatched payments + unmatched invoice
      expect(h.auditLog).toHaveBeenCalled();
    });

    it('handles a period with no payments and raises a critical variance alert', async () => {
      const inv1 = { id: 'inv1', organizationId: 'o1', totalAmount: '500.00', invoiceNumber: 'INV-1', status: 'issued' };
      pushSel([{ id: 'run-2' }]); // insert run
      pushSel([inv1]); // invoices
      pushSel([]); // payments (empty → allocations skipped)
      pushSel([]); // unmatched inv1
      pushSel([]); // fee events
      pushSel([]); // update run

      const result = await runReconciliation({
        periodStart: new Date('2025-01-01'),
        periodEnd: new Date('2025-01-31'),
      });

      expect(result.totalPayments).toBe(0);
      expect(result.varianceCad).toBe('500.00');
      // base completed audit + critical variance audit
      expect(h.auditLog).toHaveBeenCalledTimes(2);
    });
  });

  // DEF-0B11-PRP-RECONCILIATION-RUNS-ARE-NOT-REPEATABLE-AND-THE-BILLING-PERIOD-IS-NOT-BOUND-TO-THE-ORGANIZATION
  describe('runReconciliation guards', () => {
    const period = { periodStart: new Date('2025-01-01'), periodEnd: new Date('2025-01-31') };

    it('refuses a billing period that is not the organization\u2019s own, before creating a run', async () => {
      pushSel([]); // the billing period is not found for this organization
      await expect(runReconciliation({ organizationId: 'o1', billingPeriodId: 'someone-elses', ...period })).rejects.toMatchObject({ code: 'NOT_FOUND' });
      expect(h.queue).toEqual([]);
      expect(h.auditLog).not.toHaveBeenCalled();
    });

    it('refuses to reconcile the same organization and period twice, naming the earlier run', async () => {
      pushSel([{ id: 'run-0' }]); // an earlier run exists
      await expect(runReconciliation({ organizationId: 'o1', ...period })).rejects.toMatchObject({ code: 'CONFLICT', details: { runId: 'run-0' } });
      expect(h.auditLog).not.toHaveBeenCalled();
    });

    it('refuses a period that ends before it starts', async () => {
      await expect(runReconciliation({ organizationId: 'o1', periodStart: period.periodEnd, periodEnd: period.periodStart })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });
  });

  describe('resolveException', () => {
    it('resolves an open exception', async () => {
      pushSel([{ id: 'ex1', organizationId: 'o1' }]); // update returning
      const updated = await resolveException('ex1', 'o1', {
        status: 'resolved',
        resolvedBy: 'user-1',
        notes: 'fixed',
      });
      expect(updated.id).toBe('ex1');
      expect(h.auditLog).toHaveBeenCalledTimes(1);
    });

    it('throws when the exception is already resolved', async () => {
      pushSel([]); // update returning empty
      await expect(
        resolveException('ex1', 'o1', { status: 'written_off', resolvedBy: 'user-1', notes: 'n' }),
      ).rejects.toThrow('not found or already resolved');
    });
  });

  describe('getReconciliationRun', () => {
    it('returns the run when found', async () => {
      pushSel([{ id: 'run-1' }]);
      expect(await getReconciliationRun('run-1', 'org-A')).toEqual({ id: 'run-1' });
    });

    it('returns null when not found', async () => {
      pushSel([]);
      expect(await getReconciliationRun('run-x', 'org-A')).toBeNull();
    });

    it('binds the lookup to the caller organization, so another organization run reads as missing', async () => {
      vi.mocked(eq).mockClear();
      pushSel([]);
      expect(await getReconciliationRun('run-of-org-B', 'org-A')).toBeNull();
      expect(eq).toHaveBeenCalledWith({ __col: 'id' }, 'run-of-org-B');
      expect(eq).toHaveBeenCalledWith({ __col: 'organizationId' }, 'org-A');
    });
  });

  describe('listExceptions', () => {
    it('lists exceptions with the default status filter', async () => {
      pushSel([{ id: 'ex1' }]);
      const result = await listExceptions('o1');
      expect(result).toHaveLength(1);
    });
  });

  // DEF-0B11-PRP-RECONCILIATION-LISTS-ARE-UNBOUNDED-AND-THE-EXCEPTION-STATUS-FILTER-IS-AN-UNVALIDATED-CAST
  describe('listExceptions input', () => {
    it.each([[['bogus']], [['open', 'bogus']], [[]]])('refuses the status filter %j before querying', async (filter) => {
      await expect(listExceptions('o1', filter as string[])).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(h.queue).toEqual([]);
    });

    it('accepts every status in the vocabulary', async () => {
      pushSel([{ id: 'ex1' }]);
      await expect(listExceptions('o1', ['open', 'under_review', 'resolved', 'written_off'], 5)).resolves.toHaveLength(1);
    });
  });

  describe('requireReconciliation', () => {
    it('throws when there is no completed run', async () => {
      pushSel([]); // run lookup empty
      await expect(requireReconciliation('bp1')).rejects.toThrow('no completed reconciliation run');
    });

    it('throws when open exceptions remain', async () => {
      pushSel([{ id: 'run-1' }]); // run
      pushSel([{ id: 'ex1' }]); // open exceptions
      await expect(requireReconciliation('bp1')).rejects.toThrow('unresolved reconciliation exception');
    });

    it('returns the run when reconciliation is clean', async () => {
      pushSel([{ id: 'run-1' }]); // run
      pushSel([]); // no open exceptions
      const run = await requireReconciliation('bp1');
      expect(run.id).toBe('run-1');
    });
  });
});
