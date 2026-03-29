/**
 * General Ledger Service — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockValues: vi.fn(),
  mockReturning: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockSet: vi.fn(),
  mockLimit: vi.fn(),
  mockCreateAuditLog: vi.fn(),
  mockToCents: vi.fn(),
  mockMoneyToNumber: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    insert: mocks.mockInsert,
    select: mocks.mockSelect,
    update: mocks.mockUpdate,
  },
}));

vi.mock('@/db/schema/domains/finance', () => ({
  chartOfAccounts: {
    id: 'id', organizationId: 'organization_id', accountNumber: 'account_number',
    accountName: 'account_name', status: 'status', allowTransactions: 'allow_transactions',
    openingBalance: 'opening_balance',
  },
  glTransactionLog: {
    id: 'id', organizationId: 'organization_id', chartOfAccountsId: 'chart_of_accounts_id',
    transactionDate: 'transaction_date', transactionNumber: 'transaction_number',
    debitAmount: 'debit_amount', creditAmount: 'credit_amount', isPosted: 'is_posted',
    reconciledAt: 'reconciled_at', isReconciled: 'is_reconciled',
  },
  glTrialBalance: { id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b })),
  and: vi.fn((...args: unknown[]) => args),
  lte: vi.fn((a, b) => ({ field: a, value: b })),
  isNull: vi.fn((a) => ({ field: a, op: 'isNull' })),
}));

vi.mock('../audit-service', () => ({
  createAuditLog: mocks.mockCreateAuditLog,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/decimal-safe', () => ({
  toCents: mocks.mockToCents,
  moneyToNumber: mocks.mockMoneyToNumber,
}));

import {
  postGLTransaction,
  reverseGLTransaction,
  generateTrialBalance,
  reconcileGLTransactions,
  getUnreconciledTransactions,
} from '../general-ledger-service';

// ── Helpers ──────────────────────────────────────────────────────────────────

function setupInsertChain(rows: unknown[] = [{ id: 'tx-1', transactionNumber: 'GL-1', createdAt: new Date() }]) {
  mocks.mockReturning.mockResolvedValue(rows);
  mocks.mockValues.mockReturnValue({ returning: mocks.mockReturning });
  mocks.mockInsert.mockReturnValue({ values: mocks.mockValues });
}

function setupSelectChain(rows: unknown[]) {
  mocks.mockWhere.mockResolvedValue(rows);
  mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
  mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });
}

function setupUpdateChain() {
  mocks.mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  mocks.mockUpdate.mockReturnValue({ set: mocks.mockSet });
}

const baseRequest = {
  organizationId: 'org-1',
  accountNumber: '1000',
  debitAmount: 100,
  creditAmount: 0,
  description: 'Test posting',
  sourceSystem: 'manual',
  sourceRecordId: 'rec-1',
  userId: 'user-1',
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('postGLTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockCreateAuditLog.mockResolvedValue(undefined);
  });

  it('posts transaction successfully', async () => {
    // Select: account lookup
    setupSelectChain([{
      id: 'acct-1', accountNumber: '1000', status: 'active', allowTransactions: true,
    }]);
    setupInsertChain([{
      id: 'tx-1', transactionNumber: 'GL-123', createdAt: new Date(),
    }]);

    const result = await postGLTransaction(baseRequest);
    expect(result.id).toBe('tx-1');
    expect(result.isPosted).toBe(true);
    expect(result.debitAmount).toBe(100);
    expect(result.creditAmount).toBe(0);
    expect(mocks.mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'GL_TRANSACTION_POSTED' }),
    );
  });

  it('throws when account not found', async () => {
    setupSelectChain([]);
    await expect(postGLTransaction(baseRequest)).rejects.toThrow('not found');
  });

  it('throws when account is inactive', async () => {
    setupSelectChain([{ id: 'acct-1', accountNumber: '1000', status: 'closed', allowTransactions: true }]);
    await expect(postGLTransaction(baseRequest)).rejects.toThrow('not active');
  });

  it('throws when account disallows transactions', async () => {
    setupSelectChain([{ id: 'acct-1', accountNumber: '1000', status: 'active', allowTransactions: false }]);
    await expect(postGLTransaction(baseRequest)).rejects.toThrow('does not allow');
  });

  it('throws for negative amounts', async () => {
    setupSelectChain([{ id: 'acct-1', accountNumber: '1000', status: 'active', allowTransactions: true }]);
    await expect(postGLTransaction({ ...baseRequest, debitAmount: -5 })).rejects.toThrow('negative');
  });

  it('throws when both amounts are zero', async () => {
    setupSelectChain([{ id: 'acct-1', accountNumber: '1000', status: 'active', allowTransactions: true }]);
    await expect(
      postGLTransaction({ ...baseRequest, debitAmount: 0, creditAmount: 0 }),
    ).rejects.toThrow('greater than 0');
  });
});

describe('reverseGLTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockCreateAuditLog.mockResolvedValue(undefined);
    mocks.mockMoneyToNumber.mockImplementation((v: string) => parseFloat(v || '0'));
  });

  it('reverses posted transaction', async () => {
    setupSelectChain([{
      id: 'tx-1', transactionNumber: 'GL-123', chartOfAccountsId: 'acct-1',
      debitAmount: '100.00', creditAmount: '0.00', isPosted: true,
      costCenterId: null, sourceSystem: 'manual', sourceRecordId: 'rec-1',
    }]);
    setupInsertChain([{
      id: 'tx-rev-1', transactionNumber: 'GL-REVERSAL-GL-123',
      debitAmount: '0.00', creditAmount: '100.00', createdAt: new Date(),
    }]);

    const result = await reverseGLTransaction('org-1', 'tx-1', 'Error found', 'user-1');
    expect(result.id).toBe('tx-rev-1');
    expect(result.transactionNumber).toContain('REVERSAL');
    expect(mocks.mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'GL_TRANSACTION_REVERSED' }),
    );
  });

  it('throws when transaction not found', async () => {
    setupSelectChain([]);
    await expect(
      reverseGLTransaction('org-1', 'tx-999', 'reason', 'user-1'),
    ).rejects.toThrow('not found');
  });

  it('throws when transaction is unposted', async () => {
    setupSelectChain([{
      id: 'tx-1', transactionNumber: 'GL-123', isPosted: false,
    }]);
    await expect(
      reverseGLTransaction('org-1', 'tx-1', 'reason', 'user-1'),
    ).rejects.toThrow('unposted');
  });
});

describe('generateTrialBalance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockCreateAuditLog.mockResolvedValue(undefined);
    mocks.mockToCents.mockImplementation((v: string | number) => Math.round(Number(v || 0) * 100));
  });

  it('generates balanced trial balance', async () => {
    // First select: accounts; then per-account transactions selects (inline)
    let selectCall = 0;
    mocks.mockWhere.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) {
        // accounts
        return Promise.resolve([
          { id: 'acct-1', accountNumber: '1000', accountName: 'Cash', openingBalance: '0', status: 'active' },
        ]);
      }
      // transactions for acct-1
      return Promise.resolve([
        { debitAmount: '500.00', creditAmount: '0.00' },
        { debitAmount: '0.00', creditAmount: '200.00' },
      ]);
    });
    mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
    mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });
    setupInsertChain([{ id: 'tb-1' }]);

    const result = await generateTrialBalance('org-1', new Date(), 'user-1');
    expect(result.accounts).toHaveLength(1);
    expect(result.debitTotal).toBe(500);
    expect(result.creditTotal).toBe(200);
    expect(result.isBalanced).toBe(false);
    expect(mocks.mockCreateAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'TRIAL_BALANCE_GENERATED' }),
    );
  });

  it('reports balanced when debits equal credits within tolerance', async () => {
    let selectCall = 0;
    mocks.mockWhere.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) {
        return Promise.resolve([
          { id: 'a1', accountNumber: '1000', accountName: 'Cash', openingBalance: '0' },
        ]);
      }
      return Promise.resolve([
        { debitAmount: '100.00', creditAmount: '100.00' },
      ]);
    });
    mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
    mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });
    setupInsertChain([{ id: 'tb-1' }]);

    const result = await generateTrialBalance('org-1', new Date(), 'user-1');
    expect(result.isBalanced).toBe(true);
    expect(result.difference).toBe(0);
  });
});

describe('reconcileGLTransactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockCreateAuditLog.mockResolvedValue(undefined);
    setupUpdateChain();
  });

  it('reconciles matched transactions', async () => {
    // First select: account; second select: unmatched transactions
    let selectCall = 0;
    mocks.mockWhere.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) {
        return Promise.resolve([{ id: 'acct-1', accountNumber: '1000' }]);
      }
      return Promise.resolve([]);  // no unmatched
    });
    mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
    mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

    const result = await reconcileGLTransactions(
      'org-1', 'acct-1', new Date(), ['tx-1', 'tx-2'], 'user-1',
    );
    expect(result.matchedCount).toBe(2);
    expect(result.unmatchedCount).toBe(0);
    expect(result.requiresManualReview).toBe(false);
    expect(mocks.mockUpdate).toHaveBeenCalledTimes(2);
  });

  it('flags manual review when unmatched exist', async () => {
    let selectCall = 0;
    mocks.mockWhere.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) {
        return Promise.resolve([{ id: 'acct-1', accountNumber: '1000' }]);
      }
      return Promise.resolve([{ id: 'tx-unmatched' }]);
    });
    mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
    mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

    const result = await reconcileGLTransactions(
      'org-1', 'acct-1', new Date(), ['tx-1'], 'user-1',
    );
    expect(result.unmatchedCount).toBe(1);
    expect(result.requiresManualReview).toBe(true);
  });

  it('throws when account not found', async () => {
    setupSelectChain([]);
    await expect(
      reconcileGLTransactions('org-1', 'bad-acct', new Date(), [], 'user-1'),
    ).rejects.toThrow('not found');
  });
});

describe('getUnreconciledTransactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockMoneyToNumber.mockImplementation((v: string) => parseFloat(v || '0'));
  });

  it('returns mapped unreconciled transactions', async () => {
    mocks.mockLimit.mockResolvedValue([
      { id: 'tx-1', transactionNumber: 'GL-1', debitAmount: '50.00', creditAmount: '0.00', isPosted: true, createdAt: new Date() },
      { id: 'tx-2', transactionNumber: 'GL-2', debitAmount: '0.00', creditAmount: '75.00', isPosted: true, createdAt: new Date() },
    ]);
    mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
    mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
    mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

    const result = await getUnreconciledTransactions('org-1', 'acct-1');
    expect(result).toHaveLength(2);
    expect(result[0].debitAmount).toBe(50);
    expect(result[1].creditAmount).toBe(75);
  });

  it('returns empty array when none found', async () => {
    mocks.mockLimit.mockResolvedValue([]);
    mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
    mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
    mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

    const result = await getUnreconciledTransactions('org-1', 'acct-1');
    expect(result).toHaveLength(0);
  });
});
