import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { DuesCalculationEngine, assignmentFrequency } from '../dues-calculation-engine';

const ORG = '11111111-1111-4111-8111-111111111111';
const MEMBER = '22222222-2222-4222-8222-222222222222';
const period = { periodStart: new Date('2026-01-01T00:00:00.000Z'), periodEnd: new Date('2026-01-31T23:59:59.999Z') };

const assignment = (over: Record<string, unknown> = {}) => ({ id: 'a1', amount: '45.00', frequency: 'monthly', ...over });

// A transaction that answers the assignment read and records its predicate and ordering
function fakeExecutor(rows: unknown[]) {
  const seen: { where?: SQL; orderBy?: SQL[]; limit?: number } = {};
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn((clause: SQL) => {
      seen.where = clause;
      return chain;
    }),
    orderBy: vi.fn((...order: SQL[]) => {
      seen.orderBy = order;
      return chain;
    }),
    limit: vi.fn(async (n: number) => {
      seen.limit = n;
      return rows;
    }),
  };
  const executor = { select: vi.fn(() => chain) };
  return { executor: executor as never, seen };
}

const text = (clause: SQL | undefined) => new PgDialect().sqlToQuery(clause as SQL);

describe('DuesCalculationEngine', () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns null when the member has no dues assignment", async () => {
    const { executor } = fakeExecutor([]);
    expect(await DuesCalculationEngine.calculateMemberDues({ organizationId: ORG, memberId: MEMBER, ...period }, executor)).toBeNull();
  });

  it("takes the amount of the member's assignment, as a flat dues amount", async () => {
    const { executor } = fakeExecutor([assignment()]);
    const result = await DuesCalculationEngine.calculateMemberDues({ organizationId: ORG, memberId: MEMBER, ...period }, executor);

    expect(result).toMatchObject({
      amount: 45,
      calculationType: 'assignment',
      assignmentId: 'a1',
      frequency: 'monthly',
      breakdown: { baseAmount: 45, flatAmount: 45 },
    });
  });

  it('keeps cents exactly', async () => {
    const { executor } = fakeExecutor([assignment({ amount: '12.34' })]);
    const result = await DuesCalculationEngine.calculateMemberDues({ organizationId: ORG, memberId: MEMBER, ...period }, executor);
    expect(result!.amount).toBe(12.34);
  });

  it('falls due 15 days after the end of the period', async () => {
    const { executor } = fakeExecutor([assignment()]);
    const result = await DuesCalculationEngine.calculateMemberDues({ organizationId: ORG, memberId: MEMBER, ...period }, executor);

    expect(result!.dueDate.toISOString().slice(0, 10)).toBe('2026-02-15');
    expect(result!.periodStart).toBe(period.periodStart);
    expect(result!.periodEnd).toBe(period.periodEnd);
  });

  it('charges nothing for an assignment of zero (a member who is exempt)', async () => {
    const { executor } = fakeExecutor([assignment({ amount: '0.00' })]);
    expect(await DuesCalculationEngine.calculateMemberDues({ organizationId: ORG, memberId: MEMBER, ...period }, executor)).toBeNull();
  });

  describe("the cycle's frequency", () => {
    it('is not applied when the caller names none: the most recent active assignment applies', async () => {
      const { executor } = fakeExecutor([assignment({ id: 'newest', frequency: 'quarterly' }), assignment({ id: 'older' })]);
      const result = await DuesCalculationEngine.calculateMemberDues({ organizationId: ORG, memberId: MEMBER, ...period }, executor);
      expect(result!.assignmentId).toBe('newest');
    });

    it('skips an assignment on another frequency and takes the next that matches', async () => {
      const { executor } = fakeExecutor([assignment({ id: 'quarterly', frequency: 'quarterly' }), assignment({ id: 'monthly-one', frequency: 'Monthly' })]);
      const result = await DuesCalculationEngine.calculateMemberDues({ organizationId: ORG, memberId: MEMBER, ...period, frequency: 'monthly' }, executor);
      expect(result!.assignmentId).toBe('monthly-one');
    });

    it('returns null when no active assignment is on the frequency', async () => {
      const { executor } = fakeExecutor([assignment({ frequency: 'quarterly' })]);
      expect(
        await DuesCalculationEngine.calculateMemberDues({ organizationId: ORG, memberId: MEMBER, ...period, frequency: 'weekly' }, executor),
      ).toBeNull();
    });

    it('recognizes the spellings the assignments use', () => {
      expect(assignmentFrequency('biweekly')).toBe('bi_weekly');
      expect(assignmentFrequency('Bi-Weekly')).toBe('bi_weekly');
      expect(assignmentFrequency('annually')).toBe('annual');
      expect(assignmentFrequency(' YEARLY ')).toBe('annual');
      expect(assignmentFrequency('fortnightly')).toBeUndefined();
    });
  });

  describe('the read', () => {
    it("is scoped to the organization and the member, to active assignments in force at the start of the period, newest first", async () => {
      const { executor, seen } = fakeExecutor([assignment()]);
      await DuesCalculationEngine.calculateMemberDues({ organizationId: ORG, memberId: MEMBER, ...period }, executor);

      const where = text(seen.where);
      expect(where.sql).toContain('"dues_assignments"."organization_id" = $1');
      expect(where.sql).toContain('"dues_assignments"."member_id" = $2');
      expect(where.sql).toContain('"dues_assignments"."status" = $3');
      expect(where.sql).toContain('"dues_assignments"."effective_date" <= $4');
      expect(where.sql).toContain('"dues_assignments"."end_date" is null');
      expect(where.params.slice(0, 3)).toEqual([ORG, MEMBER, 'active']);
      expect(text(seen.orderBy![0]).sql).toContain('"effective_date" desc');
      expect(seen.limit).toBe(10);
    });

    it("runs on the executor it is given, never on a handle of its own", async () => {
      const { executor } = fakeExecutor([assignment()]);
      await DuesCalculationEngine.calculateMemberDues({ organizationId: ORG, memberId: MEMBER, ...period }, executor);
      expect((executor as unknown as { select: ReturnType<typeof vi.fn> }).select).toHaveBeenCalledTimes(1);
    });

    it('refuses a period that ends before it starts', async () => {
      const { executor } = fakeExecutor([assignment()]);
      await expect(
        DuesCalculationEngine.calculateMemberDues({ organizationId: ORG, memberId: MEMBER, periodStart: period.periodEnd, periodEnd: period.periodStart }, executor),
      ).rejects.toThrow('Invalid dues calculation period');
    });

    it('lets a failed read fail the calculation: it is never an empty result', async () => {
      const failing = { select: () => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: async () => { throw new Error('permission denied for table dues_assignments'); } }) }) }) }) };
      await expect(
        DuesCalculationEngine.calculateMemberDues({ organizationId: ORG, memberId: MEMBER, ...period }, failing as never),
      ).rejects.toThrow('permission denied');
    });
  });
});
