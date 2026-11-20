import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorCode } from '@/lib/api/errors';

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

const REFUSAL = { status: 501, code: ErrorCode.NOT_IMPLEMENTED, message: 'Finance and dues persistence are not available in this release.' };

describe('/api/dues/receipt/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => handler);
    m.badRequest.mockImplementation((message: string) => Object.assign(new Error(message), { status: 400 }));
    m.notFound.mockImplementation((message: string) => Object.assign(new Error(message), { status: 404 }));
  });

  it.each([
    ['an existing ledger entry', [{ id: 'r1', amount: '25.00' }]],
    ['no matching ledger entry', []],
  ])('is refused with 501 and reads no ledger, for %s', async (_label, rows) => {
    m.select.mockImplementation(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => rows) })) }));
    const { GET } = await loadRoute();

    await expect(
      GET({ organizationId: 'org_1', userId: 'user_1', params: Promise.resolve({ id: 'r1' }) }),
    ).rejects.toMatchObject(REFUSAL);
    expect(m.select).not.toHaveBeenCalled();
  });

  it('throws 400 when organization/user context is missing', async () => {
    const { GET } = await loadRoute();

    await expect(
      GET({ organizationId: null, userId: null, params: Promise.resolve({ id: 'r1' }) }),
    ).rejects.toMatchObject({ status: 400 });

    expect(m.select).not.toHaveBeenCalled();
  });
});
