import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { systemContext } from './system-context-double';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/db/with-rls-context', async () => (await import('./system-context-double')).systemContextModule);

const notifications = vi.hoisted(() => ({
  sendPaymentFailure: vi.fn(),
  sendAdminIntervention: vi.fn(),
  depthAtCall: [] as Array<[string, number]>,
}));
vi.mock('@/lib/services/dues-notifications', () => ({
  sendPaymentFailure: notifications.sendPaymentFailure,
  sendAdminIntervention: notifications.sendAdminIntervention,
  calculateRetryDate: vi.fn(() => '2026-02-01'),
}));

import { FailedPaymentRetryService, runFailedPaymentRetry, manualTriggerRetry, type RetryResult } from '../failed-payment-retry';

const dialect = new PgDialect();
const render = (condition: SQL) => dialect.sqlToQuery(condition);
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

type Row = {
  id: string;
  memberId: string;
  organizationId: string;
  totalAmount: string;
  dueDate: string;
  status: string;
  createdAt: Date;
  metadata: Record<string, unknown>;
};

const failedPayment = (overrides: Partial<Row> = {}): Row => ({
  id: 'txn-1',
  memberId: 'member-1',
  organizationId: 'org-1',
  totalAmount: '100.00',
  dueDate: '2026-01-01',
  status: 'pending',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  metadata: { failureCount: 4, lastFailure: { date: daysAgo(10) } },
  ...overrides,
});

/** The transaction handle of the system context: the scan answers with `scan`, an update is recorded with its values and rendered condition. */
function installTransaction(scan: Row[] | Error) {
  const updates: Array<{ values: Record<string, unknown>; where: { sql: string; params: unknown[] } }> = [];
  const selectDepths: number[] = [];
  const tx = {
    select: vi.fn(() => ({
      from: () => ({
        where: async () => {
          selectDepths.push(systemContext.depth);
          if (scan instanceof Error) throw scan;
          return scan;
        },
      }),
    })),
    update: vi.fn(() => ({
      set: (values: Record<string, unknown>) => ({
        where: async (condition: SQL) => {
          systemContext.note('update');
          updates.push({ values, where: render(condition) });
        },
      }),
    })),
  };
  systemContext.reset(tx);
  return { tx, updates, selectDepths };
}

beforeEach(() => {
  vi.clearAllMocks();
  notifications.depthAtCall.length = 0;
  notifications.sendPaymentFailure.mockImplementation(async (id: string) => {
    notifications.depthAtCall.push([`failure ${id}`, systemContext.depth]);
    systemContext.note(`notify failure ${id}`);
  });
  notifications.sendAdminIntervention.mockImplementation(async (id: string) => {
    notifications.depthAtCall.push([`admin ${id}`, systemContext.depth]);
    systemContext.note(`notify admin ${id}`);
  });
});

