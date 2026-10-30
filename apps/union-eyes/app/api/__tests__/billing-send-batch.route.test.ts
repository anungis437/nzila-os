import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';
const PERIOD = '550e8400-e29b-41d4-a716-446655440000';

const m = vi.hoisted(() => ({ withApi: vi.fn(), db: { select: vi.fn() }, generateInvoice: vi.fn() }));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: {
    notFound: (msg: string) => Object.assign(new Error(msg), { status: 404 }),
    badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }),
  },
  RATE_LIMITS: { FINANCIAL_WRITE: 'FINANCIAL_WRITE' },
  z: require('zod'),
}));
vi.mock('@/services/platform-economics', () => ({ generateInvoice: m.generateInvoice }));
vi.mock('@/db', () => ({ db: m.db }));
vi.mock('@/db/schema', () => ({
  billingPeriods: { id: 'periodId', organizationId: 'periodOrganizationId' },
  orgSubscriptions: { status: 'status', organizationId: 'subscriptionOrganizationId' },
}));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn((column, value) => ({ column, value })), and: vi.fn((...clauses) => ({ clauses })) };
});

function selectRows(period: unknown, subscriptions: unknown[]) {
  m.db.select
    .mockImplementationOnce(() => ({
      from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => period ? [period] : []) })) })),
    }))
    .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => subscriptions) })) }));
}

async function loadRoute() { return import('../billing/send-batch/route'); }

describe('billing/send-batch tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.generateInvoice.mockResolvedValue({ id: 'inv_1' });
  });

  it('generates only the caller organization invoices and applies both SQL tenant predicates', async () => {
    selectRows({ id: PERIOD, organizationId: ORG_A }, [{ organizationId: ORG_A }]);
    const { POST } = await loadRoute();
    const result = await POST({ body: { billingPeriodId: PERIOD }, userId: 'u1', organizationId: ORG_A });
    expect(result).toEqual({ total: 1, succeeded: 1, failed: 0, results: [{ organizationId: ORG_A, invoiceId: 'inv_1' }] });
    expect(m.generateInvoice).toHaveBeenCalledWith({ organizationId: ORG_A, billingPeriodId: PERIOD, createdBy: 'u1' });
    expect(eq).toHaveBeenCalledWith('periodOrganizationId', ORG_A);
    expect(eq).toHaveBeenCalledWith('subscriptionOrganizationId', ORG_A);
  });

  it('refuses missing organization context without touching billing records', async () => {
    const { POST } = await loadRoute();
    await expect(POST({ body: { billingPeriodId: PERIOD }, userId: 'u1' })).rejects.toThrow('Organization context required');
    expect(m.db.select).not.toHaveBeenCalled();
    expect(m.generateInvoice).not.toHaveBeenCalled();
  });

  it('refuses a foreign billing period', async () => {
    selectRows({ id: PERIOD, organizationId: ORG_B }, [{ organizationId: ORG_B }]);
    const { POST } = await loadRoute();
    await expect(POST({ body: { billingPeriodId: PERIOD }, userId: 'u1', organizationId: ORG_A })).rejects.toThrow('Billing period not found');
    expect(m.generateInvoice).not.toHaveBeenCalled();
  });

  it('preflights every subscription before creating any invoice', async () => {
    selectRows({ id: PERIOD, organizationId: ORG_A }, [
      { organizationId: ORG_A }, { organizationId: ORG_B },
    ]);
    const { POST } = await loadRoute();
    await expect(POST({ body: { billingPeriodId: PERIOD }, userId: 'u1', organizationId: ORG_A })).rejects.toThrow('Subscription organization mismatch');
    expect(m.generateInvoice).not.toHaveBeenCalled();
  });

  it('refuses a foreign subscription even if an adapter returns it', async () => {
    selectRows({ id: PERIOD, organizationId: ORG_A }, [{ organizationId: ORG_B }]);
    const { POST } = await loadRoute();
    await expect(POST({ body: { billingPeriodId: PERIOD }, userId: 'u1', organizationId: ORG_A })).rejects.toThrow('Subscription organization mismatch');
    expect(m.generateInvoice).not.toHaveBeenCalled();
  });
});
