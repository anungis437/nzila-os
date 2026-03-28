/**
 * Exchange Rate Service — Unit Tests
 *
 * Tests:
 *   - getRate returns same-currency as 1:1
 *   - getRate queries DB for cross-currency rate
 *   - convertAmount calculates correctly
 *   - getRate returns null for missing rate
 *
 * NOTE: imports from `@/db` (not `@/db/db`)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockLimit } = vi.hoisted(() => ({
  mockLimit: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: mockLimit,
          })),
        })),
      })),
    })),
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
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockResolvedValue([]);
  });

  it('getRate returns 1:1 for same-currency conversion', async () => {
    const rate = await ExchangeRateService.getRate('CAD', 'CAD');
    expect(rate).not.toBeNull();
    expect(rate!.rate.equals(new Decimal(1))).toBe(true);
    expect(rate!.source).toBe('manual');
  });

  it('getRate queries DB and returns rate record', async () => {
    mockLimit.mockResolvedValue([{
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

  it('getRate returns null when no rate found', async () => {
    mockLimit.mockResolvedValue([]);

    const rate = await ExchangeRateService.getRate('USD', 'JPY');
    expect(rate).toBeNull();
  });

  it('convertAmount uses retrieved rate', async () => {
    mockLimit.mockResolvedValue([{
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
    expect(result).not.toBeNull();
    expect(result!.convertedAmount.equals(new Decimal('135'))).toBe(true);
  });
});