describe('FailedPaymentRetryService.runRetryJob', () => {
  it('has nothing to do when no failed payment is pending', async () => {
    installTransaction([]);

    const result = await FailedPaymentRetryService.runRetryJob();

    expect(result).toEqual({
      totalProcessed: 0,
      retriesAttempted: 0,
      retriesSucceeded: 0,
      retriesFailed: 0,
      markedForAdmin: 0,
      results: [],
    });
    expect(notifications.sendPaymentFailure).not.toHaveBeenCalled();
    expect(notifications.sendAdminIntervention).not.toHaveBeenCalled();
  });

  it('reads the failed payments of every organization as the system role, in one transaction', async () => {
    const { selectDepths } = installTransaction([]);

    await FailedPaymentRetryService.runRetryJob();

    expect(selectDepths).toEqual([1]);
    expect(systemContext.contexts).toHaveLength(1);
    expect(systemContext.contexts[0].committed).toBe(true);
  });

  it('flags a payment that reached the retry limit inside its own organization, then tells the administrators in a transaction of their own', async () => {
    const { updates } = installTransaction([failedPayment({ id: 'txn-9', organizationId: 'org-9' })]);

    const result = await FailedPaymentRetryService.runRetryJob();

    expect(result.markedForAdmin).toBe(1);
    expect(result.results).toEqual([{ transactionId: 'txn-9', memberId: 'member-1', attemptNumber: 4, result: 'max_attempts' }]);

    expect(updates).toHaveLength(1);
    expect(updates[0].values).toMatchObject({ status: 'overdue' });
    // The statement names the transaction AND its organization: the system role has no row-level filter of its own
    expect(updates[0].where.sql).toContain('"id" =');
    expect(updates[0].where.sql).toContain('"organization_id" =');
    expect(updates[0].where.params).toEqual(['txn-9', 'org-9']);

    // The flag commits before the notification starts; the notification runs as the system role too and cannot roll the flag back
    expect(systemContext.events).toEqual([
      'open 1', 'commit 1',
      'open 2', 'update', 'commit 2',
      'open 3', 'notify admin txn-9', 'commit 3',
    ]);
    expect(notifications.depthAtCall).toEqual([['admin txn-9', 1]]);
  });

  it('keeps the flag when the administrators cannot be told', async () => {
    const { updates } = installTransaction([failedPayment()]);
    notifications.sendAdminIntervention.mockRejectedValueOnce(new Error('smtp down'));

    const result = await FailedPaymentRetryService.runRetryJob();

    expect(updates).toHaveLength(1);
    expect(systemContext.contexts[1].committed).toBe(true);
    expect(systemContext.contexts[2].rolledBack).toBe(true);
    expect(result.markedForAdmin).toBe(0);
    expect(result.retriesFailed).toBe(1);
    expect(result.results).toEqual([
      { transactionId: 'txn-1', memberId: 'member-1', attemptNumber: 0, result: 'error', error: 'smtp down' },
    ]);
  });

  it('announces the retry of a payment whose waiting period has passed, as the system role', async () => {
    const { updates } = installTransaction([failedPayment({ metadata: { failureCount: 1, lastFailure: { date: daysAgo(2) } } })]);

    const result = await FailedPaymentRetryService.runRetryJob();

    expect(notifications.sendPaymentFailure).toHaveBeenCalledWith('txn-1', 'Payment will be retried automatically', true, '2026-02-01');
    expect(notifications.depthAtCall).toEqual([['failure txn-1', 1]]);
    expect(updates).toEqual([]);
    expect(result).toMatchObject({ totalProcessed: 1, retriesAttempted: 1, retriesSucceeded: 1, retriesFailed: 0, markedForAdmin: 0 });
    expect(result.results).toEqual([{ transactionId: 'txn-1', memberId: 'member-1', attemptNumber: 2, result: 'retried' }]);
  });

  it('leaves a payment alone while its waiting period runs', async () => {
    installTransaction([failedPayment({ metadata: { failureCount: 2, lastFailure: { date: daysAgo(1) } } })]);

    const result = await FailedPaymentRetryService.runRetryJob();

    expect(result.totalProcessed).toBe(0);
    expect(notifications.sendPaymentFailure).not.toHaveBeenCalled();
    expect(notifications.sendAdminIntervention).not.toHaveBeenCalled();
  });

  it('reports the failure of one payment with its message and still processes the payments after it', async () => {
    installTransaction([
      failedPayment({ id: 'txn-a', metadata: { failureCount: 1, lastFailure: { date: daysAgo(2) } } }),
      failedPayment({ id: 'txn-b', metadata: { failureCount: 1, lastFailure: { date: daysAgo(2) } } }),
    ]);
    notifications.sendPaymentFailure.mockImplementationOnce(async () => {
      throw new Error('smtp down');
    });

    const result = await FailedPaymentRetryService.runRetryJob();

    expect(result.retriesAttempted).toBe(2);
    expect(result.retriesFailed).toBe(1);
    expect(result.retriesSucceeded).toBe(1);
    expect(result.results).toEqual([
      { transactionId: 'txn-a', memberId: 'member-1', attemptNumber: 0, result: 'error', error: 'smtp down' },
      { transactionId: 'txn-b', memberId: 'member-1', attemptNumber: 2, result: 'retried' },
    ]);
    // Each notification has a transaction of its own: the first rolls back alone, the second commits
    expect(systemContext.contexts.map((context) => [context.committed, context.rolledBack])).toEqual([
      [true, false],
      [false, true],
      [true, false],
    ]);
  });

  it('fails the job when the scan fails, instead of reporting that there is nothing to do', async () => {
    installTransaction(new Error('db down'));

    await expect(FailedPaymentRetryService.runRetryJob()).rejects.toThrow('db down');
    expect(systemContext.contexts[0].rolledBack).toBe(true);
  });
});

describe('RetryResult type', () => {
  it('has correct shape', () => {
    const result: RetryResult = {
      totalProcessed: 5,
      retriesAttempted: 3,
      retriesSucceeded: 2,
      retriesFailed: 1,
      markedForAdmin: 1,
      results: [
        { transactionId: 'txn-1', memberId: 'member-1', attemptNumber: 2, result: 'retried' },
        { transactionId: 'txn-2', memberId: 'member-2', attemptNumber: 4, result: 'max_attempts' },
        { transactionId: 'txn-3', memberId: 'member-3', attemptNumber: 0, result: 'error', error: 'connection failed' },
      ],
    };
    expect(result.totalProcessed).toBe(5);
    expect(result.results).toHaveLength(3);
    expect(result.results[2].error).toBe('connection failed');
  });
});

describe('job entry points', () => {
  it.each([
    ['runFailedPaymentRetry', runFailedPaymentRetry],
    ['manualTriggerRetry', manualTriggerRetry],
  ])('%s runs the retry job', async (_name, run) => {
    installTransaction([]);

    const result = await run();

    expect(result.totalProcessed).toBe(0);
    expect(systemContext.contexts).toHaveLength(1);
  });
});
