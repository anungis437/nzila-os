import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorCode } from '@/lib/api/errors';

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

const REFUSAL = { status: 501, code: ErrorCode.NOT_IMPLEMENTED, message: 'Finance and dues persistence are not available in this release.' };

describe('/api/dues/payment-history route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => handler);
  });

  it.each([
    ['no limit', 'https://example.test/api/dues/payment-history'],
    ['an explicit limit', 'https://example.test/api/dues/payment-history?limit=10'],
  ])('is refused with 501 and queries no ledger, with %s', async (_label, url) => {
    const { GET } = await loadRoute();

    await expect(GET({ userId: 'user_1', organizationId: 'org_1', request: { url } as any })).rejects.toMatchObject(REFUSAL);
    expect(m.select).not.toHaveBeenCalled();
  });

  it('returns empty data when context is missing, without querying the database', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ userId: null, organizationId: null, request: {} as any });
    expect(result).toEqual({ data: [] });
    expect(m.select).not.toHaveBeenCalled();
  });
});
