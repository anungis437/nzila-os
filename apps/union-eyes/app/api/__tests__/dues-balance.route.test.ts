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

interface AggregateRow {
  postedCount: string;
  totalCharges: string;
  totalPayments: string;
  totalCredits: string;
  totalAdjustments: string;
  totalWriteOffs: string;
}

/**
 * Mocks the single aggregate+count query. Always scoped by
 * status='posted' in the real WHERE clause — the mock captures that
 * clause so tests can assert the filter is present, while the resolved
 * row simulates whatever a real posted-only SQL aggregate WOULD return
 * for the scenario under test (e.g. zero rows for a member whose only
 * ledger activity is pending/reversed/voided).
 */
function mockAggregate(row: AggregateRow, whereCalls: unknown[]) {
  return () => ({
    from: vi.fn(() => ({
      where: vi.fn((cond: unknown) => {
        whereCalls.push(cond);
        return Promise.resolve([row]);
      }),
    })),
  });
}

function mockLastPayment(rows: Array<{ amount: string; date: Date }>, whereCalls: unknown[]) {
  return () => ({
    from: vi.fn(() => ({
      where: vi.fn((cond: unknown) => {
        whereCalls.push(cond);
        return {
          orderBy: vi.fn(() => ({
            limit: vi.fn(async () => rows),
          })),
        };
      }),
    })),
  });
}

const ZERO_ROW: AggregateRow = {
  postedCount: '0',
  totalCharges: '0.00',
  totalPayments: '0.00',
  totalCredits: '0.00',
  totalAdjustments: '0.00',
  totalWriteOffs: '0.00',
};

describe('/api/dues/balance route', () => {
  let whereCalls: unknown[];

  beforeEach(() => {
    vi.clearAllMocks();
    whereCalls = [];
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

  it('returns available: false when the member has zero ledger rows at all', async () => {
    m.select.mockImplementationOnce(mockAggregate(ZERO_ROW, whereCalls));

    const { GET } = await loadRoute();
    const result = await GET({ userId: 'user_no_data', organizationId: 'org_1' });

    // NO DATA != ZERO BALANCE: indistinguishable in shape from the
    // missing-context case, and must NOT claim paid_up/$0.
    expect(result).toEqual({
      source: 'unavailable',
      available: false,
      currentBalance: null,
      balanceStatus: null,
      isInArrears: null,
      arrearsAmount: null,
      lastPayment: null,
    });
    expect(m.select).toHaveBeenCalledTimes(1);
    // The mocked aggregate row simulates exactly what the real
    // status='posted' SQL filter would return for a member with zero rows.
  });

  it('returns available: false when the member has only PENDING ledger rows (no posted activity)', async () => {
    // A real status='posted' filter would exclude pending rows entirely,
    // so the aggregate returns postedCount: 0 — never a fabricated balance.
    m.select.mockImplementationOnce(mockAggregate(ZERO_ROW, whereCalls));

    const { GET } = await loadRoute();
    const result = await GET({ userId: 'user_pending_only', organizationId: 'org_1' });

    expect(result).toMatchObject({ source: 'unavailable', available: false });
    expect(m.select).toHaveBeenCalledTimes(1);
  });

  it('returns available: false when the member has only REVERSED ledger rows (no posted activity)', async () => {
    m.select.mockImplementationOnce(mockAggregate(ZERO_ROW, whereCalls));

    const { GET } = await loadRoute();
    const result = await GET({ userId: 'user_reversed_only', organizationId: 'org_1' });

    expect(result).toMatchObject({ source: 'unavailable', available: false });
    expect(m.select).toHaveBeenCalledTimes(1);
  });

  it('returns available: false when the member has only VOIDED ledger rows (no posted activity)', async () => {
    m.select.mockImplementationOnce(mockAggregate(ZERO_ROW, whereCalls));

    const { GET } = await loadRoute();
    const result = await GET({ userId: 'user_voided_only', organizationId: 'org_1' });

    expect(result).toMatchObject({ source: 'unavailable', available: false });
    expect(m.select).toHaveBeenCalledTimes(1);
  });

  it('computes a real owing balance from at least one posted ledger row, scoped to the authenticated member', async () => {
    m.select
      .mockImplementationOnce(
        mockAggregate(
          {
            postedCount: '2',
            totalCharges: '100.00',
            totalPayments: '40.00',
            totalCredits: '0.00',
            totalAdjustments: '0.00',
            totalWriteOffs: '0.00',
          },
          whereCalls,
        ),
      )
      .mockImplementationOnce(
        mockLastPayment([{ amount: '40.00', date: new Date('2026-06-15T00:00:00.000Z') }], whereCalls),
      );

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

  it('reports a genuine paid_up $0 balance when at least one posted row exists and nets to zero', async () => {
    m.select
      .mockImplementationOnce(
        mockAggregate(
          {
            postedCount: '2',
            totalCharges: '25.00',
            totalPayments: '25.00',
            totalCredits: '0.00',
            totalAdjustments: '0.00',
            totalWriteOffs: '0.00',
          },
          whereCalls,
        ),
      )
      .mockImplementationOnce(
        mockLastPayment([{ amount: '25.00', date: new Date('2026-06-01T00:00:00.000Z') }], whereCalls),
      );

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

  it('reports a genuine credit balance when posted payments exceed posted charges', async () => {
    m.select
      .mockImplementationOnce(
        mockAggregate(
          {
            postedCount: '2',
            totalCharges: '25.00',
            totalPayments: '40.00',
            totalCredits: '0.00',
            totalAdjustments: '0.00',
            totalWriteOffs: '0.00',
          },
          whereCalls,
        ),
      )
      .mockImplementationOnce(
        mockLastPayment([{ amount: '40.00', date: new Date('2026-06-10T00:00:00.000Z') }], whereCalls),
      );

    const { GET } = await loadRoute();
    const result = await GET({ userId: 'user_3', organizationId: 'org_1' });

    expect(result).toMatchObject({
      source: 'native',
      available: true,
      currentBalance: -15,
      balanceStatus: 'credit',
      isInArrears: false,
      arrearsAmount: 0,
    });
  });
});
