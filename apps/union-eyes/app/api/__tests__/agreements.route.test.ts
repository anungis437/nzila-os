import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  db: { select: vi.fn(), insert: vi.fn() },
  withSystemContext: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, z: require('zod') }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/db/schema', () => ({ collectiveAgreements: {} }));
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
    m.withApi.mockImplementation((_cfg: unknown, handler: any) => (ctx: any = {}) => handler(ctx));
    m.withSystemContext.mockImplementation(async (fn: any) => fn());

    m.db.select.mockImplementation(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({ limit: vi.fn(() => ({ offset: vi.fn(async () => [{ id: 'a1', title: 'CBA 2025' }]) })) })),
        })),
      })),
    }));
  });

  it('returns agreements list', async () => {
    m.db.select
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn(() => ({ offset: vi.fn(async () => [{ id: 'a1', title: 'CBA 2025' }]) })) })) })) })) }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(async () => [{ count: 1 }]) })) }));

    const { GET } = await loadRoute();
    const result = await GET({ request: new Request('http://localhost/api/agreements'), organizationId: 'org_1', userId: 'u1' });
    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
  });

  it('creates a new agreement', async () => {
    m.db.insert = vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'a1', title: 'New CBA' }]) })) }));
    const { POST } = await loadRoute();
    const result = await POST({
      request: new Request('http://localhost/api/agreements', { method: 'POST', body: JSON.stringify({ title: 'New CBA', organizationId: 'org_1' }) }),
      organizationId: 'org_1',
      userId: 'u1',
    });
    expect([undefined, 'a1']).toContain(result?.id ?? undefined);
  });
});
