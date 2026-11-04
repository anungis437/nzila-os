/**
 * Payment Service — Unit Tests
 *
 * Tests:
 *   - createCheckoutSession: the payer check in the caller's organization, the processor called outside the transaction, Stripe delegation
 *   - handlePaymentSuccess: DB update, notification
 *   - handlePaymentFailure: retry metadata, notification
 *
 * Tier 1 — Security & Money
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockDbSelect = vi.fn();
const mockDbUpdate = vi.fn();
// The where-clause of every select, in the order the statements ran.
const wheres: unknown[] = [];

const rls = vi.hoisted(() => ({ contexts: [] as unknown[], open: false }));

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
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: any[]) => ({ type: 'eq', args })),
  and: vi.fn((...args: any[]) => ({ type: 'and', args })),
  inArray: vi.fn((...args: any[]) => ({ type: 'inArray', args })),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ type: 'sql', text: strings.join('?'), values }),
}));

const audit = vi.hoisted(() => ({ tx: vi.fn(), op: vi.fn(async (_o: unknown, fn: () => Promise<unknown>) => fn()) }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: audit.tx }));
vi.mock('@/lib/audit/operation-audit', () => ({ performAuditedOperation: audit.op }));
vi.mock('@/lib/db/with-rls-context', () => {
  const tx = { select: (...a: any[]) => mockDbSelect(...a), update: (...a: any[]) => mockDbUpdate(...a) };
  return {
    withSystemContext: async (fn: (tx: unknown) => Promise<unknown>) => fn(tx),
    withRLSContext: async (context: unknown, fn: (tx: unknown) => Promise<unknown>) => {
      rls.contexts.push(context);
      rls.open = true;
      try {
        return await fn(tx);
      } finally {
        rls.open = false;
      }
    },
  };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
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
      where: vi.fn((condition: unknown) => {
        wheres.push(condition);
        return { limit: vi.fn().mockResolvedValue(rows) };
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

const actor = { userId: 'user-payer', organizationId: 'org-1' };
const base = { returnUrl: 'https://example.com/return', cancelUrl: 'https://example.com/cancel', actor };
const pendingTxn = {
  id: 'txn-1', status: 'pending', totalAmount: '100.00', organizationId: 'org-1',
  duesAmount: '85.00', copeAmount: '10.00', pacAmount: '3.00', strikeFundAmount: '2.00', memberId: 'mem-1',
};
const payer = { id: 'mem-1', name: 'J. Worker', email: 'jw@union.org' };

describe('PaymentService.createCheckoutSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rls.contexts.length = 0;
    rls.open = false;
    wheres.length = 0;
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
    mockDbSelect.mockReturnValueOnce(selectChain([{ ...pendingTxn, status: 'paid' }])).mockReturnValueOnce(selectChain([payer]));
    await expect(PaymentService.createCheckoutSession({ ...base, transactionId: 'txn-1' })).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('does not tell a caller who is not the payer whether the transaction is payable', async () => {
    mockDbSelect.mockReturnValueOnce(selectChain([{ ...pendingTxn, status: 'paid' }])).mockReturnValueOnce(selectChain([]));
    await expect(PaymentService.createCheckoutSession({ ...base, transactionId: 'txn-1' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('throws for the unsupported PayPal processor', async () => {
    mockDbSelect.mockReturnValueOnce(selectChain([pendingTxn])).mockReturnValueOnce(selectChain([payer]));
    await expect(
      PaymentService.createCheckoutSession({ ...base, transactionId: 'txn-1', processorType: 'paypal' }),
    ).rejects.toThrow('PayPal checkout not yet implemented');
  });

  it('creates the Stripe session for the payer and records the operation first', async () => {
    mockDbSelect.mockReturnValueOnce(selectChain([pendingTxn])).mockReturnValueOnce(selectChain([payer]));
    mockStripeCheckoutCreate.mockResolvedValue({ id: 'cs_test_123', url: 'https://checkout.stripe.com/pay/cs_test_123' });

    const result = await PaymentService.createCheckoutSession({ ...base, transactionId: 'txn-1' });

    expect(result.sessionId).toBe('cs_test_123');
    expect(result.transactionId).toBe('txn-1');
    expect(mockStripeCheckoutCreate).toHaveBeenCalledWith(expect.objectContaining({ customer_email: 'jw@union.org', client_reference_id: 'txn-1' }));
    expect(audit.op).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'dues.checkout.create', organizationId: 'org-1', userId: 'user-payer', resourceId: 'txn-1' }),
      expect.any(Function),
    );
  });

  it('reads the transaction and the payer in the caller\'s organization, filtered by it, and by the payer\'s user', async () => {
    mockDbSelect.mockReturnValueOnce(selectChain([pendingTxn])).mockReturnValueOnce(selectChain([payer]));
    mockStripeCheckoutCreate.mockResolvedValue({ id: 'cs_test_123', url: 'https://checkout.stripe.com/pay/cs_test_123' });

    await PaymentService.createCheckoutSession({ ...base, transactionId: 'txn-1' });

    expect(rls.contexts).toEqual([{ organizationId: 'org-1' }]);
    expect(wheres[0]).toEqual({
      type: 'and',
      args: [
        { type: 'eq', args: ['id', 'txn-1'] },
        { type: 'eq', args: ['organizationId', 'org-1'] },
      ],
    });
    const payerWhere = wheres[1] as { args: Array<{ args: unknown[] }> };
    expect(payerWhere.args.map((condition) => condition.args[1])).toEqual(['mem-1', 'user-payer', 'org-1']);
    expect((payerWhere.args[0].args[0] as { text: string }).text).toContain('::text');
  });

  it('does not hold the database transaction while the processor is called', async () => {
    mockDbSelect.mockReturnValueOnce(selectChain([pendingTxn])).mockReturnValueOnce(selectChain([payer]));
    let openDuringProcessorCall: boolean | undefined;
    mockStripeCheckoutCreate.mockImplementation(async () => {
      openDuringProcessorCall = rls.open;
      return { id: 'cs_test_123', url: 'https://checkout.stripe.com/pay/cs_test_123' };
    });

    await PaymentService.createCheckoutSession({ ...base, transactionId: 'txn-1' });

    expect(openDuringProcessorCall).toBe(false);
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
