/**
 * Dues Queries — Unit Tests
 *
 * withRLSContext + drizzle-builder queue mock (chain methods return chain;
 * chain.then resolves queue.shift(), Error => reject). Several functions do
 * in-memory filtering/aggregation over the returned rows, so rows carry
 * realistic status/totalAmount/date fields.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ queue: [] as unknown[] }));

function makeChain() {
  const chain: Record<string, unknown> = {};
  for (const m of ['from', 'where', 'orderBy', 'limit', 'values', 'set', 'returning']) {
    chain[m] = () => chain;
  }
  (chain as { then: unknown }).then = (
    resolve: (v: unknown) => unknown,
    reject: (e: unknown) => unknown,
  ) => {
    const v = mocks.queue.length ? mocks.queue.shift() : [];
    if (v instanceof Error) return Promise.reject(v).then(resolve, reject);
    return Promise.resolve(v).then(resolve, reject);
  };
  return chain;
}
function makeTx() {
  return {
    select: () => makeChain(),
    insert: () => makeChain(),
    update: () => makeChain(),
    delete: () => makeChain(),
  };
}

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (op: (tx: unknown) => Promise<unknown>) => op(makeTx()),
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import * as q from '../dues-queries';

function push(...rows: unknown[]) {
  mocks.queue.push(...rows);
}

const txns = [
  { memberId: 'm1', status: 'pending', totalAmount: '100', dueDate: '2025-01-01', periodStart: '2025-01-01', periodEnd: '2025-01-31', paidDate: null },
  { memberId: 'm1', status: 'overdue', totalAmount: '50', dueDate: '2024-12-01', periodStart: '2024-12-01', periodEnd: '2024-12-31', paidDate: null },
  { memberId: 'm1', status: 'paid', totalAmount: '75', dueDate: '2024-11-01', periodStart: '2024-11-01', periodEnd: '2024-11-30', paidDate: '2024-11-15' },
  { memberId: 'm2', status: 'waived', totalAmount: '25', dueDate: '2024-10-01', periodStart: '2024-10-01', periodEnd: '2024-10-31', paidDate: null },
];

beforeEach(() => {
  mocks.queue = [];
  vi.clearAllMocks();
});

describe('dues-queries', () => {
  it('getDuesBalanceByMember computes balances and last payment', async () => {
    push(txns);
    const r = await q.getDuesBalanceByMember('m1');
    expect(r.pendingBalance).toBe(100);
    expect(r.overdueBalance).toBe(50);
    expect(r.paidTotal).toBe(75);
    expect(r.currentBalance).toBe(150);
    expect(r.lastPaymentDate).toBe('2024-11-15');
    expect(r.pendingTransactions).toBe(1);
  });
  it('getDuesBalanceByMember rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.getDuesBalanceByMember('m1')).rejects.toThrow('Failed to get dues balance');
  });

  it('getDuesTransactionsByMember applies all filters', async () => {
    push(txns);
    const r = await q.getDuesTransactionsByMember('m1', {
      status: 'pending',
      startDate: new Date('2024-12-01'),
      endDate: new Date('2025-02-01'),
      limit: 10,
    });
    expect(r).toHaveLength(1);
    expect(r[0].status).toBe('pending');
  });
  it('getDuesTransactionsByMember without options returns all', async () => {
    push(txns);
    expect(await q.getDuesTransactionsByMember('m1')).toHaveLength(4);
  });
  it('getDuesTransactionsByMember rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.getDuesTransactionsByMember('m1')).rejects.toThrow('Failed to get dues transactions');
  });

  it('getDuesTransactionsByOrganization applies all filters', async () => {
    push(txns);
    const r = await q.getDuesTransactionsByOrganization('org', {
      status: 'overdue',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2025-12-31'),
    });
    expect(r).toHaveLength(1);
  });
  it('getDuesTransactionsByOrganization without options returns all', async () => {
    push(txns);
    expect(await q.getDuesTransactionsByOrganization('org')).toHaveLength(4);
  });

  it('createDuesTransaction returns the created row', async () => {
    push([{ id: 't1' }]);
    expect(await q.createDuesTransaction({ organizationId: 'org' } as never)).toEqual({ id: 't1' });
  });
  it('createDuesTransaction rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.createDuesTransaction({} as never)).rejects.toThrow('Failed to create dues transaction');
  });

  it('updateDuesTransactionStatus to paid records payment details', async () => {
    push([{ id: 't1', status: 'paid' }]);
    const r = await q.updateDuesTransactionStatus('t1', 'paid', {
      paymentMethod: 'card',
      paymentReference: 'ref',
      receiptUrl: 'http://r',
    });
    expect(r).toEqual({ id: 't1', status: 'paid' });
  });
  it('updateDuesTransactionStatus to paid without details', async () => {
    push([{ id: 't1', status: 'paid' }]);
    expect(await q.updateDuesTransactionStatus('t1', 'paid')).toEqual({ id: 't1', status: 'paid' });
  });
  it('updateDuesTransactionStatus to non-paid status', async () => {
    push([{ id: 't1', status: 'cancelled' }]);
    expect(await q.updateDuesTransactionStatus('t1', 'cancelled')).toEqual({
      id: 't1',
      status: 'cancelled',
    });
  });
  it('updateDuesTransactionStatus rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.updateDuesTransactionStatus('t1', 'paid')).rejects.toThrow(
      'Failed to update dues transaction',
    );
  });

  it('markOverdueTransactions returns count of updated rows', async () => {
    push([{ id: 't1' }, { id: 't2' }]);
    expect(await q.markOverdueTransactions()).toBe(2);
  });
  it('markOverdueTransactions rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.markOverdueTransactions()).rejects.toThrow('Failed to mark overdue transactions');
  });

  it('getOrganizationDuesSummary aggregates totals and member counts', async () => {
    push(txns);
    const r = await q.getOrganizationDuesSummary('org');
    expect(r.totalCollected).toBe(75);
    expect(r.totalPending).toBe(100);
    expect(r.totalOverdue).toBe(50);
    expect(r.totalWaived).toBe(25);
    expect(r.totalOutstanding).toBe(150);
    expect(r.transactionCount.total).toBe(4);
    expect(r.memberCount.total).toBe(2);
    expect(r.memberCount.withOverdue).toBe(1);
  });
  it('getOrganizationDuesSummary rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.getOrganizationDuesSummary('org')).rejects.toThrow(
      'Failed to get organization dues summary',
    );
  });
});
