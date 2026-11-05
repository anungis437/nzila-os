import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const PERIOD = '550e8400-e29b-41d4-a716-446655440000';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withRLSContext: vi.fn(),
  requireLiveFinancialMandate: vi.fn(),
  tx: { select: vi.fn() },
  generateInvoice: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: {
    forbidden: (msg: string) => Object.assign(new Error(msg), { status: 403 }),
    notFound: (msg: string) => Object.assign(new Error(msg), { status: 404 }),
    badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }),
  },
  RATE_LIMITS: { FINANCIAL_WRITE: 'FINANCIAL_WRITE' },
  z: require('zod'),
}));
vi.mock('@/services/platform-economics', () => ({ generateInvoice: m.generateInvoice }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/finance/require-live-financial-mandate', () => ({
  requireLiveFinancialMandate: m.requireLiveFinancialMandate,
}));
vi.mock('@/db/schema', () => ({
  billingPeriods: { id: 'periodId', organizationId: 'periodOrganizationId' },
  orgSubscriptions: { status: 'status', organizationId: 'subscriptionOrganizationId' },
}));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn((column, value) => ({ column, value })), and: vi.fn((...clauses) => ({ clauses })) };
});

function selectRows(period: unknown, subscriptions: unknown[]) {
  m.tx.select
    .mockImplementationOnce(() => ({
      from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => period ? [period] : []) })) })),
    }))
    .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => subscriptions) })) }));
}

async function loadRoute() { return import('../billing/send-batch/route'); }

