/**
 * Multi-Currency Treasury Service — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockSelect } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    select: mockSelect,
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })),
    })),
  },
}));

vi.mock('@/db/schema/domains/infrastructure', () => ({
  currencyExchangeRates: {},
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { MultiCurrencyTreasuryService } from '../multi-currency-treasury-service';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('MultiCurrencyTreasuryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    });
  });

  it('getExchangeRate returns rate from DB', async () => {
    const mockRate = {
      id: 'rate-1',
      baseCurrency: 'USD',
      targetCurrency: 'CAD',
      rate: '1.35',
      effectiveDate: new Date('2026-03-01'),
      source: 'BOC',
    };

    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockRate]),
          }),
        }),
      }),
    });

    const result = await MultiCurrencyTreasuryService.getExchangeRate('USD', 'CAD');
    expect(result).toBeDefined();
  });

  it('getExchangeRate returns 1.0 for same currency', async () => {
    const result = await MultiCurrencyTreasuryService.getExchangeRate('CAD', 'CAD');
    expect(result).toBeDefined();
  });

  it('getExchangeRate returns null when no rate found', async () => {
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    });

    const result = await MultiCurrencyTreasuryService.getExchangeRate('USD', 'JPY');
    expect(result).toBeNull();
  });
});
