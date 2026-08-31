import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  select: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
}));
vi.mock('@/db', () => ({ db: { select: m.select } }));
vi.mock('@/db/schema/dues-finance-schema', () => ({
  memberDuesLedger: {
    id: 'id',
    userId: 'userId',
    organizationId: 'organizationId',
    transactionType: 'transactionType',
    transactionDate: 'transactionDate',
  },
}));
vi.mock('drizzle-orm', () => ({
  and: (...conds: unknown[]) => ({ and: conds }),
  eq: (col: unknown, val: unknown) => ({ eq: [col, val] }),
  desc: (col: unknown) => ({ desc: col }),
}));

async function loadRoute() {
  return import('../dues/payment-history/route');
}

describe('/api/dues/payment-history route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => handler);
  });

  it('queries member_dues_ledger scoped by authenticated userId + organizationId + transactionType=payment (not platformPayments, not org-only)', async () => {
    let capturedWhere: any;
    const orderBy = vi.fn(() => ({
      limit: vi.fn(async () => [
        {
          id: 'p1',
          transactionDate: new Date('2026-05-01T00:00:00.000Z'),
          amount: '25.00',
          status: 'posted',
          paymentMethod: 'payroll',
          periodStart: null,
          periodEnd: null,
          receiptNumber: 'R-1',
        },
      ]),
    }));
    m.select.mockImplementation(() => ({
      from: vi.fn(() => ({
        where: vi.fn((cond: unknown) => {
          capturedWhere = cond;
          return { orderBy };
        }),
      })),
    }));

    const { GET } = await loadRoute();
    const result = await GET({
      userId: 'user_1',
      organizationId: 'org_1',
      request: { url: 'https://example.test/api/dues/payment-history' } as any,
    });

    // Scoped by all three fields — no cross-member leak, no wrong table.
    expect(capturedWhere.and).toEqual([
      { eq: ['userId', 'user_1'] },
      { eq: ['organizationId', 'org_1'] },
      { eq: ['transactionType', 'payment'] },
    ]);
    expect(result).toEqual({
      data: [
        {
          id: 'p1',
          date: '2026-05-01T00:00:00.000Z',
          amount: 25,
          lateFeeAmount: 0,
          totalAmount: 25,
          status: 'completed',
          paymentMethod: 'payroll',
          periodStart: '2026-05-01T00:00:00.000Z',
          periodEnd: '2026-05-01T00:00:00.000Z',
          receiptUrl: '/api/dues/receipt/p1',
        },
      ],
    });
  });

  it('returns empty data when context is missing, without querying the database', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ userId: null, organizationId: null, request: {} as any });
    expect(result).toEqual({ data: [] });
    expect(m.select).not.toHaveBeenCalled();
  });
});
