import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorCode } from '@/lib/api/errors';

const REFUSAL = {
  status: 501,
  code: ErrorCode.NOT_IMPLEMENTED,
  message: 'Finance and dues persistence are not available in this release.',
};

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

  it.each([
    ['no ledger rows at all', ZERO_ROW, []],
    ['only non-posted ledger rows (pending, reversed or voided)', ZERO_ROW, []],
    [
      'posted rows that would net to an owing balance',
      { ...ZERO_ROW, postedCount: '2', totalCharges: '100.00', totalPayments: '40.00' },
      [{ amount: '40.00', date: new Date('2026-06-15T00:00:00.000Z') }],
    ],
    [
      'posted rows that would net to paid up',
      { ...ZERO_ROW, postedCount: '2', totalCharges: '25.00', totalPayments: '25.00' },
      [{ amount: '25.00', date: new Date('2026-06-01T00:00:00.000Z') }],
    ],
    [
      'posted rows that would net to a credit',
      { ...ZERO_ROW, postedCount: '2', totalCharges: '25.00', totalPayments: '40.00' },
      [{ amount: '40.00', date: new Date('2026-06-10T00:00:00.000Z') }],
    ],
  ])('refuses with 501 and fabricates no balance, whatever the ledger holds (%s)', async (_label, row, lastPayments) => {
    m.select
      .mockImplementationOnce(mockAggregate(row, whereCalls))
      .mockImplementationOnce(mockLastPayment(lastPayments, whereCalls));

    const { GET } = await loadRoute();
    await expect(GET({ userId: 'user_1', organizationId: 'org_1' })).rejects.toMatchObject(REFUSAL);

    expect(m.select).not.toHaveBeenCalled();
    expect(whereCalls).toHaveLength(0);
  });
});
