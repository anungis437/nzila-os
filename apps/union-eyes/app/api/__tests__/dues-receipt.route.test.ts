import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  badRequest: vi.fn(),
  notFound: vi.fn(),
  select: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: { badRequest: m.badRequest, notFound: m.notFound },
}));
vi.mock('@/db', () => ({ db: { select: m.select } }));
vi.mock('@/db/schema/dues-finance-schema', () => ({
  memberDuesLedger: { id: 'id', organizationId: 'organizationId', userId: 'userId' },
}));
vi.mock('drizzle-orm', () => ({
  and: (...conds: unknown[]) => ({ and: conds }),
  eq: (col: unknown, val: unknown) => ({ eq: [col, val] }),
}));

async function loadRoute() {
  return import('../dues/receipt/[id]/route');
}

describe('/api/dues/receipt/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => handler);
    m.badRequest.mockImplementation((message: string) => Object.assign(new Error(message), { status: 400 }));
    m.notFound.mockImplementation((message: string) => Object.assign(new Error(message), { status: 404 }));
  });

  it('scopes the ledger lookup by id + organizationId + authenticated userId (fixes cross-member leak)', async () => {
    let capturedWhere: any;
    m.select.mockImplementation(() => ({
      from: vi.fn(() => ({
        where: vi.fn((cond: unknown) => {
          capturedWhere = cond;
          return Promise.resolve([{ id: 'r1', amount: '25.00' }]);
        }),
      })),
    }));

    const { GET } = await loadRoute();
    const result = await GET({
      organizationId: 'org_1',
      userId: 'user_1',
      params: Promise.resolve({ id: 'r1' }),
    });

    expect(capturedWhere.and).toEqual([
      { eq: ['id', 'r1'] },
      { eq: ['organizationId', 'org_1'] },
      { eq: ['userId', 'user_1'] },
    ]);
    expect(result).toEqual({ data: { id: 'r1', amount: '25.00' } });
  });

  it('throws 404 when no matching ledger entry exists for that member', async () => {
    m.select.mockImplementation(() => ({
      from: vi.fn(() => ({ where: vi.fn(async () => []) })),
    }));

    const { GET } = await loadRoute();

    await expect(
      GET({ organizationId: 'org_1', userId: 'user_1', params: Promise.resolve({ id: 'missing' }) }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('throws 400 when organization/user context is missing', async () => {
    const { GET } = await loadRoute();

    await expect(
      GET({ organizationId: null, userId: null, params: Promise.resolve({ id: 'r1' }) }),
    ).rejects.toMatchObject({ status: 400 });

    expect(m.select).not.toHaveBeenCalled();
  });
});
