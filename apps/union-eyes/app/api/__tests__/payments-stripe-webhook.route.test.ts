import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createHmac } from 'node:crypto';

const TEST_ORG_ID = '00000000-0000-0000-0000-000000000001';

const m = vi.hoisted(() => {
  const state = {
    selectQueue: [] as unknown[][],
    insertResults: [] as unknown[][],
    updateResults: [] as unknown[][],
  };

  const nextSelect = () => Promise.resolve((state.selectQueue.shift() ?? []) as unknown[]);
  const nextInsert = () => Promise.resolve((state.insertResults.shift() ?? []) as unknown[]);
  const nextUpdate = () => Promise.resolve((state.updateResults.shift() ?? []) as unknown[]);

  const createSelectChain = () => {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      then: (resolve: (value: unknown[]) => unknown) => nextSelect().then(resolve),
    };
    return chain;
  };

  const createInsertChain = () => ({
    values: vi.fn(() => ({
      onConflictDoNothing: vi.fn(() => Promise.resolve(undefined)),
      returning: vi.fn(() => nextInsert()),
    })),
  });

  const createUpdateChain = () => ({
    set: vi.fn(() => ({
      where: vi.fn(() => nextUpdate()),
    })),
  });

  return {
    state,
    queueSelect: (...results: unknown[][]) => state.selectQueue.push(...results),
    queueInsert: (...results: unknown[][]) => state.insertResults.push(...results),
    queueUpdate: (...results: unknown[][]) => state.updateResults.push(...results),
    resetQueues: () => {
      state.selectQueue = [];
      state.insertResults = [];
      state.updateResults = [];
    },
    createSelectChain,
    createInsertChain,
    createUpdateChain,
    withSystemContext: vi.fn(async (fn: (db: unknown) => Promise<unknown>) => fn(mockDb)),
    evaluateFee: vi.fn(),
    captureTransactionFee: vi.fn(),
    reverseTransactionFee: vi.fn(),
    reconcileExternalInvoicePayment: vi.fn(),
    auditLog: vi.fn(),
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    syncIcraPurchase: vi.fn(),
    syncWorkbookPurchase: vi.fn(),
    generateClaimToken: vi.fn(),
    computeClaimExpiry: vi.fn(),
  };
});

const mockDb = {
  select: vi.fn(() => m.createSelectChain()),
  insert: vi.fn(() => m.createInsertChain()),
  update: vi.fn(() => m.createUpdateChain()),
};

vi.mock('@/db', () => ({ db: mockDb }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: m.withSystemContext,
}));
vi.mock('@/services/platform-economics', () => ({
  evaluateFee: m.evaluateFee,
  captureTransactionFee: m.captureTransactionFee,
  reverseTransactionFee: m.reverseTransactionFee,
  reconcileExternalInvoicePayment: m.reconcileExternalInvoicePayment,
}));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/audit-logger', () => ({
  auditLog: m.auditLog,
  AuditEventType: { API_WEBHOOK_RECEIVED: 'api.webhook.received' },
  AuditSeverity: { LOW: 'low' },
}));
vi.mock('@/lib/hubspot/syncIcraPurchase', () => ({ syncIcraPurchase: m.syncIcraPurchase }));
vi.mock('@/lib/hubspot/syncWorkbookPurchase', () => ({ syncWorkbookPurchase: m.syncWorkbookPurchase }));
vi.mock('@/lib/icra/claim-tokens', () => ({
  generateClaimToken: m.generateClaimToken,
  computeClaimExpiry: m.computeClaimExpiry,
}));

function makeStripeRequest(payload: string, secret: string, signature = true) {
  const timestamp = '1700000000';
  const hash = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  return new NextRequest('http://localhost/api/payments/webhooks/stripe', {
    method: 'POST',
    body: payload,
    headers: signature
      ? {
          'content-type': 'application/json',
          'stripe-signature': `t=${timestamp},v1=${hash}`,
        }
      : { 'content-type': 'application/json' },
  });
}

async function loadRoute(secret?: string) {
  vi.resetModules();
  if (secret === undefined) {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  } else {
    process.env.STRIPE_WEBHOOK_SECRET = secret;
  }
  return import('../payments/webhooks/stripe/route');
}

