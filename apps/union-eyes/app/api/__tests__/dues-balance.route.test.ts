import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  select: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
}));
vi.mock('@/db/db', () => ({ db: { select: m.select } }));
vi.mock('@/db/schema/dues-finance-schema', () => ({
  memberDuesLedger: {
    id: 'id',
    userId: 'userId',
    organizationId: 'organizationId',
    transactionType: 'transactionType',
    amount: 'amount',
    status: 'status',
    transactionDate: 'transactionDate',
  },
}));

async function loadRoute() {
  return import('../dues/balance/route');
}

describe('/api/dues/balance route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => handler);
  });

  it('returns source: unavailable and never fabricates a balance when context is missing', async () => {
    const { GET } = await loadRoute();

    const result = await GET({ userId: null, organizationId: null });

    expect(result).toEqual({
      source: 'unavailable',
      currentBalance: 0,
      balanceStatus: 'paid_up',
      isInArrears: false,
      arrearsAmount: 0,
      lastPayment: null,
    });
    expect(m.select).not.toHaveBeenCalled();
  });

  it('computes a real balance from member_dues_ledger scoped to the authenticated member', async () => {
    const whereCalls: unknown[] = [];
    m.select
      .mockImplementationOnce(() => ({
        from: vi.fn(() => ({
          where: vi.fn((cond: unknown) => {
            whereCalls.push(cond);
            return Promise.resolve([
              {
                totalCharges: '100.00',
                totalPayments: '40.00',
                totalCredits: '0.00',
                totalAdjustments: '0.00',
                totalWriteOffs: '0.00',
              },
            ]);
          }),
        })),
      }))
      .mockImplementationOnce(() => ({
        from: vi.fn(() => ({
          where: vi.fn((cond: unknown) => {
            whereCalls.push(cond);
            return {
              orderBy: vi.fn(() => ({
                limit: vi.fn(async () => [
                  { amount: '40.00', date: new Date('2026-06-15T00:00:00.000Z') },
                ]),
              })),
            };
          }),
        })),
      }));

    const { GET } = await loadRoute();
    const result = await GET({ userId: 'user_1', organizationId: 'org_1' });

    expect(result).toEqual({
      source: 'native',
      currentBalance: 60,
      balanceStatus: 'owing',
      isInArrears: true,
      arrearsAmount: 60,
      lastPayment: { amount: 40, date: '2026-06-15T00:00:00.000Z' },
    });
    expect(whereCalls).toHaveLength(2);
  });

  it('reports paid_up with no last payment when the ledger has no entries', async () => {
    m.select
      .mockImplementationOnce(() => ({
        from: vi.fn(() => ({
          where: vi.fn(async () => [
            {
              totalCharges: '0.00',
              totalPayments: '0.00',
              totalCredits: '0.00',
              totalAdjustments: '0.00',
              totalWriteOffs: '0.00',
            },
          ]),
        })),
      }))
      .mockImplementationOnce(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({ limit: vi.fn(async () => []) })),
          })),
        })),
      }));

    const { GET } = await loadRoute();
    const result = await GET({ userId: 'user_2', organizationId: 'org_1' });

    expect(result).toMatchObject({
      source: 'native',
      currentBalance: 0,
      balanceStatus: 'paid_up',
      isInArrears: false,
      arrearsAmount: 0,
      lastPayment: null,
    });
  });
});
