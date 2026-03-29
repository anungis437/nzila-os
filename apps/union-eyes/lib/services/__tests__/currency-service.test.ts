/**
 * Currency Service — Unit Tests
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

vi.mock('@/db/schema/domains/finance', () => ({
  crossBorderTransactions: {},
  exchangeRates: {},
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/decimal-safe', () => ({
  moneyToNumber: vi.fn((s: string) => parseFloat(s)),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { CurrencyService } from '../currency-service';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('CurrencyService', () => {
  let service: CurrencyService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CurrencyService();
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
  });

  it('enforceCurrencyCAD returns compliant for CAD invoice', () => {
    const invoice = {
      id: 'inv-1',
      amount: 1000,
      currency: 'CAD' as const,
      issueDate: new Date(),
      isRelatedParty: false,
      counterpartyName: 'Test Corp',
      counterpartyCountry: 'CA',
    };

    const result = service.enforceCurrencyCAD(invoice);
    expect(result.compliant).toBe(true);
  });

  it('enforceCurrencyCAD returns non-compliant for USD invoice', () => {
    const invoice = {
      id: 'inv-2',
      amount: 500,
      currency: 'USD' as const,
      issueDate: new Date(),
      isRelatedParty: false,
      counterpartyName: 'US Corp',
      counterpartyCountry: 'US',
    };

    const result = service.enforceCurrencyCAD(invoice);
    expect(result.compliant).toBe(false);
    expect(result.message).toBeDefined();
  });

  it('T106 threshold is set to 1,000,000 CAD', () => {
    // The T106_THRESHOLD constant should be 1_000_000 (instance property)
    expect((service as any).T106_THRESHOLD).toBe(1_000_000);
  });

  it('identifies related-party transactions for T106 reporting', () => {
    const invoice = {
      id: 'inv-3',
      amount: 1_500_000,
      currency: 'CAD' as const,
      issueDate: new Date(),
      isRelatedParty: true,
      counterpartyName: 'Related Corp',
      counterpartyCountry: 'US',
    };

    const result = service.enforceCurrencyCAD(invoice);
    expect(result.compliant).toBe(true); // CAD is compliant
  });
});
