/**
 * Billing Cycle Service — Unit Tests
 *
 * Tests the PURE static methods:
 *   - calculatePeriodDates (monthly, bi_weekly, weekly, quarterly, annual)
 *   - calculateProRatedAmount (mid-cycle join proration)
 *   - allocateDuesBreakdown (COPE/PAC/Strike Fund allocation)
 *   - getWeeksInPeriod
 *   - getNextBillingDate
 *
 * Tier 1 — Security & Money
 */
import { describe, it, expect } from 'vitest';

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

  it('all parts sum to total (within rounding)', () => {
    const amount = 157.50;
    const b = Service.allocateDuesBreakdown(amount);
    const total = b.duesAmount + b.copeAmount + b.pacAmount + b.strikeFundAmount;
    // Rounding can introduce ±$0.04
    expect(Math.abs(total - amount)).toBeLessThan(0.05);
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

// ─── getWeeksInPeriod (private static) ──────────────────────────────────────

describe('BillingCycleService.getWeeksInPeriod', () => {
  it('returns ~4 for a 30-day month', () => {
    const start = new Date('2025-03-01');
    const end = new Date('2025-03-31');
    const weeks = Service.getWeeksInPeriod(start, end);
    expect(weeks).toBeGreaterThanOrEqual(4);
    expect(weeks).toBeLessThanOrEqual(5);
  });

  it('returns 1 for a 7-day period', () => {
    const start = new Date('2025-03-10');
    const end = new Date('2025-03-17');
    expect(Service.getWeeksInPeriod(start, end)).toBe(1);
  });

  it('returns 2 for a 14-day period', () => {
    const start = new Date('2025-03-10');
    const end = new Date('2025-03-24');
    expect(Service.getWeeksInPeriod(start, end)).toBe(2);
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

  it('annual: advances by 1 year', () => {
    const last = new Date(2025, 0, 1); // Jan 1
    const next = BillingCycleService.getNextBillingDate('annual', last);
    expect(next.getFullYear()).toBe(2026);
  });
});