describe('billing/send-batch financial mandate and tenant isolation', () => {
  beforeEach(() => {
    // Re-evaluate the route module so withApi registration is observable in every test.
    // clearAllMocks alone preserves Vitest's ESM module cache across test cases.
    vi.resetModules();
    vi.clearAllMocks();
    m.tx.select.mockReset();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.withRLSContext.mockImplementation((_ctx: unknown, callback: (tx: unknown) => Promise<unknown>) => callback(m.tx));
    m.requireLiveFinancialMandate.mockResolvedValue({ mandateId: 'live-mandate', ledgerWide: true });
    m.generateInvoice.mockResolvedValue({ id: 'inv_1' });
  });

  it('generates only the current organization invoice after principal mandate and tenant-bound reads', async () => {
    selectRows({ id: PERIOD, organizationId: ORG_A, isClosed: false }, [{ organizationId: ORG_A }]);
    const { POST } = await loadRoute();
    const result = await POST({ body: { billingPeriodId: PERIOD }, userId: 'u1', organizationId: ORG_A });
    expect(result).toEqual({ total: 1, succeeded: 1, failed: 0, results: [{ organizationId: ORG_A, invoiceId: 'inv_1' }] });
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: ORG_A, userId: 'u1' }, expect.any(Function));
    expect(m.requireLiveFinancialMandate).toHaveBeenCalledWith(m.tx, {
      organizationId: ORG_A, userId: 'u1', action: 'finance:execute', requiresLedger: true,
    });
    expect(m.generateInvoice).toHaveBeenCalledWith({ organizationId: ORG_A, billingPeriodId: PERIOD, createdBy: 'u1' });
    expect(eq).toHaveBeenCalledWith('periodOrganizationId', ORG_A);
    expect(eq).toHaveBeenCalledWith('subscriptionOrganizationId', ORG_A);
    expect(m.requireLiveFinancialMandate.mock.invocationCallOrder[0]).toBeLessThan(m.tx.select.mock.invocationCallOrder[0]);
    expect(m.tx.select.mock.invocationCallOrder[0]).toBeLessThan(m.generateInvoice.mock.invocationCallOrder[0]);
  });

  it('requires both authenticated organization and principal before database access', async () => {
    const { POST } = await loadRoute();
    await expect(POST({ body: { billingPeriodId: PERIOD }, userId: 'u1' })).rejects.toThrow('Authenticated organization');
    await expect(POST({ body: { billingPeriodId: PERIOD }, organizationId: ORG_A })).rejects.toThrow('Authenticated organization');
    expect(m.withRLSContext).not.toHaveBeenCalled();
    expect(m.generateInvoice).not.toHaveBeenCalled();
  });

  it('refuses absent or revoked mandate before reading any financial records', async () => {
    m.requireLiveFinancialMandate.mockRejectedValue(new Error('FINANCIAL_MANDATES_NOT_ISSUED'));
    const { POST } = await loadRoute();
    await expect(POST({ body: { billingPeriodId: PERIOD }, userId: 'u1', organizationId: ORG_A }))
      .rejects.toThrow('FINANCIAL_MANDATES_NOT_ISSUED');
    expect(m.tx.select).not.toHaveBeenCalled();
    expect(m.generateInvoice).not.toHaveBeenCalled();
  });

  it('refuses a foreign billing period without issuing an invoice', async () => {
    selectRows({ id: PERIOD, organizationId: ORG_B }, [{ organizationId: ORG_B }]);
    const { POST } = await loadRoute();
    await expect(POST({ body: { billingPeriodId: PERIOD }, userId: 'u1', organizationId: ORG_A }))
      .rejects.toThrow('Billing period not found');
    expect(m.generateInvoice).not.toHaveBeenCalled();
  });

  it('refuses a closed billing period before subscription lookup or mutation', async () => {
    selectRows({ id: PERIOD, organizationId: ORG_A, isClosed: true }, []);
    const { POST } = await loadRoute();
    await expect(POST({ body: { billingPeriodId: PERIOD }, userId: 'u1', organizationId: ORG_A }))
      .rejects.toThrow('closed billing period');
    expect(m.tx.select).toHaveBeenCalledTimes(1);
    expect(m.generateInvoice).not.toHaveBeenCalled();
  });

  it('preflights all subscription tenant identities before generating an invoice', async () => {
    selectRows({ id: PERIOD, organizationId: ORG_A }, [{ organizationId: ORG_A }, { organizationId: ORG_B }]);
    const { POST } = await loadRoute();
    await expect(POST({ body: { billingPeriodId: PERIOD }, userId: 'u1', organizationId: ORG_A }))
      .rejects.toThrow('Subscription organization mismatch');
    expect(m.generateInvoice).not.toHaveBeenCalled();
  });

  it('refuses multiple active subscriptions rather than silently invoicing the first', async () => {
    selectRows({ id: PERIOD, organizationId: ORG_A }, [{ organizationId: ORG_A }, { organizationId: ORG_A }]);
    const { POST } = await loadRoute();
    await expect(POST({ body: { billingPeriodId: PERIOD }, userId: 'u1', organizationId: ORG_A }))
      .rejects.toThrow('Multiple active subscriptions');
    expect(m.generateInvoice).not.toHaveBeenCalled();
  });

  it('reports zero invoices only when there really are no active subscriptions', async () => {
    selectRows({ id: PERIOD, organizationId: ORG_A }, []);
    const { POST } = await loadRoute();
    expect(await POST({ body: { billingPeriodId: PERIOD }, userId: 'u1', organizationId: ORG_A }))
      .toEqual({ total: 0, succeeded: 0, failed: 0, results: [] });
    expect(m.generateInvoice).not.toHaveBeenCalled();
  });

  it('propagates invoice transaction failure rather than returning a successful batch', async () => {
    selectRows({ id: PERIOD, organizationId: ORG_A }, [{ organizationId: ORG_A }]);
    m.generateInvoice.mockRejectedValue(new Error('atomic invoice audit failed'));
    const { POST } = await loadRoute();
    await expect(POST({ body: { billingPeriodId: PERIOD }, userId: 'u1', organizationId: ORG_A }))
      .rejects.toThrow('atomic invoice audit failed');
  });

  it('requires an authenticated principal and financial entitlement in route configuration', async () => {
    await loadRoute();
    expect(m.withApi).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: expect.objectContaining({ required: true, minRole: 'admin' }),
        requireOrg: true,
        entitlement: 'financial_intelligence_suite',
      }),
      expect.any(Function),
    );
  });
});
