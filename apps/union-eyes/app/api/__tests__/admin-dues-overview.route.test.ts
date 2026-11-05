import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  ApiError: { badRequest: vi.fn((msg: string) => { throw new Error(msg); }) },
  db: { select: vi.fn(), execute: vi.fn() },
  withRLSContext: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, ApiError: m.ApiError, z: require('zod') }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), and: vi.fn(() => 'and'), gte: vi.fn(() => 'gte'), lt: vi.fn(() => 'lt'), sql: Object.assign(vi.fn(() => 'sql'), { mapWith: vi.fn() }) };
});

async function loadRoute() {
  return import('../admin/dues/overview/route');
}

type Overview = {
  financialKpis: { totalCollected: number; totalOutstanding: number; totalOverdue: number };
  paymentStats: { pending: number; paid: number; overdue: number; total: number };
  recentPayments: Array<{ id: string; memberName: string | null; amount: number; status: string; paidDate: string | null; dueDate: string | null }>;
  periodStats: { thisMonth: { collected: number; outstanding: number; transactionCount: number }; lastMonth: { collected: number; outstanding: number; transactionCount: number } };
};

// The route reads in this order: ledger KPIs, arrears, payment counts by status, the recent payments (a raw statement), this month, last month.
function stubReads(recentPayments: Array<Record<string, unknown>>) {
  m.db.select
    .mockImplementationOnce(() => ({ from: () => ({ where: async () => [{ totalCollected: '500', totalCharged: '600' }] }) }))
    .mockImplementationOnce(() => ({ from: () => ({ where: async () => [{ totalOverdue: '100', overdueCount: '2' }] }) }))
    .mockImplementationOnce(() => ({ from: () => ({ where: () => ({ groupBy: async () => [{ status: 'posted', count: '5' }, { status: 'pending', count: '1' }] }) }) }))
    .mockImplementationOnce(() => ({ from: () => ({ where: async () => [{ collected: '100', outstanding: '50', txCount: '2' }] }) }))
    .mockImplementationOnce(() => ({ from: () => ({ where: async () => [{ collected: '80', outstanding: '40', txCount: '1' }] }) }));
  m.db.execute.mockResolvedValue(recentPayments);
}

describe('admin/dues/overview route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.db.select.mockReset();
    m.withApi.mockImplementation((_cfg: unknown, handler: any) => (ctx: any = {}) => handler(ctx));
    m.withRLSContext.mockImplementation(async (fn: any) => fn());
  });

  it('refuses a request without an organization', async () => {
    const { GET } = await loadRoute();
    await expect(GET({ organizationId: undefined })).rejects.toThrow('Organization context required');
  });

  it('answers the KPIs, the status counts and both months from the ledger rows it read', async () => {
    stubReads([]);
    const { GET } = await loadRoute();
    const overview = (await GET({ organizationId: 'org_1' })) as Overview;
    expect(overview.financialKpis).toEqual({ totalCollected: 500, totalOutstanding: 100, totalOverdue: 100 });
    expect(overview.paymentStats).toEqual({ pending: 1, paid: 5, overdue: 2, total: 6 });
    expect(overview.periodStats).toEqual({
      thisMonth: { collected: 100, outstanding: 50, transactionCount: 2 },
      lastMonth: { collected: 80, outstanding: 40, transactionCount: 1 },
    });
    expect(overview.recentPayments).toEqual([]);
  });

  it('names a payment\'s member only when the roster has one: no invented name and no raw user id', async () => {
    stubReads([
      { id: 'p1', amount: '-25.00', status: 'posted', transactionDate: '2026-03-02T00:00:00.000Z', periodStart: '2026-03-01T00:00:00.000Z', userId: 'user-1', memberName: 'Alex Tremblay' },
      { id: 'p2', amount: '30.00', status: 'pending', transactionDate: '2026-03-03T00:00:00.000Z', periodStart: null, userId: 'user-2', memberName: null },
    ]);
    const { GET } = await loadRoute();
    const { recentPayments } = (await GET({ organizationId: 'org_1' })) as Overview;
    expect(recentPayments[0]).toMatchObject({ id: 'p1', memberName: 'Alex Tremblay', amount: -25, status: 'posted' });
    expect(recentPayments[1]).toMatchObject({ id: 'p2', memberName: null, amount: 30, dueDate: null });
    expect(JSON.stringify(recentPayments)).not.toMatch(/Unknown|user-2/);
  });
});
