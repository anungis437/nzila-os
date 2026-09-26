import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  db: { select: vi.fn(), insert: vi.fn() },
  withRLSContext: vi.fn(),
  withSystemContext: vi.fn(),
  inserted: null as Record<string, unknown> | null,
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  z: require('zod'),
  ApiError: {
    badRequest: (message: string) => {
      const error = new Error(message);
      (error as Error & { status: number }).status = 400;
      throw error;
    },
  },
}));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: m.withRLSContext,
  withSystemContext: m.withSystemContext,
}));
vi.mock('@/db/schema', () => ({ collectiveAgreements: { organizationId: 'organizationId' } }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq'), ilike: vi.fn(() => 'ilike'), and: vi.fn((...a: unknown[]) => a), or: vi.fn((...a: unknown[]) => a), sql: vi.fn(() => ({ mapWith: vi.fn() })) };
});

async function loadRoute() {
  return import('../agreements/route');
}

describe('agreements route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.inserted = null;
    m.withApi.mockImplementation((_cfg: unknown, handler: any) => (ctx: any = {}) => handler(ctx));
    m.withRLSContext.mockImplementation(async (_context: { organizationId: string }, fn: any) => fn());
    m.withSystemContext.mockImplementation(async (fn: any) => fn());

    m.db.insert = vi.fn();
    m.db.select.mockImplementation(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({ limit: vi.fn(() => ({ offset: vi.fn(async () => [{ id: 'a1', title: 'CBA 2025' }]) })) })),
        })),
      })),
    }));
  });

  it('returns agreements list in the active organization tenant context', async () => {
    m.db.select
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn(() => ({ offset: vi.fn(async () => [{ id: 'a1', title: 'CBA 2025' }]) })) })) })) })) }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ count: 1 }]) })) }));

    const { GET } = await loadRoute();
    const result = await GET({ request: new Request('http://localhost/api/agreements'), organizationId: 'org_1', userId: 'u1' });
    expect(result.data).toEqual([{ id: 'a1', title: 'CBA 2025' }]);
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org_1' }, expect.any(Function));
    expect(m.withSystemContext).not.toHaveBeenCalled();
  });

  it('rejects a list when organization context is missing', async () => {
    const { GET } = await loadRoute();
    await expect(
      GET({ request: new Request('http://localhost/api/agreements'), userId: 'u1' }),
    ).rejects.toMatchObject({ status: 400 });
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });

  it('creates an agreement for the server-resolved organization', async () => {
    m.db.insert = vi.fn(() => ({
      values: vi.fn((vals: Record<string, unknown>) => {
        m.inserted = vals;
        return { returning: vi.fn(async () => [{ id: 'a1', title: 'New CBA' }]) };
      }),
    }));
    const { POST } = await loadRoute();
    const result = await POST({
      request: new Request('http://localhost/api/agreements', {
        method: 'POST',
        body: JSON.stringify({ title: 'New CBA', organizationId: 'org_from_body' }),
      }),
      organizationId: 'org_1',
      userId: 'u1',
    });
    expect(result).toEqual({ data: { id: 'a1', title: 'New CBA' } });
    expect(m.inserted).toMatchObject({
      organizationId: 'org_1',
      createdBy: 'u1',
      lastModifiedBy: 'u1',
    });
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org_1' }, expect.any(Function));
    expect(m.withSystemContext).not.toHaveBeenCalled();
  });

  it('rejects create when organization context is missing', async () => {
    const { POST } = await loadRoute();
    await expect(
      POST({
        request: new Request('http://localhost/api/agreements', {
          method: 'POST',
          body: JSON.stringify({ title: 'New CBA', organizationId: 'org_from_body' }),
        }),
        userId: 'u1',
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(m.withRLSContext).not.toHaveBeenCalled();
    expect(m.db.insert).not.toHaveBeenCalled();
  });
});
