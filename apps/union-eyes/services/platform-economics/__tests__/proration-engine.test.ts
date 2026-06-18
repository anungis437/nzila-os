import { describe, expect, it } from 'vitest';

import { calculateProration, prorateModules, prorateSeats } from '../proration-engine';

describe('platform-economics/proration-engine', () => {
  const periodStart = new Date('2025-01-01T00:00:00Z');
  const periodEnd = new Date('2025-01-31T00:00:00Z'); // 30-day period

  describe('calculateProration', () => {
    it('prorates a mid-cycle upgrade by daily granularity', () => {
      // change at day 15 -> 15 days remaining of 30
      const result = calculateProration({
        changeDate: new Date('2025-01-16T00:00:00Z'),
        periodStart,
        periodEnd,
        previousAmountCad: '100.00',
        newAmountCad: '200.00',
      });

      expect(result.totalDays).toBe(30);
      expect(result.daysRemaining).toBe(15);
      expect(result.fractionRemaining).toBe((0.5).toFixed(6));
      expect(result.creditAmountCad).toBe('50.00');
      expect(result.chargeAmountCad).toBe('100.00');
      expect(result.netAmountCad).toBe('50.00');
    });

    it('produces a net credit on a downgrade', () => {
      const result = calculateProration({
        changeDate: new Date('2025-01-16T00:00:00Z'),
        periodStart,
        periodEnd,
        previousAmountCad: '200.00',
        newAmountCad: '100.00',
      });

      expect(result.netAmountCad).toBe('-50.00');
    });

    it('throws when the change date falls outside the billing period', () => {
      expect(() =>
        calculateProration({
          changeDate: new Date('2024-12-31T00:00:00Z'),
          periodStart,
          periodEnd,
          previousAmountCad: '100.00',
          newAmountCad: '200.00',
        }),
      ).toThrow('Change date must be within billing period');

      expect(() =>
        calculateProration({
          changeDate: new Date('2025-02-15T00:00:00Z'),
          periodStart,
          periodEnd,
          previousAmountCad: '100.00',
          newAmountCad: '200.00',
        }),
      ).toThrow('Change date must be within billing period');
    });

    it('throws when the billing period has zero or negative length', () => {
      expect(() =>
        calculateProration({
          changeDate: periodStart,
          periodStart,
          periodEnd: periodStart,
          previousAmountCad: '100.00',
          newAmountCad: '200.00',
        }),
      ).toThrow('Invalid billing period: end must be after start');
    });
  });

  describe('prorateSeats', () => {
    it('prorates added seats from a zero baseline', () => {
      const result = prorateSeats(2, '10.00', new Date('2025-01-16T00:00:00Z'), periodStart, periodEnd);
      // monthly = 20.00, fraction 0.5 -> charge 10.00, credit 0
      expect(result.chargeAmountCad).toBe('10.00');
      expect(result.creditAmountCad).toBe('0.00');
      expect(result.netAmountCad).toBe('10.00');
    });
  });

  describe('prorateModules', () => {
    it('prorates added modules from a zero baseline', () => {
      const result = prorateModules(1, '40.00', new Date('2025-01-16T00:00:00Z'), periodStart, periodEnd);
      // monthly = 40.00, fraction 0.5 -> charge 20.00
      expect(result.chargeAmountCad).toBe('20.00');
      expect(result.netAmountCad).toBe('20.00');
    });
  });
});
