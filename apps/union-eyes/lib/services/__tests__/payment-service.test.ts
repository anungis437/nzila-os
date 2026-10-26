/**
 * Payment Service — Unit Tests
 *
 * Tests:
 *   - createCheckoutSession: validation, Stripe delegation
 *   - handlePaymentSuccess: DB update, notification
 *   - handlePaymentFailure: retry metadata, notification
 *   - generateReceipt: validation, receipt number format
 *
 * Tier 1 — Security & Money
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();

vi.mock('@/db', () => ({
  db: {
    select: (...a: any[]) => mockDbSelect(...a),
    update: (...a: any[]) => mockDbUpdate(...a),
  },
}));

vi.mock('@/db/schema/domains/finance/dues', () => ({
  duesTransactions: {
    id: 'id', memberId: 'memberId', organizationId: 'organizationId',
    totalAmount: 'totalAmount', duesAmount: 'duesAmount', copeAmount: 'copeAmount',
    pacAmount: 'pacAmount', strikeFundAmount: 'strikeFundAmount',
    status: 'status', paidDate: 'paidDate', processorType: 'processorType',
    processorPaymentId: 'processorPaymentId', paymentMethod: 'paymentMethod',
    receiptUrl: 'receiptUrl', metadata: 'metadata', updatedAt: 'updatedAt',
  },
}));

vi.mock('@/db/schema-organizations', () => ({
  organizationMembers: { id: 'id', name: 'name', email: 'email', userId: 'userId', organizationId: 'organizationId' },
  organizations: { id: 'id', name: 'name' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: any[]) => ({ type: 'eq', args })),
  and: vi.fn((...args: any[]) => ({ type: 'and', args })),
  inArray: vi.fn((...args: any[]) => ({ type: 'inArray', args })),
}));

const audit = vi.hoisted(() => ({ tx: vi.fn(), op: vi.fn(async (_o: unknown, fn: () => Promise<unknown>) => fn()) }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: audit.tx }));
vi.mock('@/lib/audit/operation-audit', () => ({ performAuditedOperation: audit.op }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: async (fn: (tx: unknown) => Promise<unknown>) => fn({ select: (...a: any[]) => mockDbSelect(...a), update: (...a: any[]) => mockDbUpdate(...a) }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@react-pdf/renderer', () => ({
  Document: 'Document',
  Page: 'Page',
  StyleSheet: { create: vi.fn((s: any) => s) },
  Text: 'Text',
  pdf: vi.fn(() => ({ toBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-pdf')) })),
}));

vi.mock('react', () => ({
  default: { createElement: vi.fn((...args: any[]) => ({ type: args[0], props: args[1] })) },
  createElement: vi.fn((...args: any[]) => ({ type: args[0], props: args[1] })),
}));

const mockStripeCheckoutCreate = vi.fn();
vi.mock('@nzila/payments-stripe', () => ({
  getStripeClient: vi.fn(() => ({
    checkout: {
      sessions: { create: (...a: any[]) => mockStripeCheckoutCreate(...a) },
    },
  })),
}));

vi.mock('@/lib/services/dues-notifications', () => ({
  sendPaymentConfirmation: vi.fn().mockResolvedValue(undefined),
  sendPaymentFailure: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/decimal-safe', () => ({
  toCents: vi.fn((amount: string) => Math.round(parseFloat(amount) * 100)),
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { PaymentService, PaymentAuthorityError } from '../payment-service';

// ── Helpers ──────────────────────────────────────────────────────────────────

function selectChain(rows: Record<string, unknown>[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
      innerJoin: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(rows),
          }),
        }),
      }),
    }),
  };
}

function updateChain(returned: Record<string, unknown>[] = [{ id: 'txn-1' }]) {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(returned) }),
    }),
  };
}

// ─── createCheckoutSession ──────────────────────────────────────────────────

const actor = { userId: 'user-payer' };
const base = { returnUrl: 'https://example.com/return', cancelUrl: 'https://example.com/cancel', actor };
const pendingTxn = {
  id: 'txn-1', status: 'pending', totalAmount: '100.00', organizationId: 'org-1',
  duesAmount: '85.00', copeAmount: '10.00', pacAmount: '3.00', strikeFundAmount: '2.00', memberId: 'mem-1',
};

describe('PaymentService.createCheckoutSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    audit.op.mockImplementation(async (_o: unknown, fn: () => Promise<unknown>) => fn());
  });

  it('reports an unknown transaction as not found', async () => {
    mockDbSelect.mockReturnValue(selectChain([]));
    await expect(PaymentService.createCheckoutSession({ ...base, transactionId: 'txn-404' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('reports a transaction that is not the caller\'s as not found, and creates nothing at the processor', async () => {
    mockDbSelect.mockReturnValueOnce(selectChain([pendingTxn])).mockReturnValueOnce(selectChain([]));
    await expect(PaymentService.createCheckoutSession({ ...base, transactionId: 'txn-1' })).rejects.toBeInstanceOf(PaymentAuthorityError);
    expect(mockStripeCheckoutCreate).not.toHaveBeenCalled();
    expect(audit.op).not.toHaveBeenCalled();
  });

  it('refuses a transaction that is not payable', async () => {
    mockDbSelect.mockReturnValueOnce(selectChain([{ ...pendingTxn, status: 'paid' }])).mockReturnValueOnce(selectChain([{ id: 'mem-1' }]));
    await expect(PaymentService.createCheckoutSession({ ...base, transactionId: 'txn-1' })).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('throws for the unsupported PayPal processor', async () => {
    mockDbSelect
      .mockReturnValueOnce(selectChain([pendingTxn]))
      .mockReturnValueOnce(selectChain([{ id: 'mem-1' }]))
      .mockReturnValueOnce(selectChain([{ name: 'J. Worker', email: 'jw@union.org' }]));
    await expect(
      PaymentService.createCheckoutSession({ ...base, transactionId: 'txn-1', processorType: 'paypal' }),
    ).rejects.toThrow('PayPal checkout not yet implemented');
  });

  it('creates the Stripe session for the payer and records the operation first', async () => {
    mockDbSelect
      .mockReturnValueOnce(selectChain([pendingTxn]))
      .mockReturnValueOnce(selectChain([{ id: 'mem-1' }]))
      .mockReturnValueOnce(selectChain([{ name: 'J. Worker', email: 'jw@union.org' }]));
    mockStripeCheckoutCreate.mockResolvedValue({ id: 'cs_test_123', url: 'https://checkout.stripe.com/pay/cs_test_123' });

    const result = await PaymentService.createCheckoutSession({ ...base, transactionId: 'txn-1' });

    expect(result.sessionId).toBe('cs_test_123');
    expect(result.transactionId).toBe('txn-1');
    expect(audit.op).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'dues.checkout.create', organizationId: 'org-1', userId: 'user-payer', resourceId: 'txn-1' }),
      expect.any(Function),
    );
  });
});

// ─── handlePaymentSuccess ────────────────────────────────────────────────────

describe('PaymentService.handlePaymentSuccess', () => {
  const pay = { transactionId: 'txn-1', processorPaymentId: 'pi_test_123', processorType: 'stripe' as const, amount: '100.00' };
  beforeEach(() => {
    vi.clearAllMocks();
    audit.tx.mockResolvedValue(undefined);
  });

  it('marks a payable transaction paid, audits it on the same transaction, and sends the confirmation', async () => {
    mockDbSelect.mockReturnValue(selectChain([{ id: 'txn-1', status: 'pending', totalAmount: '100.00', organizationId: 'org-1' }]));
    mockDbUpdate.mockReturnValue(updateChain());

    await PaymentService.handlePaymentSuccess(pay);

    expect(mockDbUpdate).toHaveBeenCalledOnce();
    expect(audit.tx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'dues.payment.received', organizationId: 'org-1', userId: 'system:payment-stripe' }),
    );
    const { sendPaymentConfirmation } = await import('@/lib/services/dues-notifications');
    expect(sendPaymentConfirmation).toHaveBeenCalledWith('txn-1');
  });

  it('refuses a payment whose amount is not the amount on record', async () => {
    mockDbSelect.mockReturnValue(selectChain([{ id: 'txn-1', status: 'pending', totalAmount: '100.00', organizationId: 'org-1' }]));
    await expect(PaymentService.handlePaymentSuccess({ ...pay, amount: '1.00' })).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(mockDbUpdate).not.toHaveBeenCalled();
    expect(audit.tx).not.toHaveBeenCalled();
  });

  it('treats a replay of the same payment as a no-op, with no second audit or confirmation', async () => {
    mockDbSelect.mockReturnValue(selectChain([{ id: 'txn-1', status: 'paid', processorPaymentId: 'pi_test_123', totalAmount: '100.00', organizationId: 'org-1' }]));
    await PaymentService.handlePaymentSuccess(pay);
    expect(mockDbUpdate).not.toHaveBeenCalled();
    expect(audit.tx).not.toHaveBeenCalled();
    const { sendPaymentConfirmation } = await import('@/lib/services/dues-notifications');
    expect(sendPaymentConfirmation).not.toHaveBeenCalled();
  });

  it('does not let a different payment overwrite an already-paid transaction', async () => {
    mockDbSelect.mockReturnValue(selectChain([{ id: 'txn-1', status: 'paid', processorPaymentId: 'pi_other', totalAmount: '100.00', organizationId: 'org-1' }]));
    await expect(PaymentService.handlePaymentSuccess(pay)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it('is a conflict with no audit when the transaction stopped being payable in the meantime', async () => {
    mockDbSelect.mockReturnValue(selectChain([{ id: 'txn-1', status: 'pending', totalAmount: '100.00', organizationId: 'org-1' }]));
    mockDbUpdate.mockReturnValue(updateChain([]));
    await expect(PaymentService.handlePaymentSuccess(pay)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(audit.tx).not.toHaveBeenCalled();
  });

  it('does not report the payment as processed when its audit cannot be written', async () => {
    mockDbSelect.mockReturnValue(selectChain([{ id: 'txn-1', status: 'pending', totalAmount: '100.00', organizationId: 'org-1' }]));
    mockDbUpdate.mockReturnValue(updateChain());
    audit.tx.mockRejectedValue(new Error('audit down'));
    await expect(PaymentService.handlePaymentSuccess(pay)).rejects.toThrow('audit down');
    const { sendPaymentConfirmation } = await import('@/lib/services/dues-notifications');
    expect(sendPaymentConfirmation).not.toHaveBeenCalled();
  });
});

// ─── handlePaymentFailure ────────────────────────────────────────────────────

describe('PaymentService.handlePaymentFailure', () => {
  const failure = { transactionId: 'txn-1', processorType: 'stripe' as const, errorMessage: 'Card declined', errorCode: 'card_declined' };
  beforeEach(() => {
    vi.clearAllMocks();
    audit.tx.mockResolvedValue(undefined);
  });

  it('increments the failure count, keeps the transaction payable and audits it', async () => {
    mockDbSelect.mockReturnValue(selectChain([{ id: 'txn-1', status: 'pending', organizationId: 'org-1', metadata: { failureCount: 1 } }]));
    mockDbUpdate.mockReturnValue(updateChain());

    await PaymentService.handlePaymentFailure(failure);

    expect(audit.tx).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'dues.payment.failed', details: expect.objectContaining({ failureCount: 2 }) }),
    );
    const { sendPaymentFailure } = await import('@/lib/services/dues-notifications');
    expect(sendPaymentFailure).toHaveBeenCalledWith('txn-1', 'Card declined', false);
  });

  it('never undoes a payment: a late failure notice for a paid transaction is refused', async () => {
    mockDbSelect.mockReturnValue(selectChain([{ id: 'txn-1', status: 'paid', organizationId: 'org-1', metadata: {} }]));
    await expect(PaymentService.handlePaymentFailure(failure)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(mockDbUpdate).not.toHaveBeenCalled();
    expect(audit.tx).not.toHaveBeenCalled();
  });

  it('is a conflict with no audit when the transaction stopped being payable in the meantime', async () => {
    mockDbSelect.mockReturnValue(selectChain([{ id: 'txn-1', status: 'pending', organizationId: 'org-1', metadata: {} }]));
    mockDbUpdate.mockReturnValue(updateChain([]));
    await expect(PaymentService.handlePaymentFailure(failure)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(audit.tx).not.toHaveBeenCalled();
  });

  it('is not found for an unknown transaction', async () => {
    mockDbSelect.mockReturnValue(selectChain([]));
    await expect(PaymentService.handlePaymentFailure({ ...failure, transactionId: 'txn-404' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

// ─── generateReceipt ─────────────────────────────────────────────────────────

describe('PaymentService.generateReceipt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws if transaction not found', async () => {
    mockDbSelect.mockReturnValue(selectChain([]));

    await expect(
      PaymentService.generateReceipt('txn-404'),
    ).rejects.toThrow('Transaction not found: txn-404');
  });

  it('throws if transaction is not paid', async () => {
    mockDbSelect.mockReturnValue(
      selectChain([
        {
          transaction: { id: 'txn-1', status: 'pending', totalAmount: '50.00' },
          memberName: 'J Worker',
          memberEmail: 'jw@union.org',
          organizationName: 'CUPE Local 123',
        },
      ]),
    );

    await expect(
      PaymentService.generateReceipt('txn-1'),
    ).rejects.toThrow('Transaction not paid: txn-1');
  });
});

// ─── getTransactionBySessionId ───────────────────────────────────────────────

describe('PaymentService.getTransactionBySessionId', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns matching transaction by stripeSessionId in metadata', async () => {
    const txns = [
      { id: 'txn-1', processorType: 'stripe', metadata: { stripeSessionId: 'cs_abc' } },
      { id: 'txn-2', processorType: 'stripe', metadata: { stripeSessionId: 'cs_xyz' } },
    ];
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(txns),
      }),
    });

    const result = await PaymentService.getTransactionBySessionId('cs_abc');
    expect(result).toMatchObject({ id: 'txn-1' });
  });

  it('returns null when no transaction matches session ID', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: 'txn-1', processorType: 'stripe', metadata: { stripeSessionId: 'cs_other' } },
        ]),
      }),
    });

    const result = await PaymentService.getTransactionBySessionId('cs_missing');
    expect(result).toBeNull();
  });
});
