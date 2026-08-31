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

/** Mocks the existence-check select (id-only, .limit(1)). */
function mockExistenceCheck(rows: Array<{ id: string }>) {
  return () => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(async () => rows),
      })),
    })),
  });
}

describe('/api/dues/balance route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => handler);
  });

  it('returns available: false and never fabricates a balance when auth context is missing', async () => {
    const { GET } = await loadRoute();

    const result = await GET({ userId: null, organizationId: null });

    expect(result).toEqual({
      source: 'unavailable',
      available: false,
      currentBalance: null,
      balanceStatus: null,
      isInArrears: null,
      arrearsAmount: null,
      lastPayment: null,
    });
    expect(m.select).not.toHaveBeenCalled();
  });

  it('returns available: false (not a fabricated $0/paid_up balance) when the member has zero ledger rows of any kind', async () => {
    m.select.mockImplementationOnce(mockExistenceCheck([]));

    const { GET } = await loadRoute();
    const result = await GET({ userId: 'user_no_data', organizationId: 'org_1' });

    // NO DATA != ZERO BALANCE: this must be indistinguishable in shape from
    // the missing-context case, and must NOT claim paid_up/$0.
    expect(result).toEqual({
      source: 'unavailable',
      available: false,
      currentBalance: null,
      balanceStatus: null,
      isInArrears: null,
      arrearsAmount: null,
      lastPayment: null,
    });
    // Only the existence check ran — no aggregate/last-payment queries.
    expect(m.select).toHaveBeenCalledTimes(1);
  });

  it('computes a real balance from member_dues_ledger scoped to the authenticated member', async () => {
    const whereCalls: unknown[] = [];
    m.select
      .mockImplementationOnce(mockExistenceCheck([{ id: 'row_1' }]))
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

    expect(result).toMatchObject({
      source: 'native',
      available: true,
      currentBalance: 60,
      balanceStatus: 'owing',
      isInArrears: true,
      arrearsAmount: 60,
      lastPayment: { amount: 40, date: '2026-06-15T00:00:00.000Z' },
    });
    expect(typeof (result as { asOf: string }).asOf).toBe('string');
    expect(whereCalls).toHaveLength(2);
  });

  it('reports a genuine paid_up $0 balance when posted ledger rows exist but net to zero', async () => {
    m.select
      .mockImplementationOnce(mockExistenceCheck([{ id: 'row_1' }]))
      .mockImplementationOnce(() => ({
        from: vi.fn(() => ({
          where: vi.fn(async () => [
            {
              totalCharges: '25.00',
              totalPayments: '25.00',
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
            orderBy: vi.fn(() => ({
              limit: vi.fn(async () => [
                { amount: '25.00', date: new Date('2026-06-01T00:00:00.000Z') },
              ]),
            })),
          })),
        })),
      }));

    const { GET } = await loadRoute();
    const result = await GET({ userId: 'user_2', organizationId: 'org_1' });

    expect(result).toMatchObject({
      source: 'native',
      available: true,
      currentBalance: 0,
      balanceStatus: 'paid_up',
      isInArrears: false,
      arrearsAmount: 0,
      lastPayment: { amount: 25, date: '2026-06-01T00:00:00.000Z' },
    });
  });
});
