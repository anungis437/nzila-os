/**
 * Billing Cycle Service — Unit Tests
 *
 * Tests the PURE static methods:
 *   - calculatePeriodDates (monthly, bi_weekly, weekly, quarterly, annual)
 *   - calculateProRatedAmount (mid-cycle join proration)
 *   - allocateDuesBreakdown (COPE/PAC/Strike Fund allocation)
 *   - getNextBillingDate
 * and, with the dues engine and the cycle's transaction stubbed, what makes the charge of one member:
 *   - processMemberBilling (the amount is the member's dues assignment; a member already charged for the period is skipped)
 *   - generateBillingCycle (hands each member whether the period is already charged to them)
 *
 * Tier 1 — Security & Money
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

const cycleMocks = vi.hoisted(() => ({ withRLSContext: vi.fn(), requireLiveFinancialMandate: vi.fn() }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: cycleMocks.withRLSContext }));
vi.mock('@/lib/finance/require-live-financial-mandate', () => ({ requireLiveFinancialMandate: cycleMocks.requireLiveFinancialMandate }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { DuesCalculationEngine } from '@/lib/dues-calculation-engine';
import { BillingCycleService, type BillingFrequency } from '../services/billing-cycle-service';

// Access private static methods via type-casting — purely for testing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Service = BillingCycleService as any;

// ─── calculatePeriodDates ────────────────────────────────────────────────────

describe('BillingCycleService.calculatePeriodDates', () => {
  describe('monthly', () => {
    it('returns first and last day of the month', () => {
      // March 15, 2025
      const ref = new Date(2025, 2, 15);
      const { periodStart, periodEnd } = BillingCycleService.calculatePeriodDates('monthly', ref);
      expect(periodStart.getDate()).toBe(1);
      expect(periodStart.getMonth()).toBe(2); // March
      expect(periodEnd.getDate()).toBe(31); // March has 31 days
      expect(periodEnd.getMonth()).toBe(2);
    });

    it('handles February correctly (non-leap year)', () => {
      const ref = new Date(2025, 1, 10); // Feb 2025
      const { periodEnd } = BillingCycleService.calculatePeriodDates('monthly', ref);
      expect(periodEnd.getDate()).toBe(28);
    });

    it('handles February in leap year', () => {
      const ref = new Date(2024, 1, 10); // Feb 2024 (leap year)
      const { periodEnd } = BillingCycleService.calculatePeriodDates('monthly', ref);
      expect(periodEnd.getDate()).toBe(29);
    });
  });

  describe('weekly', () => {
    it('returns Monday to Sunday', () => {
      // Wednesday March 19, 2025
      const ref = new Date(2025, 2, 19);
      const { periodStart, periodEnd } = BillingCycleService.calculatePeriodDates('weekly', ref);
      expect(periodStart.getDay()).toBe(1); // Monday
      expect(periodEnd.getDay()).toBe(0); // Sunday
    });

    it('span covers Mon through Sun', () => {
      const ref = new Date(2025, 2, 19);
      const { periodStart, periodEnd } = BillingCycleService.calculatePeriodDates('weekly', ref);
      const diffDays = Math.round((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
      // Mon 00:00 to Sun 23:59 ≈ 7 days
      expect(diffDays).toBeGreaterThanOrEqual(6);
      expect(diffDays).toBeLessThanOrEqual(7);
    });
  });

  describe('bi_weekly', () => {
    it('span covers 2 weeks', () => {
      const ref = new Date(2025, 2, 19);
      const { periodStart, periodEnd } = BillingCycleService.calculatePeriodDates('bi_weekly', ref);
      const diffDays = Math.round((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
      // Mon 00:00 to Sun+1wk 23:59 ≈ 14 days
      expect(diffDays).toBeGreaterThanOrEqual(13);
      expect(diffDays).toBeLessThanOrEqual(14);
    });

    it('starts on Monday', () => {
      const ref = new Date(2025, 2, 19);
      const { periodStart } = BillingCycleService.calculatePeriodDates('bi_weekly', ref);
      expect(periodStart.getDay()).toBe(1); // Monday
    });
  });

  it('weekly: a Sunday on the first of a month ends that Sunday, not four weeks later', () => {
    const { periodStart, periodEnd } = BillingCycleService.calculatePeriodDates('weekly', new Date(2026, 2, 1));
    expect([periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate()]).toEqual([2026, 1, 23]);
    expect([periodEnd.getFullYear(), periodEnd.getMonth(), periodEnd.getDate()]).toEqual([2026, 2, 1]);
  });

  it('biweekly: a Sunday on the first of a month ends thirteen days after the prior Monday', () => {
    const { periodStart, periodEnd } = BillingCycleService.calculatePeriodDates('bi_weekly', new Date(2026, 2, 1));
    expect([periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate()]).toEqual([2026, 1, 23]);
    expect([periodEnd.getFullYear(), periodEnd.getMonth(), periodEnd.getDate()]).toEqual([2026, 2, 8]);
  });

  describe('quarterly', () => {
    it('Q1 reference returns Jan 1 - Mar 31', () => {
      const ref = new Date(2025, 1, 15); // Feb = Q1
      const { periodStart, periodEnd } = BillingCycleService.calculatePeriodDates('quarterly', ref);
      expect(periodStart.getMonth()).toBe(0); // January
      expect(periodStart.getDate()).toBe(1);
      expect(periodEnd.getMonth()).toBe(2); // March
      expect(periodEnd.getDate()).toBe(31);
    });

    it('Q3 reference returns Jul 1 - Sep 30', () => {
      const ref = new Date(2025, 7, 1); // Aug = Q3
      const { periodStart, periodEnd } = BillingCycleService.calculatePeriodDates('quarterly', ref);
      expect(periodStart.getMonth()).toBe(6); // July
      expect(periodEnd.getMonth()).toBe(8); // September
      expect(periodEnd.getDate()).toBe(30);
    });
  });

  describe('annual', () => {
    it('returns Jan 1 to Dec 31', () => {
      const ref = new Date(2025, 5, 15);
      const { periodStart, periodEnd } = BillingCycleService.calculatePeriodDates('annual', ref);
      expect(periodStart.getMonth()).toBe(0);
      expect(periodStart.getDate()).toBe(1);
      expect(periodEnd.getMonth()).toBe(11);
      expect(periodEnd.getDate()).toBe(31);
    });
  });

  it('keeps month-end January 31 inside January rather than rolling into March', () => {
    const { periodStart, periodEnd } = BillingCycleService.calculatePeriodDates('monthly', new Date(2025, 0, 31));
    expect([periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate()]).toEqual([2025, 0, 1]);
    expect([periodEnd.getFullYear(), periodEnd.getMonth(), periodEnd.getDate()]).toEqual([2025, 0, 31]);
  });

  it('keeps May 31 inside Q2 with an April 1 start', () => {
    const { periodStart, periodEnd } = BillingCycleService.calculatePeriodDates('quarterly', new Date(2026, 4, 31));
    expect([periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate()]).toEqual([2026, 3, 1]);
    expect([periodEnd.getFullYear(), periodEnd.getMonth(), periodEnd.getDate()]).toEqual([2026, 5, 30]);
  });

  it('keeps December 31 inside Q4 rather than rolling into the following year', () => {
    const { periodStart, periodEnd } = BillingCycleService.calculatePeriodDates('quarterly', new Date(2026, 11, 31));
    expect([periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate()]).toEqual([2026, 9, 1]);
    expect([periodEnd.getFullYear(), periodEnd.getMonth(), periodEnd.getDate()]).toEqual([2026, 11, 31]);
  });

  it('rejects invalid reference dates before deriving financial boundaries', () => {
    expect(() => BillingCycleService.calculatePeriodDates('monthly', new Date(NaN))).toThrow('Invalid billing reference date');
  });

  it('throws for unsupported frequency', () => {
    expect(() =>
      BillingCycleService.calculatePeriodDates('daily' as BillingFrequency),
    ).toThrow('Unsupported billing frequency');
  });
});

// ─── calculateProRatedAmount (private static, accessed via casting) ──────────

describe('BillingCycleService.calculateProRatedAmount', () => {
  const periodStart = new Date('2025-03-01');
  const periodEnd = new Date('2025-03-31');
  const fullAmount = 100;

  it('returns full amount if joinedAt is null', () => {
    const result = Service.calculateProRatedAmount(fullAmount, null, periodStart, periodEnd);
    expect(result.amount).toBe(100);
    expect(result.isProRated).toBe(false);
  });

  it('returns full amount if joined before period start', () => {
    const joinedAt = new Date('2025-01-15');
    const result = Service.calculateProRatedAmount(fullAmount, joinedAt, periodStart, periodEnd);
    expect(result.amount).toBe(100);
    expect(result.isProRated).toBe(false);
  });

  it('returns full amount if joined on period start', () => {
    const result = Service.calculateProRatedAmount(fullAmount, periodStart, periodStart, periodEnd);
    expect(result.amount).toBe(100);
    expect(result.isProRated).toBe(false);
  });

  it('returns 0 if joined after period end', () => {
    const joinedAt = new Date('2025-04-05');
    const result = Service.calculateProRatedAmount(fullAmount, joinedAt, periodStart, periodEnd);
    expect(result.amount).toBe(0);
    expect(result.isProRated).toBe(true);
  });

  it('pro-rates correctly for mid-cycle join', () => {
    const joinedAt = new Date('2025-03-16'); // roughly halfway
    const result = Service.calculateProRatedAmount(fullAmount, joinedAt, periodStart, periodEnd);
    expect(result.isProRated).toBe(true);
    // 15 days active out of 30 total → ~50
    expect(result.amount).toBeGreaterThan(40);
    expect(result.amount).toBeLessThan(60);
  });

  it('rounds to 2 decimal places', () => {
    const joinedAt = new Date('2025-03-20');
    const result = Service.calculateProRatedAmount(99.99, joinedAt, periodStart, periodEnd);
    const decimals = result.amount.toString().split('.')[1] || '';
    expect(decimals.length).toBeLessThanOrEqual(2);
  });

  it('includes both the joining day and final day in a 31-day period', () => {
    const start = new Date('2026-03-01T00:00:00.000Z');
    const end = new Date('2026-03-31T23:59:59.999Z');
    expect(Service.calculateProRatedAmount(31, new Date('2026-03-31T12:00:00Z'), start, end))
      .toEqual({ amount: 1, isProRated: true });
    expect(Service.calculateProRatedAmount(31, new Date('2026-03-16T23:00:00Z'), start, end))
      .toEqual({ amount: 16, isProRated: true });
    expect(Service.calculateProRatedAmount(31, new Date('2026-04-01T00:00:00Z'), start, end))
      .toEqual({ amount: 0, isProRated: true });
  });

  it('counts leap-day joins and spring DST transitions by calendar day, not elapsed hours', () => {
    const leapStart = new Date('2024-02-01T00:00:00Z');
    const leapEnd = new Date('2024-02-29T23:59:59.999Z');
    expect(Service.calculateProRatedAmount(29, new Date('2024-02-29T15:00:00Z'), leapStart, leapEnd).amount).toBe(1);
    const dstStart = new Date('2026-03-01T00:00:00Z');
    const dstEnd = new Date('2026-03-31T23:59:59.999Z');
    expect(Service.calculateProRatedAmount(31, new Date('2026-03-08T07:00:00Z'), dstStart, dstEnd).amount).toBe(24);
  });

  it('refuses invalid proration dates rather than returning NaN as a charge', () => {
    expect(() => Service.calculateProRatedAmount(100, new Date(NaN), periodStart, periodEnd))
      .toThrow('Invalid dues proration calendar dates');
    expect(() => Service.calculateProRatedAmount(100, new Date('2025-03-20'), periodEnd, periodStart))
      .toThrow('Invalid dues proration calendar dates');
  });
});

// ─── allocateDuesBreakdown (private static, accessed via casting) ────────────

describe('BillingCycleService.allocateDuesBreakdown', () => {
  it('allocates 85/10/3/2 percent split', () => {
    const breakdown = Service.allocateDuesBreakdown(100);
    expect(breakdown.duesAmount).toBe(85);
    expect(breakdown.copeAmount).toBe(10);
    expect(breakdown.pacAmount).toBe(3);
    expect(breakdown.strikeFundAmount).toBe(2);
  });

  it('reconciles every allocated cent to the charge, including sub-dollar amounts', () => {
    for (const amount of [0.01, 0.03, 0.07, 0.11, 1.01, 33.33, 157.50, 999.99]) {
      const b = Service.allocateDuesBreakdown(amount);
      const allocatedCents = [b.duesAmount, b.copeAmount, b.pacAmount, b.strikeFundAmount]
        .reduce((sum: number, component: number) => sum + Math.round(component * 100), 0);
      expect(allocatedCents).toBe(Math.round(amount * 100));
      expect(Object.values(b).every((component) => component >= 0)).toBe(true);
    }
  });

  it('fails closed on invalid, negative or unsafe allocation values', () => {
    for (const amount of [-1, NaN, Infinity, -Infinity]) {
      expect(() => Service.allocateDuesBreakdown(amount)).toThrow('Invalid dues allocation amount');
    }
    expect(() => Service.allocateDuesBreakdown(Number.MAX_SAFE_INTEGER))
      .toThrow('Dues allocation exceeds safe integer cents');
  });

  it('handles 0 amount', () => {
    const b = Service.allocateDuesBreakdown(0);
    expect(b.duesAmount).toBe(0);
    expect(b.copeAmount).toBe(0);
    expect(b.pacAmount).toBe(0);
    expect(b.strikeFundAmount).toBe(0);
  });

  it('rounds each component to 2 decimal places', () => {
    const b = Service.allocateDuesBreakdown(33.33);
    for (const val of [b.duesAmount, b.copeAmount, b.pacAmount, b.strikeFundAmount]) {
      const decimals = val.toString().split('.')[1] || '';
      expect(decimals.length).toBeLessThanOrEqual(2);
    }
  });
});

// ─── processMemberBilling (private static): the charge is the member's dues assignment ──────────────────

describe('BillingCycleService.processMemberBilling', () => {
  const periodStart = new Date('2025-03-01T00:00:00.000Z');
  const periodEnd = new Date('2025-03-31T23:59:59.999Z');
  const member = { id: 'member-1', userId: 'user-1', membershipNumber: 'M-1', status: 'active', joinedAt: new Date('2024-01-01T00:00:00Z') };
  const assignmentResult = {
    amount: 50,
    calculationType: 'assignment' as const,
    assignmentId: 'assignment-1',
    frequency: 'monthly',
    periodStart,
    periodEnd,
    dueDate: new Date('2025-04-15T23:59:59.999Z'),
    breakdown: { baseAmount: 50, flatAmount: 50 },
  };
  const params = { organizationId: 'org-1', member, periodStart, periodEnd, frequency: 'monthly' as const, dryRun: false, alreadyBilled: false };

  // The cycle's transaction: a charge is inserted with `.insert(table).values(row).returning()`
  const cycleTransaction = () => {
    const returning = vi.fn().mockResolvedValue([{ id: 'transaction-1' }]);
    const values = vi.fn(() => ({ returning }));
    return { tx: { insert: vi.fn(() => ({ values })) }, values };
  };

  afterEach(() => vi.restoreAllMocks());

  it('charges the amount of the member\'s dues assignment, asked for in the cycle\'s transaction and on the cycle\'s frequency', async () => {
    const calculate = vi.spyOn(DuesCalculationEngine, 'calculateMemberDues').mockResolvedValue(assignmentResult);
    const { tx, values } = cycleTransaction();

    const result = await Service.processMemberBilling(tx, params);

    expect(calculate).toHaveBeenCalledWith(
      { organizationId: 'org-1', memberId: 'member-1', periodStart, periodEnd, frequency: 'monthly' },
      tx,
    );
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-1',
      memberId: 'member-1',
      assignmentId: 'assignment-1',
      transactionType: 'charge',
      amount: '50',
      totalAmount: '50',
      periodStart: '2025-03-01',
      periodEnd: '2025-03-31',
      dueDate: '2025-04-15',
      status: 'pending',
      metadata: expect.objectContaining({ calculationType: 'assignment', assignmentId: 'assignment-1', assignmentFrequency: 'monthly', isProRated: false }),
    }));
    expect(result).toMatchObject({ success: true, transactionId: 'transaction-1', amount: 50 });
    expect(result.breakdown).toEqual({ duesAmount: 42.5, copeAmount: 5, pacAmount: 1.5, strikeFundAmount: 1 });
  });

  it('prices a charge from the assignment alone, never from wages, hours or employment data', async () => {
    const calculate = vi.spyOn(DuesCalculationEngine, 'calculateMemberDues').mockResolvedValue(assignmentResult);
    const { tx } = cycleTransaction();

    await Service.processMemberBilling(tx, { ...params, member: { ...member, grossWages: '90000', hourlyRate: '40', regularHoursPerWeek: '37.5' } });

    expect(Object.keys(calculate.mock.calls[0][0]).sort()).toEqual(['frequency', 'memberId', 'organizationId', 'periodEnd', 'periodStart']);
  });

  it('pro-rates the assignment amount for a member who joined mid-cycle and records why', async () => {
    vi.spyOn(DuesCalculationEngine, 'calculateMemberDues').mockResolvedValue({ ...assignmentResult, amount: 31 });
    const { tx, values } = cycleTransaction();

    const result = await Service.processMemberBilling(tx, { ...params, member: { ...member, joinedAt: new Date('2025-03-16T12:00:00Z') } });

    expect(result.amount).toBe(16);
    expect(values).toHaveBeenCalledWith(expect.objectContaining({
      amount: '16',
      metadata: expect.objectContaining({ isProRated: true, proRatedReason: expect.stringContaining('Joined') }),
    }));
  });

  it('skips a member already charged for the period without calculating or writing, so a second run bills nobody twice', async () => {
    const calculate = vi.spyOn(DuesCalculationEngine, 'calculateMemberDues');
    const { tx } = cycleTransaction();

    const result = await Service.processMemberBilling(tx, { ...params, alreadyBilled: true });

    expect(result).toMatchObject({ memberId: 'member-1', success: true, skipped: true, skipReason: 'Already billed for this period' });
    expect(calculate).not.toHaveBeenCalled();
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it('skips a member who has no dues assignment on the cycle\'s frequency, writing nothing', async () => {
    vi.spyOn(DuesCalculationEngine, 'calculateMemberDues').mockResolvedValue(null);
    const { tx } = cycleTransaction();

    const result = await Service.processMemberBilling(tx, params);

    expect(result).toMatchObject({ success: true, skipped: true, skipReason: 'No active dues assignment' });
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it('skips a member who is not active, before any dues are calculated', async () => {
    const calculate = vi.spyOn(DuesCalculationEngine, 'calculateMemberDues');
    const { tx } = cycleTransaction();

    const result = await Service.processMemberBilling(tx, { ...params, member: { ...member, status: 'suspended' } });

    expect(result).toMatchObject({ success: true, skipped: true, skipReason: 'Member status is suspended' });
    expect(calculate).not.toHaveBeenCalled();
  });

  it('writes nothing in a preview but reports the amount and its allocation', async () => {
    vi.spyOn(DuesCalculationEngine, 'calculateMemberDues').mockResolvedValue(assignmentResult);
    const { tx } = cycleTransaction();

    const result = await Service.processMemberBilling(tx, { ...params, dryRun: true });

    expect(tx.insert).not.toHaveBeenCalled();
    expect(result).toMatchObject({ success: true, amount: 50 });
    expect(result.transactionId).toBeUndefined();
  });
});

// ─── generateBillingCycle: a charge already made for the period is not made again ────────────────────────

describe('BillingCycleService.generateBillingCycle idempotency', () => {
  const cycle = {
    organizationId: '11111111-1111-4111-8111-111111111111',
    executedBy: '22222222-2222-4222-8222-222222222222',
    frequency: 'monthly' as const,
    periodStart: new Date('2026-10-01T00:00:00.000Z'),
    periodEnd: new Date('2026-10-31T23:59:59.999Z'),
  };

  afterEach(() => vi.restoreAllMocks());

  it('hands each member the fact of whether the period is already charged to them', async () => {
    const tx = { marker: 'cycle-transaction' };
    cycleMocks.withRLSContext.mockImplementation(async (_scope: unknown, fn: (t: unknown) => Promise<unknown>) => fn(tx));
    cycleMocks.requireLiveFinancialMandate.mockResolvedValue({ id: 'live-mandate' });
    vi.spyOn(Service, 'getActiveMembersForBilling').mockResolvedValue([{ id: 'member-1' }, { id: 'member-2' }]);
    const billed = vi.spyOn(Service, 'getMembersBilledForPeriod').mockResolvedValue(new Set(['member-1']));
    const process = vi.spyOn(Service, 'processMemberBilling').mockImplementation(async (_tx: unknown, p: { member: { id: string }; alreadyBilled: boolean }) =>
      p.alreadyBilled
        ? { memberId: p.member.id, success: true, skipped: true, skipReason: 'Already billed for this period' }
        : { memberId: p.member.id, success: true, amount: 10, breakdown: { duesAmount: 8.5, copeAmount: 1, pacAmount: 0.3, strikeFundAmount: 0.2 } });

    const result = await BillingCycleService.generateBillingCycle(cycle);

    expect(billed).toHaveBeenCalledWith(tx, cycle.organizationId, cycle.periodStart, cycle.periodEnd);
    expect(process).toHaveBeenCalledTimes(2);
    expect(process.mock.calls.map(([, p]) => [p.member.id, p.alreadyBilled])).toEqual([['member-1', true], ['member-2', false]]);
    expect(result.transactionsCreated).toBe(1);
    expect(result.members.skipped).toBe(1);
    expect(result.totalAmount).toBe(10);
  });
});

// ─── getNextBillingDate ─────────────────────────────────────────────────────

describe('BillingCycleService.getNextBillingDate', () => {
  it('monthly: advances by 1 month', () => {
    const last = new Date(2025, 2, 15); // March 15
    const next = BillingCycleService.getNextBillingDate('monthly', last);
    expect(next.getMonth()).toBe(3); // April
    expect(next.getDate()).toBe(15);
  });

  it('bi_weekly: advances by 14 days', () => {
    const last = new Date(2025, 2, 1); // March 1
    const next = BillingCycleService.getNextBillingDate('bi_weekly', last);
    expect(next.getDate()).toBe(15);
  });

  it('weekly: advances by 7 days', () => {
    const last = new Date(2025, 2, 10); // March 10
    const next = BillingCycleService.getNextBillingDate('weekly', last);
    expect(next.getDate()).toBe(17);
  });

  it('quarterly: advances by 3 months', () => {
    const last = new Date(2025, 0, 1); // Jan 1
    const next = BillingCycleService.getNextBillingDate('quarterly', last);
    expect(next.getMonth()).toBe(3); // April
  });

  it('monthly: clamps Jan 31 to Feb 28 rather than skipping February', () => {
    const next = BillingCycleService.getNextBillingDate('monthly', new Date(2025, 0, 31));
    expect([next.getFullYear(), next.getMonth(), next.getDate()]).toEqual([2025, 1, 28]);
  });

  it('monthly: preserves Feb 29 in a leap year', () => {
    const next = BillingCycleService.getNextBillingDate('monthly', new Date(2024, 0, 31));
    expect([next.getFullYear(), next.getMonth(), next.getDate()]).toEqual([2024, 1, 29]);
  });

  it('quarterly: clamps Jan 31 to Apr 30', () => {
    const next = BillingCycleService.getNextBillingDate('quarterly', new Date(2025, 0, 31));
    expect([next.getFullYear(), next.getMonth(), next.getDate()]).toEqual([2025, 3, 30]);
  });

  it('annual: clamps a leap-day anniversary rather than rolling into March', () => {
    const next = BillingCycleService.getNextBillingDate('annual', new Date(2024, 1, 29));
    expect([next.getFullYear(), next.getMonth(), next.getDate()]).toEqual([2025, 1, 28]);
  });

  it('rejects an invalid recurrence date or unsupported frequency', () => {
    expect(() => BillingCycleService.getNextBillingDate('monthly', new Date(NaN))).toThrow('Invalid last billing date');
    expect(() => BillingCycleService.getNextBillingDate('daily' as BillingFrequency, new Date(2025, 0, 1))).toThrow('Unsupported billing frequency');
  });

  it('annual: advances by 1 year', () => {
    const last = new Date(2025, 0, 1); // Jan 1
    const next = BillingCycleService.getNextBillingDate('annual', last);
    expect(next.getFullYear()).toBe(2026);
  });
});
