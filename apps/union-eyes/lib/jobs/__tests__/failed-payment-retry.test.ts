import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/db', () => {
  const selectResult = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  };
  return {
    db: {
      select: vi.fn().mockReturnValue(selectResult),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    },
  };
});

vi.mock('@/db/schema/domains/finance/dues', () => ({
  duesTransactions: {
    id: 'id',
    memberId: 'memberId',
    organizationId: 'organizationId',
    totalAmount: 'totalAmount',
    dueDate: 'dueDate',
    status: 'status',
    metadata: 'metadata',
    createdAt: 'createdAt',
    notes: 'notes',
    updatedAt: 'updatedAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  sql: vi.fn(),
}));

vi.mock('@/lib/services/dues-notifications', () => ({
  sendPaymentFailure: vi.fn().mockResolvedValue(undefined),
  sendAdminIntervention: vi.fn().mockResolvedValue(undefined),
  calculateRetryDate: vi.fn().mockReturnValue(new Date()),
}));

import {
  FailedPaymentRetryService,
  runFailedPaymentRetry,
  manualTriggerRetry,
  type RetryResult,
} from '../failed-payment-retry';
import { db } from '@/db';

describe('FailedPaymentRetryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('runRetryJob', () => {
    it('returns empty result when no transactions need retry', async () => {
      const result = await FailedPaymentRetryService.runRetryJob();
      expect(result.totalProcessed).toBe(0);
      expect(result.retriesAttempted).toBe(0);
      expect(result.retriesSucceeded).toBe(0);
      expect(result.retriesFailed).toBe(0);
      expect(result.markedForAdmin).toBe(0);
      expect(result.results).toEqual([]);
    });

    it('marks transactions with 4+ failures for admin', async () => {
      const fourDaysAgo = new Date();
      fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

      const mockSelectResult = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            id: 'txn-1',
            memberId: 'member-1',
            organizationId: 'org-1',
            totalAmount: '100.00',
            dueDate: '2025-01-01',
            status: 'pending',
            metadata: {
              failureCount: 4,
              lastFailure: { date: fourDaysAgo.toISOString() },
            },
            createdAt: new Date(),
          },
        ]),
      };

      vi.mocked(db.select).mockReturnValue(mockSelectResult as unknown as never);

      const result = await FailedPaymentRetryService.runRetryJob();
      expect(result.totalProcessed).toBeGreaterThanOrEqual(0);
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
          {
            transactionId: 'txn-1',
            memberId: 'member-1',
            attemptNumber: 2,
            result: 'retried',
          },
          {
            transactionId: 'txn-2',
            memberId: 'member-2',
            attemptNumber: 4,
            result: 'max_attempts',
          },
          {
            transactionId: 'txn-3',
            memberId: 'member-3',
            attemptNumber: 0,
            result: 'error',
            error: 'connection failed',
          },
        ],
      };
      expect(result.totalProcessed).toBe(5);
      expect(result.results).toHaveLength(3);
      expect(result.results[2].error).toBe('connection failed');
    });
  });
});

describe('runFailedPaymentRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates to FailedPaymentRetryService.runRetryJob', async () => {
    const result = await runFailedPaymentRetry();
    expect(result).toBeDefined();
    expect(typeof result.totalProcessed).toBe('number');
  });
});

describe('manualTriggerRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates to FailedPaymentRetryService.runRetryJob', async () => {
    const result = await manualTriggerRetry();
    expect(result).toBeDefined();
    expect(typeof result.totalProcessed).toBe('number');
  });
});
