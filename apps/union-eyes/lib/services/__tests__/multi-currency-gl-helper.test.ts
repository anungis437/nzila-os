import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Decimal } from 'decimal.js';

const mockConvertAmount = vi.hoisted(() => vi.fn());
const mockGetRate = vi.hoisted(() => vi.fn());

vi.mock('../exchange-rate-service', () => ({
  ExchangeRateService: {
    convertAmount: mockConvertAmount,
    getRate: mockGetRate,
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { MultiCurrencyGLHelper, type MultiCurrencyLine } from '../multi-currency-gl-helper';

describe('MultiCurrencyGLHelper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConvertAmount.mockReset();
    mockGetRate.mockReset();
  });

  describe('convertLineToReportingCurrency', () => {
    it('returns same amounts when currency matches reporting currency', async () => {
      const line: MultiCurrencyLine = {
        accountCode: '4100',
        debitAmount: new Decimal('1000.00'),
        creditAmount: new Decimal('0'),
        currency: 'CAD',
      };

      const result = await MultiCurrencyGLHelper.convertLineToReportingCurrency(
        line, 'CAD', new Date('2026-03-01')
      );

      expect(result.debitAmount.equals(new Decimal('1000.00'))).toBe(true);
      expect(result.creditAmount.equals(new Decimal('0'))).toBe(true);
      expect(result.exchangeRate.equals(new Decimal(1))).toBe(true);
    });

    it('converts amounts using exchange rate when currencies differ', async () => {
      mockConvertAmount.mockResolvedValue({
        rate: new Decimal('1.35'),
        convertedAmount: new Decimal('1.35'),
      });

      const line: MultiCurrencyLine = {
        accountCode: '4100',
        debitAmount: new Decimal('1000.00'),
        creditAmount: new Decimal('0'),
        currency: 'USD',
      };

      const result = await MultiCurrencyGLHelper.convertLineToReportingCurrency(
        line, 'CAD', new Date('2026-03-01')
      );

      expect(result.exchangeRate.equals(new Decimal('1.35'))).toBe(true);
      expect(result.debitAmount.equals(new Decimal('1350.00'))).toBe(true);
      expect(result.conversionCurrency).toBe('USD');
    });

    it('throws on conversion error', async () => {
      mockConvertAmount.mockRejectedValue(new Error('Rate not available'));

      const line: MultiCurrencyLine = {
        accountCode: '4100',
        debitAmount: new Decimal('500.00'),
        creditAmount: new Decimal('0'),
        currency: 'EUR',
      };

      await expect(
        MultiCurrencyGLHelper.convertLineToReportingCurrency(
          line, 'CAD', new Date('2026-03-01')
        )
      ).rejects.toThrow('Rate not available');
    });
  });

  describe('revalueAccount', () => {
    it('calculates revaluation with gain/loss', async () => {
      mockGetRate.mockResolvedValue({
        rate: new Decimal('1.40'),
        effectiveDate: new Date('2026-03-01'),
      });

      const result = await MultiCurrencyGLHelper.revalueAccount(
        '1200', // accountCode
        new Decimal('10000'), // balance in USD
        'USD', // account currency
        'CAD', // reporting currency
        new Date('2026-03-01'),
        new Decimal('1.35'), // previous rate
      );

      expect(result.accountCode).toBe('1200');
      expect(result.revaluedBalance.equals(new Decimal('14000'))).toBe(true);
      // Gain = 14000 - 13500 = 500
      expect(result.gainLoss.equals(new Decimal('500'))).toBe(true);
    });

    it('throws when rate not available', async () => {
      mockGetRate.mockResolvedValue(null);

      await expect(
        MultiCurrencyGLHelper.revalueAccount(
          '1200', new Decimal('10000'), 'GBP', 'CAD', new Date('2026-03-01')
        )
      ).rejects.toThrow('rate not available');
    });
  });
});
