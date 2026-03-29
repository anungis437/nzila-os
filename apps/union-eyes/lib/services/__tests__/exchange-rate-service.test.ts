/**
 * Exchange Rate Service — Unit Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  mockLimit: vi.fn(),
  mockOrderBy: vi.fn(),
  mockWhere: vi.fn(),
  mockFrom: vi.fn(),
  mockSelect: vi.fn(),
  mockInsertValues: vi.fn(),
  mockInsert: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    select: mocks.mockSelect.mockReturnValue({
      from: mocks.mockFrom.mockReturnValue({
        where: mocks.mockWhere.mockReturnValue({
          orderBy: mocks.mockOrderBy.mockReturnValue({
            limit: mocks.mockLimit,
          }),
        }),
      }),
    }),
    insert: mocks.mockInsert.mockReturnValue({
      values: mocks.mockInsertValues,
    }),
  },
}));

vi.mock('@/db/schema/domains/infrastructure', () => ({
  currencyExchangeRates: {
    baseCurrency: 'baseCurrency',
    targetCurrency: 'targetCurrency',
    effectiveDate: 'effectiveDate',
    rate: 'rate',
    source: 'source',
  },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { ExchangeRateService } from '../exchange-rate-service';
import { Decimal } from 'decimal.js';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ExchangeRateService', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockLimit.mockResolvedValue([]);
    mocks.mockInsertValues.mockResolvedValue(undefined);
    // Reset select chain
    mocks.mockOrderBy.mockReturnValue({ limit: mocks.mockLimit });
    mocks.mockWhere.mockReturnValue({ orderBy: mocks.mockOrderBy });
    mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
    mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });
    mocks.mockInsert.mockReturnValue({ values: mocks.mockInsertValues });
    globalThis.fetch = mocks.mockFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ── getRate ──────────────────────────────────────────────────────────────

  describe('getRate', () => {
    it('returns 1:1 for same-currency conversion', async () => {
      const rate = await ExchangeRateService.getRate('CAD', 'CAD');
      expect(rate).not.toBeNull();
      expect(rate!.rate.equals(new Decimal(1))).toBe(true);
      expect(rate!.source).toBe('manual');
    });

    it('queries DB and returns rate record', async () => {
      mocks.mockLimit.mockResolvedValue([{
        baseCurrency: 'USD',
        targetCurrency: 'CAD',
        rate: '1.35',
        effectiveDate: new Date('2026-01-15'),
        source: 'BOC',
      }]);

      const rate = await ExchangeRateService.getRate('USD', 'CAD');
      expect(rate).not.toBeNull();
      expect(rate!.rate.equals(new Decimal('1.35'))).toBe(true);
      expect(rate!.source).toBe('BOC');
    });

    it('returns null when no rate found', async () => {
      mocks.mockLimit.mockResolvedValue([]);

      const rate = await ExchangeRateService.getRate('USD', 'JPY');
      expect(rate).toBeNull();
    });

    it('uses default source "manual" when source is null', async () => {
      mocks.mockLimit.mockResolvedValue([{
        baseCurrency: 'EUR',
        targetCurrency: 'CAD',
        rate: '1.47',
        effectiveDate: new Date('2026-01-15'),
        source: null,
      }]);

      const rate = await ExchangeRateService.getRate('EUR', 'CAD');
      expect(rate!.source).toBe('manual');
    });
  });

  // ── convertAmount ────────────────────────────────────────────────────────

  describe('convertAmount', () => {
    it('calculates converted amount correctly', async () => {
      mocks.mockLimit.mockResolvedValue([{
        baseCurrency: 'USD',
        targetCurrency: 'CAD',
        rate: '1.35',
        effectiveDate: new Date('2026-01-15'),
        source: 'BOC',
      }]);

      const result = await ExchangeRateService.convertAmount(
        new Decimal('100'),
        'USD',
        'CAD'
      );
      expect(result.convertedAmount.equals(new Decimal('135'))).toBe(true);
      expect(result.fromCurrency).toBe('USD');
      expect(result.toCurrency).toBe('CAD');
      expect(result.rate.equals(new Decimal('1.35'))).toBe(true);
    });

    it('throws when rate not available', async () => {
      mocks.mockLimit.mockResolvedValue([]);

      await expect(
        ExchangeRateService.convertAmount(new Decimal('100'), 'XYZ', 'CAD')
      ).rejects.toThrow('Cannot convert XYZ to CAD');
    });
  });

  // ── saveRate ─────────────────────────────────────────────────────────────

  describe('saveRate', () => {
    it('inserts rate record into database', async () => {
      const rate = new Decimal('1.35');
      const date = new Date('2026-01-15');

      const result = await ExchangeRateService.saveRate(
        'org-1', 'USD', 'CAD', rate, date, 'BOC'
      );

      expect(mocks.mockInsert).toHaveBeenCalled();
      expect(mocks.mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({
        organizationId: 'org-1',
        baseCurrency: 'USD',
        targetCurrency: 'CAD',
        rate: '1.35',
        source: 'BOC',
      }));
      expect(result.baseCurrency).toBe('USD');
      expect(result.targetCurrency).toBe('CAD');
      expect(result.rate.equals(rate)).toBe(true);
    });

    it('defaults source to manual', async () => {
      const result = await ExchangeRateService.saveRate(
        'org-1', 'EUR', 'CAD', new Decimal('1.47'), new Date()
      );
      expect(result.source).toBe('manual');
    });
  });

  // ── fetchBOCRates ────────────────────────────────────────────────────────

  describe('fetchBOCRates', () => {
    it('fetches and saves BOC rates', async () => {
      mocks.mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          observations: [{ d: '2026-03-01', FXUSDCAD: { v: '1.34' } }],
        }),
      });

      await ExchangeRateService.fetchBOCRates('org-1');

      // Should call insert for each currency pair (CAD→X and X→CAD)
      expect(mocks.mockInsertValues).toHaveBeenCalled();
    });

    it('skips currencies with failed API calls', async () => {
      mocks.mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Server Error',
      });

      // Should not throw — logs warning and continues
      await ExchangeRateService.fetchBOCRates('org-1');
      expect(mocks.mockInsertValues).not.toHaveBeenCalled();
    });

    it('skips currencies with no observations', async () => {
      mocks.mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ observations: [] }),
      });

      await ExchangeRateService.fetchBOCRates('org-1');
      expect(mocks.mockInsertValues).not.toHaveBeenCalled();
    });

    it('handles fetch errors for individual currencies', async () => {
      mocks.mockFetch.mockRejectedValue(new Error('Network error'));

      // Should not throw the outer error for individual currencies
      await ExchangeRateService.fetchBOCRates('org-1');
    });
  });

  // ── getHistory ───────────────────────────────────────────────────────────

  describe('getHistory', () => {
    it('returns historical rate entries', async () => {
      // For getHistory, the chain is select().from().where().orderBy() — no .limit()
      const records = [
        { effectiveDate: new Date('2026-01-10'), rate: '1.34', source: 'BOC' },
        { effectiveDate: new Date('2026-01-11'), rate: '1.35', source: 'BOC' },
      ];
      mocks.mockOrderBy.mockResolvedValue(records);

      const history = await ExchangeRateService.getHistory(
        'USD', 'CAD', new Date('2026-01-01'), new Date('2026-01-31')
      );

      expect(history).toHaveLength(2);
      expect(history[0].rate).toBeInstanceOf(Decimal);
      expect(history[0].source).toBe('BOC');
    });

    it('returns empty array when no records', async () => {
      mocks.mockOrderBy.mockResolvedValue([]);

      const history = await ExchangeRateService.getHistory(
        'GBP', 'CAD', new Date('2026-01-01'), new Date('2026-01-31')
      );

      expect(history).toHaveLength(0);
    });
  });

  // ── getAverageRate ───────────────────────────────────────────────────────

  describe('getAverageRate', () => {
    it('calculates average rate from history', async () => {
      mocks.mockOrderBy.mockResolvedValue([
        { effectiveDate: new Date('2026-01-10'), rate: '1.30', source: 'BOC' },
        { effectiveDate: new Date('2026-01-11'), rate: '1.40', source: 'BOC' },
      ]);

      const avg = await ExchangeRateService.getAverageRate(
        'USD', 'CAD', new Date('2026-01-01'), new Date('2026-01-31')
      );

      expect(avg).not.toBeNull();
      expect(avg!.equals(new Decimal('1.35'))).toBe(true);
    });

    it('returns null when no history', async () => {
      mocks.mockOrderBy.mockResolvedValue([]);

      const avg = await ExchangeRateService.getAverageRate(
        'USD', 'JPY', new Date('2026-01-01'), new Date('2026-01-31')
      );

      expect(avg).toBeNull();
    });
  });

  // ── Static utility methods ───────────────────────────────────────────────

  describe('isSupportedCurrency', () => {
    it.each(['CAD', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CHF', 'CNY'])(
      'returns true for %s', (currency) => {
        expect(ExchangeRateService.isSupportedCurrency(currency)).toBe(true);
      }
    );

    it('returns true for lowercase input', () => {
      expect(ExchangeRateService.isSupportedCurrency('usd')).toBe(true);
    });

    it('returns false for unsupported currency', () => {
      expect(ExchangeRateService.isSupportedCurrency('XYZ')).toBe(false);
    });
  });

  describe('getSupportedCurrencies', () => {
    it('returns array of 8 currencies', () => {
      const currencies = ExchangeRateService.getSupportedCurrencies();
      expect(currencies).toHaveLength(8);
      expect(currencies).toContain('CAD');
      expect(currencies).toContain('USD');
    });
  });
});
