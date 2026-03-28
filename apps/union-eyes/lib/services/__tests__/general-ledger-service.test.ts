/**
 * General Ledger Service — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockReturning, mockInsertValues, mockSelect, mockAuditLog } = vi.hoisted(() => ({
  mockReturning: vi.fn(),
  mockInsertValues: vi.fn(() => ({ returning: mockReturning })),
  mockSelect: vi.fn(),
  mockAuditLog: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    insert: vi.fn(() => ({ values: mockInsertValues })),
    select: mockSelect,
  },
}));

vi.mock('@/db/schema/domains/finance', () => ({
  chartOfAccounts: {},
  glTransactionLog: {},
  glTrialBalance: {},
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('../audit-service', () => ({
  createAuditLog: mockAuditLog,
}));

vi.mock('@/lib/decimal-safe', () => ({
  toCents: vi.fn((n: number) => Math.round(n * 100)),
  moneyToNumber: vi.fn((s: string) => parseFloat(s)),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { postGLTransaction } from '../general-ledger-service';
import type { GLPostingRequest } from '../general-ledger-service';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GeneralLedgerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReturning.mockResolvedValue([]);
    mockAuditLog.mockResolvedValue(undefined);
  });

  it('postGLTransaction throws when account not found', async () => {
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    const request: GLPostingRequest = {
      organizationId: 'org-1',
      accountNumber: '1000',
      debitAmount: 100,
      description: 'Test',
      sourceSystem: 'test',
      sourceRecordId: 'rec-1',
      userId: 'user-1',
    };

    await expect(postGLTransaction(request)).rejects.toThrow('Account 1000 not found');
  });

  it('postGLTransaction throws when account is inactive', async () => {
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: 'acct-1', accountNumber: '1000', status: 'inactive', allowTransactions: true },
        ]),
      }),
    });

    const request: GLPostingRequest = {
      organizationId: 'org-1',
      accountNumber: '1000',
      debitAmount: 100,
      description: 'Test',
      sourceSystem: 'test',
      sourceRecordId: 'rec-1',
      userId: 'user-1',
    };

    await expect(postGLTransaction(request)).rejects.toThrow('not active');
  });

  it('postGLTransaction throws when both amounts are zero', async () => {
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: 'acct-1', accountNumber: '1000', status: 'active', allowTransactions: true },
        ]),
      }),
    });

    const request: GLPostingRequest = {
      organizationId: 'org-1',
      accountNumber: '1000',
      debitAmount: 0,
      creditAmount: 0,
      description: 'Test',
      sourceSystem: 'test',
      sourceRecordId: 'rec-1',
      userId: 'user-1',
    };

    await expect(postGLTransaction(request)).rejects.toThrow('At least one');
  });

  it('postGLTransaction creates transaction for valid request', async () => {
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: 'acct-1', accountNumber: '1000', status: 'active', allowTransactions: true },
        ]),
      }),
    });

    const txn = {
      id: 'txn-1',
      transactionNumber: 'GL-123',
      debitAmount: '10000',
      creditAmount: '0',
      isPosted: true,
      createdAt: new Date(),
    };
    mockReturning.mockResolvedValue([txn]);

    const request: GLPostingRequest = {
      organizationId: 'org-1',
      accountNumber: '1000',
      debitAmount: 100,
      description: 'Debit entry',
      sourceSystem: 'test',
      sourceRecordId: 'rec-1',
      userId: 'user-1',
    };

    const result = await postGLTransaction(request);
    expect(result).toBeDefined();
    expect(result.id).toBe('txn-1');
  });
});
