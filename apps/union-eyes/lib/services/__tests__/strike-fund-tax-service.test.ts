/**
 * Strike Fund Tax Service — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  usersFindFirst: vi.fn(),
  mockSelect: vi.fn(),
  mockDecryptSIN: vi.fn(() => '123-456-789'),
}));

function chain(resolveValue: any): any {
  const handler: ProxyHandler<object> = {
    get: (_target, prop) => {
      if (prop === 'then') return (resolve: (v: any) => void) => resolve(resolveValue);
      return vi.fn(() => new Proxy({}, handler));
    },
  };
  return new Proxy({}, handler);
}

// failChain: causes .catch(cb) callbacks to fire, mimicking a rejected DB chain
function failChain(): any {
  const err = new Error('DB error');
  const handler: ProxyHandler<object> = {
    get: (_target, prop) => {
      if (prop === 'then') {
        return (_onFulfilled: any, onRejected?: (e: Error) => void) =>
          onRejected ? Promise.resolve(onRejected(err)) : Promise.reject(err);
      }
      if (prop === 'catch') return (cb: (e: Error) => any) => chain(cb(err));
      return vi.fn(() => new Proxy({}, handler));
    },
  };
  return new Proxy({}, handler);
}

vi.mock('@/db', () => ({
  db: {
    query: {
      users: { findFirst: mocks.usersFindFirst },
    },
    select: mocks.mockSelect,
  },
}));

vi.mock('@/db/schema', () => ({
  users: { userId: 'userId' },
  strikeFundDisbursements: {
    userId: 'userId', paymentAmount: 'paymentAmount', taxYear: 'taxYear',
    province: 'province',
  },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/encryption', () => ({
  decryptSIN: mocks.mockDecryptSIN,
}));

vi.mock('@/lib/decimal-safe', () => ({
  moneyToNumber: vi.fn((s: any) => Number(s)),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import {
  checkStrikePaymentTaxability,
  generateT4A,
  generateRL1,
  processYearEndTaxSlips,
  getTaxFilingStatus,
  generateStrikeFundTaxReport,
} from '../strike-fund-tax-service';

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeMember = (overrides = {}) => ({
  userId: 'member-1', displayName: 'Alice Jones', firstName: 'Alice',
  lastName: 'Jones', email: 'alice@example.com', encryptedSin: 'enc-sin-123',
  ...overrides,
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('StrikeFundTaxService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockDecryptSIN.mockReturnValue('123-456-789');
    // Default: no payments found
    mocks.mockSelect.mockReturnValue(chain([{ totalAmount: 0 }]));
    mocks.usersFindFirst.mockResolvedValue(makeMember());
  });

  // ── checkStrikePaymentTaxability ───────────────────────────────────────────
  describe('checkStrikePaymentTaxability', () => {
    it('returns requiresT4A=true when payment exceeds weekly $500', async () => {
      const result = await checkStrikePaymentTaxability('member-1', 600);
      expect(result.requiresT4A).toBe(true);
      expect(result.threshold).toBe(500);
    });

    it('returns requiresT4A=false when below thresholds', async () => {
      mocks.mockSelect.mockReturnValue(chain([{ totalAmount: 0 }]));
      const result = await checkStrikePaymentTaxability('member-1', 300);
      expect(result.requiresT4A).toBe(false);
    });

    it('detects annual threshold breach ($26,000)', async () => {
      mocks.mockSelect.mockReturnValue(chain([{ totalAmount: 27000 }]));
      const result = await checkStrikePaymentTaxability('member-1', 400);
      expect(result.requiresT4A).toBe(true);
    });

    it('below annual threshold is not taxable', async () => {
      mocks.mockSelect.mockReturnValue(chain([{ totalAmount: 25000 }]));
      const result = await checkStrikePaymentTaxability('member-1', 400);
      expect(result.requiresT4A).toBe(false);
    });
  });

  // ── generateT4A ───────────────────────────────────────────────────────────
  describe('generateT4A', () => {
    it('generates T4A slip with member data', async () => {
      mocks.usersFindFirst.mockResolvedValue(makeMember());
      mocks.mockSelect.mockReturnValue(chain([{ totalAmount: 5000 }]));
      mocks.mockDecryptSIN.mockReturnValue('123-456-789');

      const slip = await generateT4A('member-1', 2025);
      expect(slip.slipType).toBe('T4A');
      expect(slip.taxYear).toBe(2025);
      expect(slip.recipientName).toBe('Alice Jones');
      expect(slip.recipientSIN).toBe('123-456-789');
      expect(slip.box028_otherIncome).toBe(5000);
    });

    it('throws when member not found', async () => {
      mocks.usersFindFirst.mockResolvedValue(null);
      await expect(generateT4A('nonexistent', 2025)).rejects.toThrow('not found');
    });

    it('handles SIN decrypt failure', async () => {
      mocks.usersFindFirst.mockResolvedValue(makeMember());
      mocks.mockSelect.mockReturnValue(chain([{ totalAmount: 1000 }]));
      mocks.mockDecryptSIN.mockImplementation(() => { throw new Error('Decrypt fail'); });
      await expect(generateT4A('member-1', 2025)).rejects.toThrow('Unable to decrypt');
    });

    it('handles missing encrypted SIN', async () => {
      mocks.usersFindFirst.mockResolvedValue(makeMember({ encryptedSin: null }));
      mocks.mockSelect.mockReturnValue(chain([{ totalAmount: 1000 }]));
      const slip = await generateT4A('member-1', 2025);
      expect(slip.recipientSIN).toBe('NOT PROVIDED');
    });
  });

  // ── generateRL1 ───────────────────────────────────────────────────────────
  describe('generateRL1', () => {
    it('generates RL-1 slip for Quebec member', async () => {
      mocks.usersFindFirst.mockResolvedValue(makeMember());
      // 1st select: isMemberInQuebec -> QC, 2nd select: getYearlyStrikePay
      mocks.mockSelect
        .mockReturnValueOnce(chain([{ province: 'QC' }]))
        .mockReturnValueOnce(chain([{ totalAmount: 3000 }]));

      const slip = await generateRL1('member-1', 2025);
      expect(slip.slipType).toBe('RL-1');
      expect(slip.caseO_autresRevenus).toBe(3000);
    });

    it('throws when member not in Quebec', async () => {
      mocks.usersFindFirst.mockResolvedValue(makeMember());
      mocks.mockSelect.mockReturnValue(chain([{ province: 'ON' }]));
      await expect(generateRL1('member-1', 2025)).rejects.toThrow('not eligible for RL-1');
    });

    it('throws when member not found', async () => {
      mocks.usersFindFirst.mockResolvedValue(null);
      await expect(generateRL1('nonexistent', 2025)).rejects.toThrow('not found');
    });
  });

  // ── processYearEndTaxSlips ─────────────────────────────────────────────────
  describe('processYearEndTaxSlips', () => {
    it('processes payments and generates slips', async () => {
      // groupBy query returns payments
      mocks.mockSelect.mockReturnValueOnce(chain([
        { userId: 'member-1', totalAmount: 1000, province: 'ON' },
      ]));
      // generateT4A: findFirst + getYearlyStrikePay
      mocks.usersFindFirst.mockResolvedValue(makeMember());
      mocks.mockSelect.mockReturnValueOnce(chain([{ totalAmount: 1000 }]));

      const result = await processYearEndTaxSlips(2025);
      expect(result.processed).toBe(1);
      expect(result.t4aGenerated).toBe(1);
      expect(result.deadline.getFullYear()).toBe(2026);
    });

    it('returns zeros when no payments', async () => {
      mocks.mockSelect.mockReturnValue(chain([]));
      const result = await processYearEndTaxSlips(2025);
      expect(result.processed).toBe(0);
      expect(result.t4aGenerated).toBe(0);
      expect(result.rl1Generated).toBe(0);
    });
  });

  // ── getTaxFilingStatus ─────────────────────────────────────────────────────
  describe('getTaxFilingStatus', () => {
    it('returns status below threshold', async () => {
      mocks.mockSelect.mockReturnValue(chain([{ totalAmount: 300 }]));
      const status = await getTaxFilingStatus('member-1', 2025);
      expect(status.requiresT4A).toBe(false);
      expect(status.deadline.getFullYear()).toBe(2026);
    });

    it('returns status above threshold', async () => {
      // getYearlyStrikePay + isMemberInQuebec
      mocks.mockSelect
        .mockReturnValueOnce(chain([{ totalAmount: 1000 }]))
        .mockReturnValueOnce(chain([{ province: 'QC' }]));
      const status = await getTaxFilingStatus('member-1', 2025);
      expect(status.requiresT4A).toBe(true);
      expect(status.rl1Required).toBe(true);
    });
  });

  // ── generateStrikeFundTaxReport ────────────────────────────────────────────
  describe('generateStrikeFundTaxReport', () => {
    it('returns compliance report', async () => {
      mocks.mockSelect.mockReturnValue(chain([]));
      const report = await generateStrikeFundTaxReport(2025);
      expect(report.deadline).toContain('Feb 28');
      expect(report.t4asGenerated).toBe(0);
    });
  });
  // ── .catch() error-path coverage ────────────────────────────────────────
  describe('catch callbacks (error paths)', () => {
    it('generateT4A .catch(→null) fires when findFirst rejects (line 98)', async () => {
      mocks.usersFindFirst.mockRejectedValueOnce(new Error('DB fail'));
      await expect(generateT4A('member-1', 2025)).rejects.toThrow('not found');
    });

    it('generateRL1 .catch(→null) fires when findFirst rejects (line 167)', async () => {
      mocks.usersFindFirst.mockRejectedValueOnce(new Error('DB fail'));
      await expect(generateRL1('member-1', 2025)).rejects.toThrow('not found');
    });

    it('processYearEndTaxSlips .catch(→[]) fires on failing payments query (line 256)', async () => {
      mocks.mockSelect.mockReturnValueOnce(failChain());
      const result = await processYearEndTaxSlips(2025);
      expect(result.processed).toBe(0);
    });

    it('processYearEndTaxSlips inner-loop user .catch(→null) fires when findFirst rejects (line 278)', async () => {
      // payments query succeeds
      mocks.mockSelect.mockReturnValueOnce(
        chain([{ userId: 'member-1', totalAmount: 1000, province: 'ON' }])
      );
      // inner loop user findFirst rejects → catch fires → member=null → log & continue
      mocks.usersFindFirst.mockRejectedValueOnce(new Error('DB fail'));
      const result = await processYearEndTaxSlips(2025);
      expect(result.t4aGenerated).toBe(0);
    });

    it('getYearlyStrikePay .catch(→default) fires on failing select (line 341)', async () => {
      // trigger via checkStrikePaymentTaxability which calls getYearlyStrikePay
      mocks.mockSelect.mockReturnValueOnce(failChain());
      const result = await checkStrikePaymentTaxability('member-1', 400);
      // catch returned [{totalAmount:0}] → yearTotal=0 → below thresholds
      expect(result.requiresT4A).toBe(false);
    });
  });});
