/**
 * Strike Fund Tax Service — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockSelect, mockDecryptSIN } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockDecryptSIN: vi.fn(() => '123-456-789'),
}));

vi.mock('@/db', () => ({
  db: {
    select: mockSelect,
    insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([]) })) })),
  },
}));

vi.mock('@/db/schema', () => ({
  users: {},
  strikeFundDisbursements: {},
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/encryption', () => ({
  decryptSIN: mockDecryptSIN,
}));

vi.mock('@/lib/decimal-safe', () => ({
  moneyToNumber: vi.fn((s: string) => parseFloat(s)),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { checkStrikePaymentTaxability } from '../strike-fund-tax-service';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('StrikeFundTaxService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDecryptSIN.mockReturnValue('123-456-789');
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
  });

  it('returns requiresT4A=true when payment exceeds weekly threshold ($500)', async () => {
    const result = await checkStrikePaymentTaxability('member-1', 600);
    expect(result.requiresT4A).toBe(true);
    expect(result.threshold).toBe(500);
  });

  it('returns requiresT4A=false when payment is below weekly threshold', async () => {
    // Mock no previous disbursements so annual total is also below threshold
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    const result = await checkStrikePaymentTaxability('member-1', 300);
    expect(result.requiresT4A).toBe(false);
  });

  it('handles yearly accumulation check', async () => {
    // Mock annual total near threshold
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ total: '25500' }]),
      }),
    });

    const result = await checkStrikePaymentTaxability('member-1', 400);
    // $400 weekly is under $500, but annual + 400 = 25900 still under 26000
    expect(result).toBeDefined();
    expect(result.requiresT4A).toBe(false);
  });

  it('detects annual threshold breach', async () => {
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ total: '25800' }]),
      }),
    });

    const result = await checkStrikePaymentTaxability('member-1', 400);
    // $400 weekly is under $500, but annual + 400 = 26200 > 26000
    expect(result.requiresT4A).toBe(true);
  });
});
