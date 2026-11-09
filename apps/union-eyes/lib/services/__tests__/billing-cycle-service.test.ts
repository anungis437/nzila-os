/**
 * Billing Cycle Service — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockSelect, mockWithRLS, mockCalculate, mockRequireMandate } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockWithRLS: vi.fn(),
  mockRequireMandate: vi.fn(),
  mockCalculate: vi.fn(),
}));

vi.mock('@/db/schema-organizations', () => ({
  organizationMembers: {},
}));

vi.mock('@/db/schema/domains/finance/dues', () => ({
  duesTransactions: {},
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('drizzle-orm/node-postgres', () => ({
  NodePgDatabase: class {},
}));

vi.mock('@/lib/dues-calculation-engine', () => ({
  DuesCalculationEngine: { calculateMemberDues: mockCalculate },
}));

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: mockWithRLS,
}));

// The mandate check reads the ledger on the transaction; billing-cycle-transaction-safety.test.ts covers its behavior.
vi.mock('@/lib/finance/require-live-financial-mandate', () => ({
  requireLiveFinancialMandate: mockRequireMandate,
}));

vi.mock('@/lib/decimal-safe', () => ({
  moneyToNumber: vi.fn((s: string) => parseFloat(s)),
  toCents: vi.fn((n: number) => Math.round(n * 100)),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { BillingCycleService, type BillingCycleParams } from '../billing-cycle-service';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('BillingCycleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWithRLS.mockImplementation(
      async (_orgId: string, callback: (db: any) => Promise<any>) => {
        const mockDb = {
          select: mockSelect,
          insert: vi.fn(() => ({
            values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
          })),
        };
        return callback(mockDb);
      }
    );
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
  });

  it('binds the target organization and actor to the database transaction, and requires the live execution mandate on that same transaction before reading members', async () => {
    const order: string[] = [];
    let boundTx: unknown;
    mockRequireMandate.mockImplementationOnce(async () => {
      order.push('mandate');
    });
    mockWithRLS.mockImplementationOnce(async (scope, callback) => {
      expect(scope).toEqual({ organizationId: '11111111-1111-4111-8111-111111111111', userId: 'user-1' });
      boundTx = {
        select: () => {
          order.push('read-members');
          return { from: () => ({ where: async () => [] }) };
        },
      };
      return callback(boundTx);
    });
    const result = await BillingCycleService.generateBillingCycle({
      organizationId: '11111111-1111-4111-8111-111111111111',
      periodStart: new Date('2026-03-01'),
      periodEnd: new Date('2026-03-31'),
      frequency: 'monthly',
      executedBy: 'user-1',
      dryRun: true,
    });
    expect(result.transactionsCreated).toBe(0);
    expect(mockWithRLS).toHaveBeenCalledOnce();
    expect(mockRequireMandate).toHaveBeenCalledWith(boundTx, {
      organizationId: '11111111-1111-4111-8111-111111111111',
      userId: 'user-1',
      action: 'finance:execute',
      requiresLedger: true,
    });
    expect(order[0]).toBe('mandate');
    expect(order).toContain('read-members');
  });

  it('rejects reversed or invalid dates before opening a financial transaction', async () => {
    const validStart = new Date('2026-03-01T00:00:00Z');
    const validEnd = new Date('2026-03-31T23:59:59Z');
    const base = {
      organizationId: '11111111-1111-4111-8111-111111111111',
      frequency: 'monthly' as const,
      executedBy: 'user-1',
    };
    await expect(BillingCycleService.generateBillingCycle({
      ...base, periodStart: validEnd, periodEnd: validStart,
    })).rejects.toThrow('Invalid billing cycle period');
    await expect(BillingCycleService.generateBillingCycle({
      ...base, periodStart: new Date(NaN), periodEnd: validEnd,
    })).rejects.toThrow('Invalid billing cycle period');
    expect(mockWithRLS).not.toHaveBeenCalled();
    expect(mockRequireMandate).not.toHaveBeenCalled();
  });

  it('BillingCycleParams has expected structure', () => {
    const params: BillingCycleParams = {
      organizationId: 'org-1',
      periodStart: new Date('2026-03-01'),
      periodEnd: new Date('2026-03-31'),
      frequency: 'monthly',
      executedBy: 'user-1',
    };

    expect(params.organizationId).toBe('org-1');
    expect(params.frequency).toBe('monthly');
  });

  it('supports dryRun mode', () => {
    const params: BillingCycleParams = {
      organizationId: 'org-1',
      periodStart: new Date('2026-03-01'),
      periodEnd: new Date('2026-03-31'),
      frequency: 'monthly',
      dryRun: true,
      executedBy: 'user-1',
    };

    expect(params.dryRun).toBe(true);
  });

  describe('generation of the charges of a cycle', () => {
    const ORG = '11111111-1111-4111-8111-111111111111';
    const MEMBER = '33333333-3333-4333-8333-333333333333';
    const OTHER = '44444444-4444-4444-8444-444444444444';
    const cycle = {
      organizationId: ORG,
      periodStart: new Date('2026-03-01T00:00:00.000Z'),
      periodEnd: new Date('2026-03-31T23:59:59.999Z'),
      frequency: 'monthly' as const,
      executedBy: 'user-1',
    };
    const calculation = (assignmentId: string, amount = 100) => ({
      amount,
      calculationType: 'assignment',
      assignmentId,
      frequency: 'monthly',
      dueDate: new Date('2026-04-15T00:00:00.000Z'),
    });

    // The cycle's transaction: members first, then the members already charged for the period; inserts are recorded
    const fakeTx = (members: unknown[], billed: unknown[] = []) => {
      const inserts: Array<Record<string, unknown>> = [];
      let reads = 0;
      const tx = {
        select: vi.fn(() => ({ from: () => ({ where: async () => (reads++ === 0 ? members : billed) }) })),
        insert: vi.fn(() => ({
          values: (values: Record<string, unknown>) => {
            inserts.push(values);
            return { returning: async () => [{ id: `txn-${inserts.length}` }] };
          },
        })),
      };
      mockWithRLS.mockImplementationOnce(async (_scope, callback) => callback(tx));
      return { tx, inserts };
    };
    const member = (id: string, extra: Record<string, unknown> = {}) => ({ id, userId: `user-${id}`, status: 'active', joinedAt: null, membershipNumber: null, ...extra });

    it("charges each active member the amount of their dues assignment, on the assignment, in the cycle's own transaction", async () => {
      const { tx, inserts } = fakeTx([member(MEMBER)]);
      mockCalculate.mockResolvedValueOnce(calculation('assignment-1'));

      const result = await BillingCycleService.generateBillingCycle(cycle);

      expect(mockCalculate).toHaveBeenCalledWith(
        { organizationId: ORG, memberId: MEMBER, periodStart: cycle.periodStart, periodEnd: cycle.periodEnd, frequency: 'monthly' },
        tx,
      );
      expect(inserts).toHaveLength(1);
      expect(inserts[0]).toMatchObject({
        organizationId: ORG,
        memberId: MEMBER,
        assignmentId: 'assignment-1',
        transactionType: 'charge',
        status: 'pending',
        amount: '100',
        totalAmount: '100',
        periodStart: '2026-03-01',
        periodEnd: '2026-03-31',
        dueDate: '2026-04-15',
        duesAmount: '85',
        copeAmount: '10',
        pacAmount: '3',
        strikeFundAmount: '2',
        metadata: { calculationType: 'assignment', assignmentId: 'assignment-1', isProRated: false },
      });
      expect(result).toMatchObject({ success: true, transactionsCreated: 1, totalAmount: 100 });
    });

    it('never charges a member twice for the same period: a cycle run again skips the members already charged', async () => {
      const { inserts } = fakeTx([member(MEMBER), member(OTHER)], [{ memberId: MEMBER }]);
      mockCalculate.mockResolvedValueOnce(calculation('assignment-2', 50));

      const result = await BillingCycleService.generateBillingCycle(cycle);

      expect(mockCalculate).toHaveBeenCalledTimes(1);
      expect(mockCalculate).toHaveBeenCalledWith(expect.objectContaining({ memberId: OTHER }), expect.anything());
      expect(inserts).toHaveLength(1);
      expect(inserts[0]).toMatchObject({ memberId: OTHER });
      expect(result.members).toMatchObject({ processed: 2, skipped: 1 });
      expect(result.transactionsCreated).toBe(1);
    });

    it('skips a member with no assignment on the cycle frequency, and writes nothing for them', async () => {
      const { inserts } = fakeTx([member(MEMBER)]);
      mockCalculate.mockResolvedValueOnce(null);

      const result = await BillingCycleService.generateBillingCycle(cycle);

      expect(inserts).toHaveLength(0);
      expect(result).toMatchObject({ success: true, transactionsCreated: 0, members: { skipped: 1 } });
    });

    it('prorates the charge of a member who joined mid-cycle and says so on the transaction', async () => {
      const { inserts } = fakeTx([member(MEMBER, { joinedAt: new Date('2026-03-16T00:00:00.000Z') })]);
      mockCalculate.mockResolvedValueOnce(calculation('assignment-3', 31));

      await BillingCycleService.generateBillingCycle(cycle);

      expect(inserts[0]).toMatchObject({ amount: '16', metadata: { isProRated: true } });
    });

    it('skips members joining after the cycle without creating a pending zero-value charge', async () => {
      const { tx, inserts } = fakeTx([member(MEMBER, { joinedAt: new Date('2026-04-01T00:00:00.000Z') })]);
      mockCalculate.mockResolvedValueOnce(calculation('assignment-future', 100));

      const result = await BillingCycleService.generateBillingCycle(cycle);

      expect(tx.insert).not.toHaveBeenCalled();
      expect(inserts).toHaveLength(0);
      expect(result).toMatchObject({ success: true, transactionsCreated: 0, totalAmount: 0, members: { processed: 1, skipped: 1 } });
    });

    it('bills a member joining on the final UTC calendar day even when periodEnd is midnight', async () => {
      const { tx, inserts } = fakeTx([member(MEMBER, { joinedAt: new Date('2026-03-31T18:30:00.000Z') })]);
      mockCalculate.mockResolvedValueOnce(calculation('assignment-last-day', 31));

      const result = await BillingCycleService.generateBillingCycle({
        ...cycle,
        periodEnd: new Date('2026-03-31T00:00:00.000Z'),
      });

      expect(tx.insert).toHaveBeenCalledOnce();
      expect(inserts).toHaveLength(1);
      expect(inserts[0]).toMatchObject({ amount: '1', periodEnd: '2026-03-31' });
      expect(result).toMatchObject({ success: true, transactionsCreated: 1, members: { skipped: 0 } });
    });

    it('still skips a member joining on the next UTC calendar day when periodEnd is midnight', async () => {
      const { tx, inserts } = fakeTx([member(MEMBER, { joinedAt: new Date('2026-04-01T00:00:00.000Z') })]);
      mockCalculate.mockResolvedValueOnce(calculation('assignment-next-day', 31));

      const result = await BillingCycleService.generateBillingCycle({
        ...cycle,
        periodEnd: new Date('2026-03-31T00:00:00.000Z'),
      });

      expect(tx.insert).not.toHaveBeenCalled();
      expect(inserts).toHaveLength(0);
      expect(result).toMatchObject({ success: true, transactionsCreated: 0, members: { skipped: 1 } });
    });

    it('skips charges that prorate to zero cents instead of creating receivables', async () => {
      const { tx, inserts } = fakeTx([member(MEMBER, { joinedAt: new Date('2026-03-31T00:00:00.000Z') })]);
      mockCalculate.mockResolvedValueOnce(calculation('assignment-small', 0.01));

      const result = await BillingCycleService.generateBillingCycle(cycle);

      expect(tx.insert).not.toHaveBeenCalled();
      expect(inserts).toHaveLength(0);
      expect(result).toMatchObject({ success: true, transactionsCreated: 0, totalAmount: 0, members: { skipped: 1 } });
    });

    it('previews the amounts without writing a charge', async () => {
      const { tx, inserts } = fakeTx([member(MEMBER)]);
      mockCalculate.mockResolvedValueOnce(calculation('assignment-4', 80));

      const result = await BillingCycleService.generateBillingCycle({ ...cycle, dryRun: true });

      expect(tx.insert).not.toHaveBeenCalled();
      expect(inserts).toHaveLength(0);
      expect(result.totalAmount).toBe(80);
      expect(result.breakdown.duesAmount).toBe(68);
    });

    it('aborts the whole cycle, writing nothing it does not roll back, when a member cannot be calculated', async () => {
      const { inserts } = fakeTx([member(MEMBER), member(OTHER)]);
      mockCalculate.mockResolvedValueOnce(calculation('assignment-5')).mockRejectedValueOnce(new Error('assignment unreadable'));

      await expect(BillingCycleService.generateBillingCycle(cycle)).rejects.toThrow('Billing cycle aborted');
      // the first charge was written inside the same transaction that now rolls back
      expect(inserts).toHaveLength(1);
    });
  });

  it('supports all billing frequencies', () => {
    const frequencies = ['monthly', 'bi_weekly', 'weekly', 'quarterly', 'annual'];
    frequencies.forEach((freq) => {
      const params: BillingCycleParams = {
        organizationId: 'org-1',
        periodStart: new Date(),
        periodEnd: new Date(),
        frequency: freq as BillingCycleParams['frequency'],
        executedBy: 'user-1',
      };
      expect(params.frequency).toBe(freq);
    });
  });
});
