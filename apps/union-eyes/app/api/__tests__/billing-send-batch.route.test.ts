import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  db: { select: vi.fn() },
  generateInvoice: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, ApiError: { notFound: (msg: string) => Object.assign(new Error(msg), { status: 404 }) }, RATE_LIMITS: { FINANCIAL_WRITE: 'FINANCIAL_WRITE' }, z: require('zod') }));
vi.mock('@/services/platform-economics', () => ({ generateInvoice: m.generateInvoice }));
vi.mock('@/db', () => ({ db: m.db }));
vi.mock('@/db/schema', () => ({ billingPeriods: { id: 'id' }, orgSubscriptions: { status: 'status', organizationId: 'organizationId' } }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../billing/send-batch/route');
}

describe('billing/send-batch route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.generateInvoice.mockResolvedValue({ id: 'inv_1' });
    m.db.select
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: 'bp_1' }]) })) })) }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ organizationId: 'org_1' }]) })) }));
  });

  it('batch-generates invoices', async () => {
    const { POST } = await loadRoute();
    const result = await POST({ body: { billingPeriodId: '550e8400-e29b-41d4-a716-446655440000' }, userId: 'u1' });

    expect(result).toEqual({ total: 1, succeeded: 1, failed: 0, results: [{ organizationId: 'org_1', invoiceId: 'inv_1' }] });
  });
});