describe('payments/webhooks/stripe route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.resetQueues();
    m.evaluateFee.mockResolvedValue({
      ruleId: 'rule-1',
      grossAmountCad: '10',
      feeAmountCad: '1',
      netAmountCad: '9',
      feeModel: 'flat',
      percentageRateApplied: null,
      flatFeeApplied: '1',
    });
    m.generateClaimToken.mockReturnValue('claim-token-123');
    m.computeClaimExpiry.mockReturnValue(new Date('2026-06-30T00:00:00.000Z'));
    m.auditLog.mockResolvedValue(undefined);
  });

  it('rejects requests without a stripe signature header', async () => {
    const { POST } = await loadRoute('whsec_test');
    const response = await POST(makeStripeRequest(JSON.stringify({ id: 'evt_1' }), 'whsec_test', false));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'Missing stripe-signature header' });
  }, 60000);

  it('rejects requests with an invalid signature', async () => {
    const { POST } = await loadRoute('whsec_test');
    const response = await POST(new NextRequest('http://localhost/api/payments/webhooks/stripe', {
      method: 'POST',
      body: JSON.stringify({ id: 'evt_1', type: 'payment_intent.succeeded', data: { object: {} } }),
      headers: {
        'content-type': 'application/json',
        'stripe-signature': `t=1700000000,v1=${'0'.repeat(64)}`,
      },
    }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: 'Invalid signature' });
  });

  it('rejects requests when the webhook secret is missing', async () => {
    const { POST } = await loadRoute('');
    const payload = JSON.stringify({ id: 'evt_1', type: 'payment_intent.succeeded', data: { object: {} } });
    const response = await POST(makeStripeRequest(payload, 'fallback-secret'));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: 'Webhook secret not configured' });
  });

  it('short-circuits duplicate events', async () => {
    const { POST } = await loadRoute('whsec_test');
    m.queueSelect([{ id: 'existing-payment' }]);
    const payload = JSON.stringify({ id: 'evt_duplicate', type: 'invoice.paid', data: { object: {} } });

    const response = await POST(makeStripeRequest(payload, 'whsec_test'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ received: true, status: 'duplicate' });
  });

  it('records a successful payment intent and captures the transaction fee', async () => {
    const { POST } = await loadRoute('whsec_test');
    m.queueSelect([], [{ id: 'billing-1' }]);
    const payload = JSON.stringify({
      id: 'evt_payment_1',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_123',
          amount: 1000,
          currency: 'cad',
          metadata: { organization_id: TEST_ORG_ID },
        },
      },
    });

    const response = await POST(makeStripeRequest(payload, 'whsec_test'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ received: true });
    expect(mockDb.insert).toHaveBeenCalled();
    expect(m.evaluateFee).toHaveBeenCalledWith(expect.objectContaining({ organizationId: TEST_ORG_ID, flowType: 'payment' }));
    expect(m.captureTransactionFee).toHaveBeenCalledWith(expect.objectContaining({
      idempotencyKey: 'fee-evt_payment_1',
      sourceTransactionId: 'pi_123',
    }));
  });

  it('reconciles invoice.paid events and captures invoice fees', async () => {
    const { POST } = await loadRoute('whsec_test');
    m.queueSelect([], [{ id: 'billing-1' }]);
    const payload = JSON.stringify({
      id: 'evt_invoice_paid_1',
      type: 'invoice.paid',
      data: {
        object: {
          id: 'in_123',
          amount_paid: 2500,
          currency: 'cad',
          metadata: {
            organization_id: TEST_ORG_ID,
            platform_invoice_id: 'platform-invoice-1',
          },
        },
      },
    });

    const response = await POST(makeStripeRequest(payload, 'whsec_test'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ received: true });
    expect(m.reconcileExternalInvoicePayment).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: TEST_ORG_ID,
      invoiceId: 'platform-invoice-1',
      status: 'completed',
    }));
    expect(m.captureTransactionFee).toHaveBeenCalledWith(expect.objectContaining({
      sourceTransactionType: 'stripe_invoice',
      idempotencyKey: 'fee-evt_invoice_paid_1',
    }));
  });

  it('marks invoice.payment_failed as failed reconciliation', async () => {
    const { POST } = await loadRoute('whsec_test');
    m.queueSelect([]);
    const payload = JSON.stringify({
      id: 'evt_invoice_failed_1',
      type: 'invoice.payment_failed',
      data: {
        object: {
          id: 'in_999',
          amount_due: 3200,
          metadata: {
            organization_id: TEST_ORG_ID,
            platform_invoice_id: 'platform-invoice-2',
          },
        },
      },
    });

    const response = await POST(makeStripeRequest(payload, 'whsec_test'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ received: true });
    expect(m.reconcileExternalInvoicePayment).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: TEST_ORG_ID,
      invoiceId: 'platform-invoice-2',
      status: 'failed',
      failureReason: 'stripe_invoice_payment_failed',
    }));
  });

  it('records charge.refunded events and reverses captured fees', async () => {
    const { POST } = await loadRoute('whsec_test');
    m.queueSelect([], [{ id: 'billing-1' }], [{ id: 'fee-event-1' }]);
    const payload = JSON.stringify({
      id: 'evt_refund_1',
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_123',
          payment_intent: 'pi_123',
          amount_refunded: 1400,
          currency: 'cad',
          metadata: {
            organization_id: TEST_ORG_ID,
          },
        },
      },
    });

    const response = await POST(makeStripeRequest(payload, 'whsec_test'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ received: true });
    expect(mockDb.insert).toHaveBeenCalled();
    expect(m.reverseTransactionFee).toHaveBeenCalledWith(
      'fee-event-1',
      'ch_123',
      expect.stringContaining('Stripe refund'),
    );
  });

  it('upgrades workbook purchases and issues a claim token', async () => {
    const { POST } = await loadRoute('whsec_test');
    m.queueSelect([], [{ reportTierId: 'continuity_reflection', claimToken: null }]);
    m.queueUpdate([]);
    const payload = JSON.stringify({
      id: 'evt_workbook_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          payment_intent: 'pi_123',
          amount_total: 12500,
          currency: 'cad',
          customer_email: 'buyer@example.com',
          metadata: {
            product: 'workbook',
            workbook_id: 'workbook-1',
            workbook_tier_id: 'workbook_self_guided',
            organization_name: 'Union Eyes',
          },
        },
      },
    });

    const response = await POST(makeStripeRequest(payload, 'whsec_test'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ received: true });
    expect(mockDb.update).toHaveBeenCalled();
    expect(m.syncWorkbookPurchase).toHaveBeenCalledWith(expect.objectContaining({
      workbookId: 'workbook-1',
      paymentReference: 'pi_123',
      email: 'buyer@example.com',
    }));
  });

  it('returns a non-retrying success envelope on internal parsing errors', async () => {
    const { POST } = await loadRoute('whsec_test');
    const response = await POST(makeStripeRequest('not-json', 'whsec_test'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      received: true,
      error: 'Internal processing error',
    });
  });
});